import "dotenv/config";

import express from "express";
import crypto from "crypto";
import { createClient, logUsage } from "./lib/anthropic.js";
import { ensureUser } from "./lib/users.js";
import { appendMessage, recentMessages, listFacts } from "./lib/state.js";
import { WELCOME_MESSAGE, isGreeted, markGreeted } from "./lib/welcome.js";
import { sendText as sendWhatsApp } from "./lib/whatsapp.js";
import { start as startScheduler } from "./lib/scheduler.js";
import { routeMessage } from "./lib/router.js";
import { analyzeQuery, MODEL_EXECUTORS } from "./lib/router-analyzer.js";
import { classifyIntent } from "./lib/intent-classifier.js";
import { commands, byName } from "./commands/index.js";

const {
  META_WA_TOKEN,
  META_WA_PHONE_NUMBER_ID,
  META_WEBHOOK_VERIFY_TOKEN,
  META_APP_SECRET,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = "claude-opus-4-7",
  ALLOWED_WHATSAPP_NUMBERS = "",
  ADMIN_WHATSAPP_NUMBERS = "",
  PORT = 3000,
} = process.env;

const required = { META_WA_TOKEN, META_WA_PHONE_NUMBER_ID, META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET, ANTHROPIC_API_KEY };
for (const [k, v] of Object.entries(required)) if (!v) { console.error("missing env:", k); process.exit(1); }

const allowlist = new Set(ALLOWED_WHATSAPP_NUMBERS.split(",").map(s => s.trim().replace(/^\+/, "")).filter(Boolean));
const admins = new Set(ADMIN_WHATSAPP_NUMBERS.split(",").map(s => s.trim().replace(/^\+/, "")).filter(Boolean));
console.log("allowlist:", allowlist.size, "admins:", admins.size);

const anthropic = createClient(ANTHROPIC_API_KEY);
const app = express();

