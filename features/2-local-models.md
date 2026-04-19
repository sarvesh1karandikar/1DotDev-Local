# Feature 2: Local AI Models — Ollama + RAG Integration

## Goal

Run open-weight LLMs locally via Ollama. Integrate into the 1DotDev WhatsApp bridge
so users can switch to local inference. Also wire up the existing `chromadb-orm` repo
as a RAG backend accessible via `/ask` from WhatsApp.

---

## Part A: Ollama Setup

### What is Ollama?

Ollama is a local model runner (like Docker for LLMs). It downloads quantized model
weights, runs an OpenAI-compatible REST API at `localhost:11434` (we'll use 8080),
and manages GPU/CPU allocation automatically.

### Recommended Models by Hardware

| Hardware | Recommended model | RAM needed | Speed |
|---|---|---|---|
| CPU only (no GPU) | `phi3:mini` (3.8B) | 4GB | ~5 tokens/sec |
| CPU only | `llama3.2:3b` | 4GB | ~5 tokens/sec |
| GPU 6–8GB VRAM | `llama3.1:8b` | 8GB | ~30 tokens/sec |
| GPU 12–16GB VRAM | `mistral:7b` or `llama3.1:8b-q8` | 12GB | ~40 tokens/sec |

**WSL2 + GPU:** NVIDIA GPUs work via CUDA with WSL2. Ollama auto-detects CUDA.
AMD GPUs: limited ROCm support on WSL2, stick to CPU if not NVIDIA.

**For WhatsApp chat (replies within ~3 seconds), phi3:mini on CPU is the minimum viable.**

---

### Phase 1: Install Ollama

```bash
# Install Ollama on WSL2
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama server on port 8080 (avoid clash with ChromaDB's 8000)
OLLAMA_HOST=127.0.0.1:8080 ollama serve &

# Pull recommended models
ollama pull phi3:mini          # 3.8B, ~2.2GB — fastest on CPU
ollama pull llama3.2:3b        # 3B, ~2GB — good quality
ollama pull nomic-embed-text   # embedding model for RAG

# Test inference
ollama run phi3:mini "Say hello in one sentence"
```

### Phase 2: Configure Ollama as a PM2 Service

Add to `infra/pm2/ecosystem.config.cjs` in the 1DotDev repo:

```js
{
  name: "ollama",
  script: "ollama",
  args: "serve",
  interpreter: "none",
  env: {
    OLLAMA_HOST: "127.0.0.1:8080",
    OLLAMA_KEEP_ALIVE: "24h",  // keep model loaded in memory
  },
  autorestart: true,
  watch: false,
},
```

---

## Part B: Bridge Integration — New Files in 1DotDev

### New file: `bridge/lib/ollama.js`

Create this file. It mirrors the API shape of `bridge/lib/anthropic.js` so the
rest of the code can swap between Claude and Ollama with minimal changes.

```js
// Ollama client — mirrors Anthropic client API shape for drop-in swap
import axios from "axios";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:8080";

export async function ollamaChat(model, systemPrompt, messages, maxTokens = 1024) {
  const ollamaMessages = [];
  if (systemPrompt) ollamaMessages.push({ role: "system", content: systemPrompt });
  for (const m of messages) ollamaMessages.push({ role: m.role, content: m.content });

  const resp = await axios.post(`${OLLAMA_HOST}/api/chat`, {
    model,
    messages: ollamaMessages,
    stream: false,
    options: { num_predict: maxTokens },
  });

  const reply = resp.data.message?.content?.trim() || "(no reply)";
  // Ollama doesn't report token counts in the same way; estimate for cost tracking
  const inputTokens = ollamaMessages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0);
  const outputTokens = Math.ceil(reply.length / 4);

  return {
    reply,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    model,
  };
}

export function isLocalModel(modelName) {
  return modelName && (modelName.startsWith("local:") || modelName.startsWith("ollama:"));
}

export function resolveOllamaModel(modelAlias) {
  const map = {
    "local": "phi3:mini",
    "local:phi": "phi3:mini",
    "local:llama": "llama3.2:3b",
    "local:mistral": "mistral:7b",
  };
  return map[modelAlias] || modelAlias.replace("local:", "").replace("ollama:", "");
}
```

### Modified: `bridge/lib/models.js`

Add local model aliases to the existing model registry.

**Find the existing alias map (around line 1-30) and add:**

```js
// Add to the MODELS object or equivalent alias map in models.js:
"local":        { id: "local",        tier: "local", display: "Local (phi3-mini)" },
"local:phi":    { id: "local:phi",    tier: "local", display: "Local Phi-3 Mini" },
"local:llama":  { id: "local:llama",  tier: "local", display: "Local Llama 3.2 3B" },
```

### Modified: `bridge/server.js`

The main chat path needs to check if the user's model is a local model and call Ollama
instead of Anthropic. Find the section that calls `anthropic.messages.create` (around line 174)
and wrap it:

```js
// At the top of server.js, add import:
import { ollamaChat, isLocalModel, resolveOllamaModel } from "./lib/ollama.js";

// Replace the existing chat block (around line 170-188) with:

appendMessage(from, "user", text);
const messages = recentMessages(from, 20);
const system = systemPromptFor(from);
const userModel = user.model || ANTHROPIC_MODEL;

let reply;
if (isLocalModel(userModel)) {
  // Route to Ollama
  const ollamaModel = resolveOllamaModel(userModel);
  const result = await ollamaChat(ollamaModel, system, messages, 1024);
  // Log as $0 cost (local inference is free)
  logUsage(from, `ollama:${ollamaModel}`, result.usage, 0);
  reply = result.reply;
} else {
  // Route to Anthropic (existing path)
  const resp = await anthropic.messages.create({
    model: userModel,
    max_tokens: 1024,
    system,
    messages,
  });
  logUsage(from, userModel, resp.usage);
  reply = resp.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "(no reply)";
}

appendMessage(from, "assistant", reply);
await sendWhatsApp(from, reply);
console.log("out:", from, reply.slice(0, 80));
```

### Modified: `bridge/lib/anthropic.js`

Update `logUsage` to accept an optional cost override (for local models):

```js
// Find the logUsage function and update its signature:
export function logUsage(number, model, usage, costOverride = null) {
  const rate = PRICING[model] ?? PRICING.default ?? { input: 0, output: 0 };
  const cost = costOverride !== null ? costOverride :
    (usage.input_tokens * rate.input + usage.output_tokens * rate.output) / 1_000_000;
  db.prepare(
    "INSERT INTO usage (number, model, input_tokens, output_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(number, model, usage.input_tokens ?? 0, usage.output_tokens ?? 0, cost, Date.now());
}
```

### New file: `bridge/commands/local.js`

One-shot local model command (doesn't change the user's default model):

```js
import { ollamaChat } from "../lib/ollama.js";

export default {
  name: "local",
  category: "ai",
  description: "Chat with local AI model (one message, doesn't change your default model)",
  usage: "/local [model] <message>",
  details: "Model options: phi (default), llama. Example: /local phi What is entropy?",
  async run({ args }) {
    if (!args.trim()) return "Usage: /local <message> or /local phi <message>";

    let model = "phi3:mini";
    let message = args.trim();

    if (message.startsWith("phi ")) { model = "phi3:mini"; message = message.slice(4); }
    else if (message.startsWith("llama ")) { model = "llama3.2:3b"; message = message.slice(6); }

    try {
      const result = await ollamaChat(model, null, [{ role: "user", content: message }], 512);
      return `🤖 [${model}]\n${result.reply}`;
    } catch (e) {
      if (e.code === "ECONNREFUSED") return "Local model offline. Is Ollama running?";
      return `Local model error: ${e.message}`;
    }
  },
};
```

### `.env` additions

```
# Ollama (local LLM)
OLLAMA_HOST=http://localhost:8080
OLLAMA_DEFAULT_MODEL=phi3:mini
```

---

## Part C: RAG Integration — chromadb-orm + `/ask` Command

### Setup: Clone and run chromadb repo

```bash
# Clone the existing chromadb repo
cd /home/sskgameon/sarvesh1karandikar
git clone https://github.com/sarvesh1karandikar/chromadb.git

cd chromadb
pip install -r requirements.txt

# ChromaDB server is started by Docker Compose (port 8000)
# Start the FastAPI backend on port 9000
uvicorn main:app --host 127.0.0.1 --port 9000
```

**Critical:** Edit `main.py` in the chromadb repo to remove the startup collection-wipe:

```python
# In main.py, find the lifespan function and remove or comment out:
# await asyncio.to_thread(client.reset)   ← DELETE THIS LINE
# This line deletes all ChromaDB data on startup — catastrophic for production use.
```

Also set `PERSIST_ON_STARTUP=false` or remove the wipe entirely. Without this fix,
all uploaded documents are lost every time the service restarts.

### Add to PM2 config:

```js
{
  name: "chromadb-rag",
  script: "uvicorn",
  args: "main:app --host 127.0.0.1 --port 9000",
  cwd: "/home/sskgameon/sarvesh1karandikar/chromadb",
  interpreter: "python3",
  autorestart: true,
  watch: false,
},
```

### New file: `bridge/lib/rag.js`

```js
// RAG query helper — calls chromadb-orm's /search endpoint
import axios from "axios";

const RAG_HOST = process.env.RAG_HOST || "http://localhost:9000";

export async function ragSearch(query, topK = 5) {
  const resp = await axios.post(`${RAG_HOST}/search`, { query, top_k: topK });
  return resp.data.results ?? [];
}

export function formatChunksAsContext(chunks) {
  if (!chunks.length) return null;
  return chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
}
```

### New file: `bridge/commands/ask.js`

```js
import { ragSearch, formatChunksAsContext } from "../lib/rag.js";
import { createClient } from "../lib/anthropic.js";
import { ollamaChat, isLocalModel, resolveOllamaModel } from "../lib/ollama.js";

const MAX_CONTEXT_CHARS = 3000; // keep WhatsApp reply short

export default {
  name: "ask",
  category: "ai",
  description: "Ask a question about your documents",
  usage: "/ask <question>",
  details: "Searches your uploaded documents via RAG and answers using AI.",
  async run({ from, user, args }) {
    if (!args.trim()) return "Usage: /ask <your question about your documents>";

    let chunks;
    try {
      chunks = await ragSearch(args.trim());
    } catch (e) {
      if (e.code === "ECONNREFUSED") return "RAG service offline. Is chromadb-orm running?";
      return `RAG error: ${e.message}`;
    }

    if (!chunks.length) return "No relevant documents found. Upload some documents to the RAG service first.";

    const context = formatChunksAsContext(chunks).slice(0, MAX_CONTEXT_CHARS);
    const prompt = `Using the following document excerpts, answer this question:\n\nQuestion: ${args.trim()}\n\nContext:\n${context}`;
    const model = user.model || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    let answer;
    if (isLocalModel(model)) {
      const result = await ollamaChat(resolveOllamaModel(model), null, [{ role: "user", content: prompt }], 512);
      answer = result.reply;
    } else {
      const anthropic = createClient(process.env.ANTHROPIC_API_KEY);
      const resp = await anthropic.messages.create({
        model,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
      answer = resp.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    }

    return `📄 *Answer:*\n${answer}\n\n_Based on ${chunks.length} document chunk(s)_`;
  },
};
```

### `.env` additions

```
# RAG backend
RAG_HOST=http://localhost:9000
```

---

## Verification

```bash
# Ollama running
curl http://localhost:8080/api/tags
# → {"models":[{"name":"phi3:mini",...}]}

# Quick inference test
curl http://localhost:8080/api/generate -d '{"model":"phi3:mini","prompt":"2+2=","stream":false}'

# chromadb-orm running
curl http://localhost:9000/health
# → {"status":"ok"}  (if health endpoint exists, else check /docs)

# WhatsApp tests:
# Send: /local What is machine learning?
# Expected: reply from local phi3 model

# Send: /model local  (switch default to local model)
# Then send any chat message — should reply using Ollama

# Send: /model haiku  (switch back to Claude)
```

---

## Performance Notes

| Model | Hardware | Typical latency for 200-token reply |
|---|---|---|
| phi3:mini | CPU only (4-core) | 30–60 seconds |
| phi3:mini | GPU 6GB | 5–8 seconds |
| llama3.2:3b | CPU only | 40–80 seconds |
| llama3.2:3b | GPU 6GB | 6–10 seconds |

**For WhatsApp use:** CPU-only latency (30–60s) is acceptable since WhatsApp doesn't
show "typing" timeout the way a web chat does. Users see a reply eventually.
Set expectations with a command response: "⚙️ Running local model, may take up to 60s..."

Update `bridge/commands/local.js` to send this notice before calling Ollama:

```js
// In local.js run(), add before the ollamaChat call:
await sendWhatsApp(from, "⚙️ Querying local model, please wait...");
// (need to import sendWhatsApp or pass it through context)
```
