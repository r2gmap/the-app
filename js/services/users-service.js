// =====================================================================
// Users Service — Firestore `users` collection
// =====================================================================
// All user-profile logic lives here (no UI). The profile document:
//
//   users/{uid}: {
//     uid, email, displayName, photoURL,
//     role: "user" | "admin",        // "admin" is granted ONLY via the
//                                    // Firebase console / Admin SDK —
//                                    // never writable from the browser.
//     preferredLanguage, createdAt, updatedAt
//   }
// =====================================================================

import { getFirebase } from "../firebase.js";
import { getLocale } from "../i18n.js";

// ---------------------------------------------------------------------
// Profile lifecycle (called from the auth flows)
// ---------------------------------------------------------------------

/**
 * Creates the user's Firestore profile on first sign-in, or patches
 * presentation fields on later sign-ins — never recreates, never
 * touches uid/email/role (firestore.rules enforce this too).
 */
async function ensureUserProfile(authUser) {
  const fb = await getFirebase();
  if (!fb || !authUser?.uid) return null;

  const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = fb.sdk.db;
  const ref = doc(fb.db, "users", authUser.uid);
  const snapshot = await getDoc(ref);

  const displayName = authUser.displayName || authUser.email?.split("@")[0] || "";
  const photoURL = authUser.photoURL || null;

  if (!snapshot.exists()) {
    // First sign-in: create with the exact field set the rules require.
    // `role` is the literal "user" — there is no client path to admin.
    await setDoc(ref, {
      uid: authUser.uid,
      email: authUser.email || "",
      displayName,
      photoURL,
      role: "user",
      preferredLanguage: getLocale(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { uid: authUser.uid, displayName, photoURL, role: "user" };
  }

  // Returning user: patch presentation fields only, and only when they
  // actually changed, to avoid pointless writes.
  const data = snapshot.data();
  const patch = {};
  if (displayName && data.displayName !== displayName) patch.displayName = displayName;
  if (photoURL && data.photoURL !== photoURL) patch.photoURL = photoURL;
  if (data.preferredLanguage !== getLocale()) patch.preferredLanguage = getLocale();
  if (Object.keys(patch).length) {
    patch.updatedAt = serverTimestamp();
    await updateDoc(ref, patch);
  }
  return data;
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

/** Fetches one profile document (or null). */
async function getUserProfile(uid) {
  const fb = await getFirebase();
  if (!fb || !uid) return null;
  const { doc, getDoc } = fb.sdk.db;
  const snapshot = await getDoc(doc(fb.db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** The user's role ("user" | "admin"), defaulting to "user". */
async function getUserRole(uid) {
  const profile = await getUserProfile(uid);
  return profile?.role || "user";
}

/**
 * Lists up to `maxCount` user profiles (admin console). Firestore has no
 * server-side substring search, so filtering happens client-side in the
 * UI; for large audiences move search to Algolia/Typesense (README).
 */
async function fetchUsers(maxCount = 300) {
  const fb = await getFirebase();
  if (!fb) return [];
  const { collection, getDocs, query, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(collection(fb.db, "users"), orderBy("createdAt", "desc"), limit(maxCount)),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------
// Owner edits (presentation fields only — enforced by rules)
// ---------------------------------------------------------------------

/**
 * Updates the signed-in user's own profile. Allowed keys:
 * displayName, photoURL, preferredLanguage (plus updatedAt).
 */
async function updateUserProfile(uid, changes) {
  const fb = await getFirebase();
  if (!fb || !uid) return;
  const { doc, updateDoc, serverTimestamp } = fb.sdk.db;
  const patch = { updatedAt: serverTimestamp() };
  if (changes.displayName !== undefined) patch.displayName = changes.displayName;
  if (changes.photoURL !== undefined) patch.photoURL = changes.photoURL;
  if (changes.preferredLanguage !== undefined) patch.preferredLanguage = changes.preferredLanguage;
  await updateDoc(doc(fb.db, "users", uid), patch);
}

export { ensureUserProfile, getUserProfile, getUserRole, fetchUsers, updateUserProfile };
