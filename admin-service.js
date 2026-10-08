// =====================================================================
// Admin Service — identity, role checks, overview statistics
// =====================================================================
// Admins use a Firebase Auth custom-token session issued by the backend
// Secret Manager login flow. Their users/{uid}.role is still the trusted
// authorization record; it is granted only by the backend Admin SDK flow
// or a trusted operator, never writable from the browser.
//
// =====================================================================

import { getFirebase } from "./firebase.js";
import { getUserProfile } from "./users-service.js";

// =====================================================================
// Backend admin authentication
// =====================================================================
// Credentials are posted to the same-origin Cloud Function. The browser
// never knows the configured password and never compares credentials itself.
// The function returns a Firebase custom token, which Firebase Auth then
// persists locally for the protected admin session.
// =====================================================================

const ADMIN_LOGIN_ENDPOINT = "/api/admin/login";

async function requestAdminSession(email, password) {
  let response;
  try {
    response = await fetch(ADMIN_LOGIN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") }),
    });
  } catch (error) {
    const networkError = new Error("admin-network-failed");
    networkError.code = "admin-network-failed";
    throw networkError;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }
  if (!response.ok || !payload.token) {
    const backendError = new Error(payload.code || "admin-unavailable");
    backendError.code = payload.code || "admin-unavailable";
    backendError.status = response.status;
    throw backendError;
  }
  return payload.token;
}

// ---------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------

/**
 * Reads the one authoritative authorization record for a UID. Returning
 * only existence, role and the boolean decision keeps UI code from
 * inventing a second admin policy while making failed role reads visible
 * to the caller as rejected access.
 */
async function getAdminAccess(uid) {
  if (!uid) return { exists: false, role: null, isAdmin: false };
  const profile = await getUserProfile(uid);
  const role = profile?.role || null;
  return { exists: Boolean(profile), role, isAdmin: role === "admin" };
}

/** True when the signed-in user holds the admin role. */
async function isAdminUser(uid) {
  return (await getAdminAccess(uid)).isAdmin;
}

// ---------------------------------------------------------------------
// Overview statistics (cheap count aggregations, not document reads)
// ---------------------------------------------------------------------

/**
 * All dashboard-overview numbers in one round trip: total users, total
 * content, per-category content counts (games / apps / websites /
 * offers) and the three review states (pending / approved / rejected).
 * Each number is a Firestore count aggregation — no documents are
 * downloaded, so the dashboard stays cheap as content grows.
 */
async function fetchOverviewCounts() {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getCountFromServer, query, where } = fb.sdk.db;
  const offers = collection(fb.db, "offers");
  const submissions = collection(fb.db, "taskSubmissions");

  // One count query per card, all issued in parallel.
  const [
    users, content, games, apps, websites, offerCategory, pending, approved, rejected,
  ] = await Promise.all([
    getCountFromServer(query(collection(fb.db, "users"))),
    getCountFromServer(query(offers)),
    getCountFromServer(query(offers, where("category", "==", "game"))),
    getCountFromServer(query(offers, where("category", "==", "app"))),
    getCountFromServer(query(offers, where("category", "==", "website"))),
    getCountFromServer(query(offers, where("category", "==", "offer"))),
    getCountFromServer(query(submissions, where("status", "==", "pending"))),
    getCountFromServer(query(submissions, where("status", "==", "approved"))),
    getCountFromServer(query(submissions, where("status", "==", "rejected"))),
  ]);

  const count = (snapshot) => snapshot.data().count;
  return {
    users: count(users),
    content: count(content),
    games: count(games),
    apps: count(apps),
    websites: count(websites),
    offers: count(offerCategory),
    pending: count(pending),
    approved: count(approved),
    rejected: count(rejected),
  };
}

export {
  getAdminAccess,
  isAdminUser,
  requestAdminSession,
  fetchOverviewCounts,
};
