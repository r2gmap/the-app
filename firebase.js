// =====================================================================
// Firebase SDK Access + Centralized Auth-State Observer
// =====================================================================
// Every other module gets Firebase services (auth, db, storage) from
// here — never directly from the CDN. Two reasons this file exists:
//
//   1. One place to swap the SDK, add services, or add logging.
//   2. The SDK is loaded with a DYNAMIC import, so a blocked or slow
//      CDN (offline work, ad-blockers, restricted networks) degrades
//      gracefully: i18n, navigation and layout still run, and the auth
//      pages show their "not configured" notice instead of a dead page.
//
// Public API (used everywhere else):
//   getFirebase()      -> Promise<{ app, auth, db, storage } | null>
//   waitForAuthState() -> Promise<{ user: User|null, error: Error|null }>
//   signOutEverywhere()-> Promise<void>
// =====================================================================

import { firebaseConfig, FIREBASE_SDK_VERSION, hasFirebaseConfig } from "./firebase-config.js";

// ---------------------------------------------------------------------
// SDK bootstrap (runs once, cached)
// ---------------------------------------------------------------------

let firebasePromise = null;

/**
 * Loads the Firebase SDK (once) and returns the initialized services.
 * Resolves to `null` when the SDK cannot be loaded or the config is
 * missing — callers must handle that case, never crash on it.
 */
function getFirebase() {
  if (firebasePromise) return firebasePromise;

  firebasePromise = (async () => {
    // No usable config -> nothing to initialise.
    if (!hasFirebaseConfig()) return null;

    try {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

      // Dynamic imports keep the rest of the app alive if the CDN is
      // unreachable. Each module is fetched only when actually needed.
      const [{ initializeApp }, auth, db, storage] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`),
        import(`${base}/firebase-storage.js`),
      ]);

      const app = initializeApp(firebaseConfig);

      return {
        app,
        auth: auth.getAuth(app),
        db: db.getFirestore(app),
        storage: storage.getStorage(app),
        // Re-export the SDK namespaces so services never import the CDN
        // themselves — everything still flows through this module.
        sdk: { auth, db, storage },
      };
    } catch (error) {
      // Blocked CDN, offline device, SDK outage: report once, resolve
      // null so every page can fall back to its "not configured" state.
      console.warn("[firebase] SDK could not be loaded:", error?.message || error);
      return null;
    }
  })();

  return firebasePromise;
}

// ---------------------------------------------------------------------
// Centralized auth-state observer
// ---------------------------------------------------------------------

/**
 * Resolves with the FIRST real auth state Firebase reports: the signed-in
 * user, or null when signed out, or { user: null, error } when Firebase
 * itself failed (blocked network, SDK unavailable). Pages await this so
 * they never render the wrong state during the session-restore window.
 */
function waitForAuthState() {
  return getFirebase().then(async (fb) => {
    if (!fb) return { user: null, error: new Error("firebase-unavailable") };

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      // A failed listener (blocked connection, ad-blocker) must resolve
      // as signed-out, not hang every page's loading state forever.
      fb.auth.onAuthStateChanged(
        (user) => finish({ user, error: null }),
        (error) => finish({ user: null, error }),
      );
    });
  });
}

/**
 * Signs the current user out (used by every logout button and by the
 * admin guard when a non-admin somehow reaches an admin page).
 */
async function signOutEverywhere() {
  const fb = await getFirebase();
  if (!fb) return;
  await fb.sdk.auth.signOut(fb.auth);
}

export { getFirebase, waitForAuthState, signOutEverywhere };
