// =====================================================================
// Secure support notification — Firebase Cloud Functions
// =====================================================================
// Firestore remains the durable support queue. This server-side trigger
// optionally forwards a new ticket to the operator's Telegram chat without
// putting a bot token, chat ID or provider URL in browser code.
// =====================================================================

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");

// ---------------------------------------------------------------------
// Telegram delivery
// ---------------------------------------------------------------------

/** Formats only the support fields needed by an operator. */
function formatTicketMessage(ticketId, data) {
  const category = String(data.category || "other");
  const message = String(data.message || "").trim();
  const email = String(data.email || "").trim();
  const userName = String(data.userName || "").trim();
  return [
    "The App — new support ticket",
    `Ticket: ${ticketId}`,
    `Category: ${category}`,
    `Member: ${userName || "—"}`,
    `Email: ${email || "—"}`,
    "",
    message,
  ].join("\n").slice(0, 3900);
}

/** Sends a support notification using server-only Secret Manager values. */
async function sendTelegramMessage(text, token, chatId) {
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`telegram-send-failed:${response.status}:${detail.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------
// Firestore trigger
// ---------------------------------------------------------------------

/**
 * Every ticket is stored first. Notification failure is logged and thrown
 * so the event is retried by Cloud Functions without changing the ticket
 * or exposing provider details to the member-facing application.
 */
exports.notifySupportTicket = onDocumentCreated(
  {
    document: "supportTickets/{ticketId}",
    region: "africa-south1",
    secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID],
    retry: true,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const token = TELEGRAM_BOT_TOKEN.value();
    const chatId = TELEGRAM_CHAT_ID.value();
    if (!token || !chatId) {
      console.error("[support] notification secrets are not configured");
      return;
    }

    const ticketId = event.params.ticketId;
    const text = formatTicketMessage(ticketId, snapshot.data());
    await sendTelegramMessage(text, token, chatId);
  },
);
