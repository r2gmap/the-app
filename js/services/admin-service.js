// =====================================================================
// Admin Service — identity, role checks, overview statistics
// =====================================================================
// Admins are regular Firebase Auth email/password accounts whose
// users/{uid}.role is "admin". The role is granted ONLY through the
// Firebase console / Admin SDK (never writable from the browser —
// enforced by firestore.rules).
//
// Optional username aliases: documents in `adminUsernames/{username}`
// ({ email }) let an admin sign in with a username instead of the
// email. Reads are unauthenticated-get so the login page can resolve
// the identifier; creating aliases is done from the console.
// =====================================================================

import { getFirebase } from "../firebase.js";
import { getUserRole } from "./users-service.js";

// ---------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------

/** True when the signed-in user holds the admin role. */
async function isAdminUser(uid) {
  if (!uid) return false;
  return (await getUserRole(uid)) === "admin";
}

/**
 * Resolves the admin-login identifier to an email. Accepts either an
 * email address directly or a username registered in `adminUsernames`.
 * Returns null when a username has no alias document.
 */
async function resolveAdminIdentifier(identifier) {
  const text = String(identifier || "").trim();
  if (!text) return null;
  if (text.includes("@")) return text.toLowerCase();

  const fb = await getFirebase();
  if (!fb) return null;
  const { doc, getDoc } = fb.sdk.db;
  const username = text.toLowerCase();
  const snapshot = await getDoc(doc(fb.db, "adminUsernames", username)).catch(() => null);
  return snapshot?.exists() ? snapshot.data().email || null : null;
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

export { isAdminUser, resolveAdminIdentifier, fetchOverviewCounts };
