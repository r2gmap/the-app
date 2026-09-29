// =====================================================================
// Firebase Configuration
// =====================================================================
// Holds ONLY the browser-safe Web SDK config for project "the-app-01".
// These identifiers are public by design — every Firebase web app ships
// them to the browser. Access to data is controlled by firestore.rules
// and storage.rules, never by hiding this file.
//
// NO service-account key or Admin SDK credential belongs here (or
// anywhere in this directory) — everything in this repo is public.
// =====================================================================

const firebaseConfig = {
  apiKey: "AIzaSyCn27E-6-OQnA4Z-VFe7E96_wijAY70Xzo",
  authDomain: "the-app-01.firebaseapp.com",
  projectId: "the-app-01",
  storageBucket: "the-app-01.firebasestorage.app",
  messagingSenderId: "491381202589",
  appId: "1:491381202589:web:64c959524404fe07c8fe74",
  measurementId: "G-6G8LX4R305",
};

// Version of the Firebase JS SDK loaded from the gstatic CDN. Kept in
// one place so an SDK upgrade is a single-line change.
const FIREBASE_SDK_VERSION = "12.19.0";

// True when every field the Web SDK needs is present. When false, the
// auth pages show the "not configured" notice instead of a form that
// can never succeed.
function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.authDomain
  );
}

export { firebaseConfig, FIREBASE_SDK_VERSION, hasFirebaseConfig };
