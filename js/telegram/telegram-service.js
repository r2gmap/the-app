// =====================================================================
// Telegram Service (standalone — never import from a UI component)
// =====================================================================
// Sends Telegram messages to the admin group about submission and
// withdrawal events. Kept completely separate from UI code: pages call
// the business services, the services call this module.
//
// CONFIG (Firestore document `config/telegram`, admin-only read/write):
//   {
//     enabled: true,          // master switch — set false to silence
//     botToken: "123456:ABC…",// from @BotFather
//     chatId: "-100123456…"   // the admin group chat id
//   }
//
// SECURITY MODEL
//   The bot token is readable only by admins (firestore.rules), so
//   messages are SENT from the admin client when a review decision is
//   made. "received" pings at submission time would need the token in
//   every user's browser — instead, enable the Cloud Function described
//   in README "Future expansion" to fire those server-side.
// =====================================================================

import { getFirebase } from "../firebase.js";
import { formatMoney } from "../format.js";

let cachedConfig = null; // one read per session is enough

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

/** Reads and caches the Telegram config (admins only; null when unset). */
async function getTelegramConfig() {
  if (cachedConfig !== null) return cachedConfig;
  try {
    const fb = await getFirebase();
    if (!fb) return (cachedConfig = undefined);
    const { doc, getDoc } = fb.sdk.db;
    const snapshot = await getDoc(doc(fb.db, "config", "telegram"));
    cachedConfig = snapshot.exists() ? snapshot.data() : undefined;
  } catch (error) {
    // Missing permission (not an admin) or offline — treat as disabled.
    cachedConfig = undefined;
  }
  return cachedConfig;
}

/** True when Telegram notifications are configured and enabled. */
async function isTelegramEnabled() {
  const config = await getTelegramConfig();
  return Boolean(config?.enabled && config?.botToken && config?.chatId);
}

// ---------------------------------------------------------------------
// Low-level send (the only network call in this module)
// ---------------------------------------------------------------------

/**
 * Sends a plain-text message through the Telegram Bot API. Never
 * throws — Telegram is an enhancement, not a critical path.
 */
async function sendMessage(text) {
  if (!(await isTelegramEnabled())) return false;
  const { botToken, chatId } = await getTelegramConfig();
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return response.ok;
  } catch (error) {
    console.warn("[telegram] send failed:", error?.message || error);
    return false;
  }
}

// ---------------------------------------------------------------------
// Domain notifications (reusable, expandable API)
// ---------------------------------------------------------------------

/**
 * Notifies the admin group about a submission event.
 * action: "received" | "approved" | "rejected"
 */
function sendSubmissionNotification(submission, action = "received") {
  const lines = [
    `📝 Task submission — ${actionLabel(action)}`,
    `Offer: ${submission.offerTitle || "—"}`,
    `User: ${submission.userName || "—"} (${submission.email || "—"})`,
    `Task: ${submission.taskTitle || "—"}`,
    `Reward: ${formatMoney(submission.rewardSnapshot ?? submission.reward, "en")}`,
    `Wallet: ${submission.walletNumber || "—"}`,
  ];
  if (action === "rejected" && submission.rejectionReason) {
    lines.push(`Reason: ${submission.rejectionReason}`);
  }
  if (action === "received") {
    lines.push("→ Review it in the admin panel: admin/submissions.html");
  }
  return sendMessage(lines.join("\n"));
}

/**
 * Notifies the admin group about a withdrawal event.
 * action: "received" | "approved" | "rejected"
 */
function sendWithdrawalNotification(withdrawal, action = "received") {
  const lines = [
    `💸 Withdrawal request — ${actionLabel(action)}`,
    `User: ${withdrawal.userName || "—"} (${withdrawal.email || "—"})`,
    `Amount: ${formatMoney(withdrawal.amount, "en")}`,
    `Wallet: ${withdrawal.walletNumber || "—"}`,
  ];
  if (action === "rejected" && withdrawal.rejectionReason) {
    lines.push(`Reason: ${withdrawal.rejectionReason}`);
  }
  if (action === "received") {
    lines.push("→ Review it in the admin panel: admin/withdrawals.html");
  }
  return sendMessage(lines.join("\n"));
}

/** Small helper so the action word is consistent everywhere. */
function actionLabel(action) {
  const labels = { received: "NEW", approved: "APPROVED", rejected: "REJECTED" };
  return labels[action] || String(action).toUpperCase();
}

export { sendMessage, sendSubmissionNotification, sendWithdrawalNotification, isTelegramEnabled, getTelegramConfig };
