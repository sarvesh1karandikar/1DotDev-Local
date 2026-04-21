import cron from "node-cron";
import db from "./db.js";
import { dueReminders, markReminderSent, markReminderFailed, isAlreadyNotified, markNotified, cleanOldNotifications } from "./state.js";
import { sendText, sendTemplate } from "./whatsapp.js";
import { allEnabledSubscriptions, isDue, sendDigestFor } from "./digest.js";
import { getCompletedDownloads } from "./arr-stack.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_NAME = "reminder_notification";
const TEMPLATE_LANG = "en";
const DOWNLOAD_CHECK_INTERVAL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
const NOTIFICATION_RETENTION = 7 * 24 * 60 * 60 * 1000;

const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || "")
  .split(",")
  .map((n) => n.replace(/\D/g, ""))
  .filter(Boolean);

let lastDownloadCheck = 0;
let lastCleanup = 0;

function lastInboundMs(number) {
  const row = db.prepare(
    "SELECT MAX(created_at) AS last FROM messages WHERE number = ? AND role = 'user'"
  ).get(number);
  return row?.last ?? 0;
}

export async function fireReminder(rem) {
  const inWindow = (Date.now() - lastInboundMs(rem.number)) < WINDOW_MS;
  try {
    if (inWindow) {
      await sendText(rem.number, `🔔 Reminder: ${rem.text}`);
    } else {
      await sendTemplate(rem.number, TEMPLATE_NAME, TEMPLATE_LANG, [rem.text]);
    }
    markReminderSent(rem.id);
    console.log(`reminder #${rem.id} sent (${inWindow ? "free-form" : "template"}) to ${rem.number}`);
    return { ok: true, mode: inWindow ? "free-form" : "template" };
  } catch (e) {
    const detail = e.response?.data?.error?.message ?? e.message;
    markReminderFailed(rem.id, detail);
    console.error(`reminder #${rem.id} failed: ${detail}`);
    return { ok: false, error: detail };
  }
}

async function checkCompletedDownloads() {
  if (adminNumbers.length === 0) return;
  const completed = await getCompletedDownloads();
  for (const item of completed) {
    if (isAlreadyNotified(item.source, item.id)) continue;
    const emoji = item.source === "sonarr" ? "tv" : "movie";
    const msg = `[${emoji}] Download complete!\n\n*${item.title}* is now available on Jellyfin.`;
    for (const number of adminNumbers) {
      try {
        await sendText(number, msg);
      } catch (e) {
        console.error(`download notification to ${number} failed:`, e.message);
      }
    }
    markNotified(item.source, item.id, item.title);
    console.log(`notified: ${item.source} — ${item.title}`);
  }
}

export async function tick() {
  const now = Date.now();
  const due = dueReminders(now);
  if (due.length > 0) {
    console.log(`scheduler: ${due.length} reminder(s) due`);
    for (const rem of due) {
      await fireReminder(rem);
    }
  }

  const subs = allEnabledSubscriptions();
  const dueSubs = subs.filter(s => s.topics.length > 0 && isDue(s, new Date(now)));
  if (dueSubs.length > 0) {
    console.log(`scheduler: ${dueSubs.length} digest(s) due`);
    for (const sub of dueSubs) {
      await sendDigestFor(sub);
    }
  }

  if (now - lastDownloadCheck > DOWNLOAD_CHECK_INTERVAL) {
    lastDownloadCheck = now;
    await checkCompletedDownloads();
  }

  if (now - lastCleanup > CLEANUP_INTERVAL) {
    lastCleanup = now;
    const cleaned = cleanOldNotifications(NOTIFICATION_RETENTION);
    if (cleaned > 0) console.log(`scheduler: cleaned ${cleaned} old download notifications`);
  }
}

export function start() {
  // Every minute on the minute.
  cron.schedule("* * * * *", () => {
    tick().catch(e => console.error("scheduler tick crashed:", e));
  });
  console.log("scheduler started (checks every minute)");
}
