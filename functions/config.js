// =====================================================================
// Backend configuration — server-only secrets
// =====================================================================
// This module is imported only by Cloud Functions. It is never copied to
// Hosting and must never be imported by browser modules.
//
// Secret Manager values:
//   ADMIN_EMAIL
//   ADMIN_PASSWORD
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
//
// The frontend receives only short-lived Firebase custom tokens or safe
// success/error codes. It never receives a password, bot token, chat ID,
// or Telegram endpoint.
// =====================================================================

const { defineSecret } = require("firebase-functions/params");

const ADMIN_EMAIL = defineSecret("ADMIN_EMAIL");
const ADMIN_PASSWORD = defineSecret("ADMIN_PASSWORD");
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");

const ADMIN_SECRETS = [ADMIN_EMAIL, ADMIN_PASSWORD];
const TELEGRAM_SECRETS = [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID];
const ALL_SECRETS = [...ADMIN_SECRETS, ...TELEGRAM_SECRETS];

module.exports = {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  ADMIN_SECRETS,
  TELEGRAM_SECRETS,
  ALL_SECRETS,
};
