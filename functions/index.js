// =====================================================================
// The App backend entry point
// =====================================================================
// Cloud Functions is the small server layer for the static application.
// Browser modules never import this file and never receive a secret.
//
// Responsibilities:
//   - validate the configured admin credentials server-side;
//   - create a Firebase custom token for the admin session;
//   - keep the authoritative users/{uid}.role == "admin" profile in sync;
//   - forward supportTickets/{ticketId} to Telegram from Secret Manager.
//
// Admin authentication flow:
//   1. /api/admin/login receives email/password over HTTPS.
//   2. The function compares them with ADMIN_EMAIL/ADMIN_PASSWORD.
//   3. It provisions the matching Firebase Auth identity and admin profile.
//   4. It returns a Firebase custom token, never a password or secret.
//   5. The browser signs in with that token and Firebase rules enforce the
//      same users/{uid}.role == "admin" authorization boundary.
//
// Telegram message flow:
//   1. The browser creates a private supportTickets document using Firestore
//      rules and uploads an optional private image to Storage.
//   2. This trigger receives the new ticket server-side.
//   3. It reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from Secret Manager,
//      formats a safe operator message, and sends it to Telegram.
//   4. A delivery failure is retried without exposing provider details to the
//      member-facing application.
// =====================================================================

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_SECRETS,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_SECRETS,
} = require("./config");

initializeApp();

const auth = getAuth();
const db = getFirestore();
const REGION = "africa-south1";

// =====================================================================
// Shared HTTP helpers
// =====================================================================

function setCorsHeaders(req, res) {
  const origin = req.get("origin");
  if (origin) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }
  return {};
}

/** Constant-time comparison for the configured password and email values. */
function secureEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  const size = Math.max(a.length, b.length);
  const paddedA = Buffer.alloc(size);
  const paddedB = Buffer.alloc(size);
  a.copy(paddedA);
  b.copy(paddedB);
  let difference = a.length ^ b.length;
  for (let index = 0; index < size; index += 1) {
    difference |= paddedA[index] ^ paddedB[index];
  }
  return difference === 0;
}

// =====================================================================
// Admin authentication endpoint
// =====================================================================

/**
 * Finds or creates the Firebase identity behind the configured admin
 * credentials, then keeps the profile and custom claim aligned. Firestore
 * remains the authorization source used by the browser rules; the claim is
 * useful for session context and future server-side operations.
 */
async function provisionAdminIdentity(email) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    userRecord = await auth.createUser({
      email,
      emailVerified: true,
      disabled: false,
    });
  }

  if (userRecord.disabled) {
    const error = new Error("admin-disabled");
    error.code = "admin-disabled";
    throw error;
  }

  await auth.setCustomUserClaims(userRecord.uid, {
    ...(userRecord.customClaims || {}),
    admin: true,
  });

  const profileRef = db.collection("users").doc(userRecord.uid);
  const existing = await profileRef.get();
  const profile = {
    uid: userRecord.uid,
    email,
    displayName: userRecord.displayName || email.split("@")[0],
    photoURL: userRecord.photoURL || null,
    role: "admin",
    preferredLanguage: existing.exists ? existing.data().preferredLanguage || "en" : "en",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!existing.exists) profile.createdAt = FieldValue.serverTimestamp();
  await profileRef.set(profile, { merge: true });

  return userRecord;
}

/**
 * POST /api/admin/login
 *
 * The endpoint deliberately returns only a generic credential error. It
 * never reveals whether the configured email exists in Firebase Auth.
 */
exports.adminLogin = onRequest(
  {
    region: REGION,
    secrets: ADMIN_SECRETS,
    invoker: "public",
  },
  async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ code: "method_not_allowed" });
      return;
    }

    const configuredEmail = String(ADMIN_EMAIL.value() || "").trim().toLowerCase();
    const configuredPassword = String(ADMIN_PASSWORD.value() || "");
    if (!configuredEmail || !configuredPassword) {
      console.error("[admin] ADMIN_EMAIL or ADMIN_PASSWORD is not configured");
      res.status(503).json({ code: "server_not_configured" });
      return;
    }

    const body = readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!secureEqual(email, configuredEmail) || !secureEqual(password, configuredPassword)) {
      res.status(401).json({ code: "invalid_credentials" });
      return;
    }

    try {
      const userRecord = await provisionAdminIdentity(configuredEmail);
      const token = await auth.createCustomToken(userRecord.uid, { admin: true });
      res.set("Cache-Control", "no-store");
      res.status(200).json({ token });
    } catch (error) {
      console.error("[admin] identity provisioning failed", error?.code || error?.message || error);
      if (error?.code === "admin-disabled") {
        res.status(403).json({ code: "admin_disabled" });
        return;
      }
      res.status(503).json({ code: "admin_unavailable" });
    }
  },
);

// =====================================================================
// Telegram delivery
// =====================================================================

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

// =====================================================================
// Firestore support trigger
// =====================================================================

/**
 * Every ticket is stored first. Notification failure is logged and thrown
 * so the event is retried by Cloud Functions without changing the ticket
 * or exposing provider details to the member-facing application.
 */
exports.notifySupportTicket = onDocumentCreated(
  {
    document: "supportTickets/{ticketId}",
    region: REGION,
    secrets: TELEGRAM_SECRETS,
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