app.use("/webhook", express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.json());

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
    console.log("webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function validSignature(req) {
  const header = req.get("x-hub-signature-256");
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", META_APP_SECRET).update(req.rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

function systemPromptFor(number) {
  const facts = listFacts(number).map(f => `- ${f.fact}`).join("\n");
  const base = "You are a helpful personal assistant managing media via arr stack. Keep replies concise.";
  if (!facts) return base;
  return `${base}\n\nFacts the user has told you to remember:\n${facts}`;
}

async function runCommand(name, args, ctx) {
  const cmd = byName.get(name);
  if (!cmd) return `Unknown command /${name}. Try /help.`;
  if (cmd.adminOnly && !ctx.isAdmin) return `/${name} is admin-only.`;
  try {
    return await cmd.run({ ...ctx, args, commands });
  } catch (e) {
    console.error("command error:", name, e);
    return `Error running /${name}.`;
  }
}

async function handleCommand(text, ctx) {
  const m = text.trim().match(/^\/(\S+)\s*(.*)$/s);
  if (!m) return null;
  return runCommand(m[1].toLowerCase(), m[2] ?? "", ctx);
}

function toolToCommand(toolName, input) {
  // Handle both AI router format (with structured properties) and intent classifier format (args string)
  if (toolName === "search_web") {
    return { cmdName: "web-search", args: input.query || input.args || "", prefix: "🔍" };
  }
  switch (toolName) {
    case "add_series":
      return { cmdName: "add-series", args: input.title || input.args || "", prefix: "📺" };
    case "add_movie":
      return { cmdName: "add-movie", args: input.title || input.args || "", prefix: "🎬" };
    case "search_series":
      return { cmdName: "search-series", args: input.query || input.args || "", prefix: "🔍" };
    case "search_movie":
      return { cmdName: "search-movie", args: input.query || input.args || "", prefix: "🔍" };
    case "media_status":
      return { cmdName: "media-status", args: "", prefix: "📊" };
    case "remind":
      return { cmdName: "remind", args: input.args || `${input.when} ${input.text}`.trim(), prefix: "⏱" };
    case "todo_add":
      return { cmdName: "todo", args: `add ${input.text || input.args}`.trim(), prefix: "✅" };
    case "todo_list":
      return { cmdName: "todo", args: "list", prefix: "📋" };
    case "todo_done":
      return { cmdName: "todo", args: `done ${input.index || input.args}`.trim(), prefix: "✅" };
    case "reminders_list":
      return { cmdName: "reminders", args: "", prefix: "📋" };
    case "digest_add":
      return { cmdName: "digest", args: `add ${input.topic || input.args}`.trim(), prefix: "📰" };
    case "digest_remove":
      return { cmdName: "digest", args: `remove ${input.index || input.args}`.trim(), prefix: "📰" };
    case "digest_now":
      return { cmdName: "digest", args: "now", prefix: "📰" };
    case "digest_status":
      return { cmdName: "digest", args: "status", prefix: "📰" };
    case "reset":
      return { cmdName: "reset", args: "", prefix: "🔄" };
    case "time":
      return { cmdName: "time", args: "", prefix: "🕐" };
    default:
      return null;
  }
}

app.post("/webhook", async (req, res) => {
  if (!validSignature(req)) { console.warn("signature check failed"); return res.sendStatus(401); }
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg || msg.type !== "text") return;
    const from = msg.from;
    const text = msg.text.body;

    if (!allowlist.has(from)) {
      console.log("dropped (not allowlisted):", from);
      return;
    }
    const user = ensureUser(from);
    const isAdmin = admins.has(from);
    console.log("in:", from, text);

    if (!isGreeted(from)) {
      await sendWhatsApp(from, WELCOME_MESSAGE);
      markGreeted(from);
      console.log("welcomed:", from);
      return;
    }

    if (text.trim().startsWith("/")) {
      const reply = await handleCommand(text, { from, user, isAdmin });
      if (reply) {
        await sendWhatsApp(from, reply);
        console.log("cmd out:", from, reply.slice(0, 80));
      }
      return;
    }

    // Try pattern-based intent classification first (fast, high confidence)
    const intentMatch = classifyIntent(text);
    if (intentMatch && intentMatch.confidence >= 0.6) {
      console.log(`intent match: ${from} tool=${intentMatch.toolName} confidence=${intentMatch.confidence.toFixed(2)} args="${intentMatch.args}"`);
      try {
        const mapping = toolToCommand(intentMatch.toolName, {
          query: intentMatch.args,
          title: intentMatch.args,
          text: intentMatch.args,
          topic: intentMatch.args,
          when: intentMatch.args.split(/\s+/)[0],
          ...(intentMatch.toolName === "todo_done" ? { index: parseInt(intentMatch.args) } : {}),
          ...(intentMatch.toolName === "remind" ? { when: intentMatch.args.split(/\s+/)[0], text: intentMatch.args.split(/\s+/).slice(1).join(" ") } : {}),
        });
        if (mapping) {
          const out = await runCommand(mapping.cmdName, mapping.args, { from, user, isAdmin });
          const reply = `${mapping.prefix} ${out}`;
          await sendWhatsApp(from, reply);
          console.log("intent out:", from, reply.slice(0, 80));
          return;
        }
      } catch (e) {
        console.warn("intent routing failed, falling through to AI router:", e.message);
      }
    }

    // Analyze message for intelligent routing
    const analysis = await analyzeQuery(text);
    console.log(`analysis: ${from} sentiment=${analysis.sentiment} complexity=${analysis.complexity} task=${analysis.task_type} model=${analysis.model} (${analysis.source})`);

    try {
      const decision = await routeMessage(anthropic, text);
      if (decision.usage) logUsage(from, "claude-haiku-4-5", decision.usage);
      if (decision.kind === "tool") {
        const mapping = toolToCommand(decision.name, decision.input);
        if (mapping) {
          console.log(`routed: ${decision.name} ${JSON.stringify(decision.input)}`);
          const out = await runCommand(mapping.cmdName, mapping.args, { from, user, isAdmin });
          const reply = `${mapping.prefix} ${out}`;
          await sendWhatsApp(from, reply);
          console.log("route out:", from, reply.slice(0, 80));
          return;
        }
      }
    } catch (e) {
      console.warn("router failed, falling through to chat:", e.message);
    }

    appendMessage(from, "user", text);
    const messages = recentMessages(from, 20);
    const system = systemPromptFor(from);

    // Use suggested model from analysis, with user override and fallback
    const selectedModel = user.model || MODEL_EXECUTORS[analysis.model]?.name || ANTHROPIC_MODEL;

    const resp = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 1024,
      system,
      messages,
    });
    logUsage(from, selectedModel, resp.usage);
    const reply = resp.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "(no reply)";
    appendMessage(from, "assistant", reply);

    await sendWhatsApp(from, reply);
    console.log("out:", from, reply.slice(0, 80));
  } catch (e) {
    console.error("handler error:", e.response?.data || e.message);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`bridge listening on :${PORT}`);
  startScheduler();
});
