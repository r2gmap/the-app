// =====================================================================
// Admin Service — identity, role checks, overview statistics
// =====================================================================
// Admins are regular Firebase Auth email/password accounts whose
// users/{uid}.role is "admin". The role is granted ONLY through the
// Firebase console / Admin SDK (never writable from the browser —
// enforced by firestore.rules).
//
// =====================================================================

import { getFirebase } from "./firebase.js";
import { getUserProfile } from "./users-service.js";

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

/**
 * Admin login resolves to an email only. Keeping identity input private
 * avoids exposing an email-alias collection before authentication.
 */
function resolveAdminIdentifier(identifier) {
  const text = String(identifier || "").trim().toLowerCase();
  return text.includes("@") ? text : null;
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

export { getAdminAccess, isAdminUser, resolveAdminIdentifier, fetchOverviewCounts };
