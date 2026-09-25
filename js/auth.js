// =====================================================================
// Authentication UI + Route Guards
// =====================================================================
// Owns every user-facing authentication behaviour:
//   - auth-aware navigation (guest links vs. user chip + logout)
//   - login / register / forgot-password forms with validation
//   - Google sign-in button
//   - the verify-email page controller (resend cooldown, re-check)
//   - route guards reused by every protected page
//
// Firebase Authentication is the ONLY source of truth for the session —
// nothing here writes a session flag to storage. Firestore profile
// creation/patching lives in services/users-service.js.
// =====================================================================

import { getFirebase, waitForAuthState, signOutEverywhere } from "./firebase.js";
import { t } from "./i18n.js";
import { qs, qsa, el, toast, withBusy } from "./ui.js";
import { ensureUserProfile } from "./services/users-service.js";

// Destinations used by the post-login flow.
const ROUTES = {
  login: "login.html",
  register: "register.html",
  verify: "verify-email.html",
  dashboard: "dashboard.html",
  home: "index.html",
};

// ---------------------------------------------------------------------
// Friendly, localized Firebase error messages
// ---------------------------------------------------------------------

// Raw Firebase codes must never reach the screen. A wrong password and
// a nonexistent account deliberately show the SAME message so the
// login form cannot be used to probe which emails are registered.
const AUTH_ERROR_KEYS = {
  "auth/invalid-credential": "auth.errors.invalid-credential",
  "auth/invalid-login-credentials": "auth.errors.invalid-login-credentials",
  "auth/wrong-password": "auth.errors.wrong-password",
  "auth/user-not-found": "auth.errors.user-not-found",
  "auth/invalid-email": "auth.errors.invalid-email",
  "auth/email-already-in-use": "auth.errors.email-already-in-use",
  "auth/weak-password": "auth.errors.weak-password-firebase",
  "auth/too-many-requests": "auth.errors.too-many-requests",
  "auth/network-request-failed": "auth.errors.network-request-failed",
  "auth/popup-closed-by-user": "auth.errors.popup-closed-by-user",
  "auth/cancelled-popup-request": "auth.errors.cancelled-popup-request",
  "auth/popup-blocked": "auth.errors.popup-blocked",
  "auth/operation-not-allowed": "auth.errors.operation-not-allowed",
};

/** Maps a Firebase Auth error to a localized, user-safe message. */
function friendlyAuthError(error) {
  const key = AUTH_ERROR_KEYS[error?.code];
  return t(key || "auth.errors.generic");
}

// ---------------------------------------------------------------------
// Client-side form validation (feedback only; Firebase is the gate)
// ---------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates one form value. Returns an i18n error key or null.
 * Keep in sync with register.html's field order.
 */
function validateFieldValue(name, value, allValues) {
  const text = String(value || "").trim();
  switch (name) {
    case "displayName":
      return text ? null : "auth.errors.fieldRequired";
    case "email":
      if (!text) return "auth.errors.fieldRequired";
      return EMAIL_PATTERN.test(text) ? null : "auth.errors.invalidEmail";
    case "password":
      if (!text) return "auth.errors.fieldRequired";
      return text.length >= 8 ? null : "auth.errors.weakPassword";
    case "confirmPassword":
      if (!text) return "auth.errors.fieldRequired";
      return text === allValues.password ? null : "auth.errors.passwordMismatch";
    default:
      return text ? null : "auth.errors.fieldRequired";
  }
}

/**
 * Runs validation over a form and paints per-field errors. Returns the
 * trimmed values when valid, otherwise null — and the caller must NOT
 * contact Firebase at all for an invalid submission.
 */
function validateForm(form) {
  const values = {};
  let valid = true;

  for (const field of qsa("[data-field]", form)) {
    const name = field.dataset.field;
    const input = qs("input, textarea, select", field);
    values[name] = input ? input.value : "";
  }
  for (const field of qsa("[data-field]", form)) {
    const name = field.dataset.field;
    const input = qs("input, textarea, select", field);
    const errorKey = validateFieldValue(name, input?.value, values);
    const errorNode = qs("[data-field-error]", field);
    if (errorNode) errorNode.textContent = errorKey ? t(errorKey) : "";
    field.classList.toggle("field--invalid", Boolean(errorKey));
    if (errorKey) valid = false;
  }
  return valid ? values : null;
}

/** Clears every painted error in a form (used on input). */
function clearFormErrors(form) {
  for (const field of qsa("[data-field]", form)) {
    field.classList.remove("field--invalid");
    const errorNode = qs("[data-field-error]", field);
    if (errorNode) errorNode.textContent = "";
  }
  const formError = qs("[data-form-error]", form);
  if (formError) formError.textContent = "";
}

/** Paints a form-level error message. */
function showFormError(form, message) {
  const node = qs("[data-form-error]", form);
  if (node) node.textContent = message;
}

// ---------------------------------------------------------------------
// Firebase auth actions (thin wrappers, reused by the form controllers)
// ---------------------------------------------------------------------

/** Signs in with email + password. */
async function signInWithEmail(email, password) {
  const fb = await getFirebase();
  return fb.sdk.auth.signInWithEmailAndPassword(fb.auth, email, password);
}

/** Creates the account; caller then performs best-effort follow-ups. */
async function createUserAccount(email, password) {
  const fb = await getFirebase();
  return fb.sdk.auth.createUserWithEmailAndPassword(fb.auth, email, password);
}

/** Opens the Google popup and returns the signed-in user. */
async function signInWithGoogle() {
  const fb = await getFirebase();
  const provider = new fb.sdk.auth.GoogleAuthProvider();
  return fb.sdk.auth.signInWithPopup(fb.auth, provider);
}

/** Sends the verification email to the current user. */
async function sendVerificationEmail() {
  const fb = await getFirebase();
  if (!fb.auth.currentUser) return;
  await fb.sdk.auth.sendEmailVerification(fb.auth.currentUser);
}

/** Sends a password reset email. */
async function sendPasswordReset(email) {
  const fb = await getFirebase();
  await fb.sdk.auth.sendPasswordResetEmail(fb.auth, email);
}

/** Reloads the current user so emailVerified reflects the latest state. */
async function reloadCurrentUser() {
  const fb = await getFirebase();
  if (fb.auth.currentUser) await fb.auth.currentUser.reload();
  return fb.auth.currentUser;
}

// ---------------------------------------------------------------------
// Auth-aware navigation chrome
// ---------------------------------------------------------------------

/**
 * Fills the header's guest/user blocks once Firebase reports the real
 * session. Both blocks start hidden in markup so nothing flickers.
 */
function applyNavAuthState(user) {
  for (const guestBlock of qsa("[data-auth-guest]")) guestBlock.hidden = Boolean(user);
  for (const userBlock of qsa("[data-auth-user]")) userBlock.hidden = !user;
  if (user) {
    const name = user.displayName || user.email?.split("@")[0] || "";
    for (const nameNode of qsa("[data-auth-user-name]")) nameNode.textContent = name;
  }
}

// ---------------------------------------------------------------------
// Login / Register / Reset form controllers
// ---------------------------------------------------------------------

/** Wires the login form (data-auth-form="login"). */
function initLoginForm() {
  const form = qs('[data-auth-form="login"]');
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitLogin(form);
  });
  form.addEventListener("input", () => clearFormErrors(form));
}

async function submitLogin(form) {
  const values = validateForm(form);
  if (!values) return; // invalid: no Firebase call at all

  const button = qs("[data-auth-submit]", form);
  await withBusy(button, async () => {
    try {
      const { user } = await signInWithEmail(values.email, values.password);
      // Unverified users finish verification first; everyone else goes
      // straight to the dashboard.
      window.location.assign(user.emailVerified ? ROUTES.dashboard : ROUTES.verify);
    } catch (error) {
      showFormError(form, friendlyAuthError(error));
    }
  });
}

/** Wires the register form (data-auth-form="register"). */
function initRegisterForm() {
  const form = qs('[data-auth-form="register"]');
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitRegister(form);
  });
  form.addEventListener("input", () => clearFormErrors(form));
}

async function submitRegister(form) {
  const values = validateForm(form);
  if (!values) return;

  const button = qs("[data-auth-submit]", form);
  await withBusy(button, async () => {
    try {
      const { user } = await createUserAccount(values.email, values.password);
      const displayName = displayNameSafe(values.displayName);

      // Each follow-up is best-effort: set display name, send the
      // verification email, write the Firestore profile. One failing
      // must never block the others or the redirect to verify-email.
      const followUps = [
        user.updateProfile({ displayName }).catch(() => {}),
        sendVerificationEmail().catch(() => {}),
        ensureUserProfile(user).catch(() => {}),
      ];
      await Promise.allSettled(followUps);
      window.location.assign(ROUTES.verify);
    } catch (error) {
      showFormError(form, friendlyAuthError(error));
    }
  });
}

const displayNameSafe = (value) => String(value || "").trim().slice(0, 80);

/** Wires the Google buttons (shared by login + register pages). */
function initGoogleButtons() {
  for (const button of qsa("[data-google-auth]")) {
    button.addEventListener("click", async () => {
      await withBusy(button, async () => {
        try {
          const { user } = await signInWithGoogle();
          // First Google sign-in creates the profile; a returning user's
          // profile is patched, never recreated.
          await ensureUserProfile(user).catch(() => {});
          window.location.assign(user.emailVerified ? ROUTES.dashboard : ROUTES.verify);
        } catch (error) {
          if (error?.code !== "auth/popup-closed-by-user" && error?.code !== "auth/cancelled-popup-request") {
            toast(friendlyAuthError(error), "error");
          }
        }
      });
    });
  }
}

/** Wires the inline forgot-password panel on the login page. */
function initForgotPassword() {
  const trigger = qs("[data-forgot-trigger]");
  const loginView = qs("[data-login-view]");
  const resetView = qs("[data-reset-view]");
  if (!trigger || !loginView || !resetView) return;

  const showReset = (show) => {
    loginView.hidden = show;
    resetView.hidden = !show;
  };

  trigger.addEventListener("click", () => showReset(true));
  const back = qs("[data-reset-back]");
  if (back) back.addEventListener("click", () => showReset(false));

  const form = qs("[data-reset-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const values = validateForm(form);
    if (!values) return;

    const button = qs("[data-auth-submit]", form);
    await withBusy(button, async () => {
      try {
        await sendPasswordReset(values.email);
        form.hidden = true;
        const sent = qs("[data-reset-sent]");
        if (sent) sent.hidden = false;
      } catch (error) {
        showFormError(form, friendlyAuthError(error));
      }
    });
  });
  form.addEventListener("input", () => clearFormErrors(form));
}

// ---------------------------------------------------------------------
// Verify-email page controller
// ---------------------------------------------------------------------

const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_STORAGE_KEY = "theapp.verify.resendAt";

/** Remaining cooldown in seconds for the resend button (0 = ready). */
function resendCooldownSeconds() {
  try {
    const sentAt = Number(sessionStorage.getItem(RESEND_STORAGE_KEY) || 0);
    const remaining = Math.ceil((sentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch (e) {
    return 0;
  }
}

/** Initializes the whole verify-email page (all data-verify-* hooks). */
function initVerifyPage() {
  const page = qs("[data-verify-page]");
  if (!page) return;

  const nodes = {
    loading: qs("[data-verify-loading]"),
    guest: qs("[data-verify-guest]"),
    pending: qs("[data-verify-pending]"),
    verified: qs("[data-verify-verified]"),
    email: qs("[data-verify-email]"),
    resendSent: qs("[data-verify-resend-sent]"),
    stillUnverified: qs("[data-verify-still-unverified]"),
    check: qs("[data-verify-check]"),
    resend: qs("[data-verify-resend]"),
  };

  // Guard: a signed-out visitor is sent to the login page.
  void waitForAuthState().then(({ user }) => {
    if (!user) {
      nodes.loading.hidden = true;
      nodes.guest.hidden = false;
      window.location.replace(ROUTES.login);
      return;
    }
    render(user);
  });

  function render(user) {
    nodes.loading.hidden = true;
    if (nodes.email) nodes.email.textContent = user.email || "";
    const verified = user.emailVerified;
    nodes.pending.hidden = verified;
    nodes.verified.hidden = !verified;
    if (!verified) updateResendButton();
  }

  function updateResendButton() {
    if (!nodes.resend) return;
    const seconds = resendCooldownSeconds();
    nodes.resend.disabled = seconds > 0;
    nodes.resend.textContent = seconds > 0 ? t("verify.resendIn", { seconds }) : t("verify.resend");
    if (seconds > 0) setTimeout(updateResendButton, 1000);
  }

  // "I verified my email" -> reload the account and re-read the flag.
  nodes.check?.addEventListener("click", async () => {
    await withBusy(nodes.check, async () => {
      const user = await reloadCurrentUser();
      if (user?.emailVerified) {
        render(user);
      } else {
        const warn = nodes.stillUnverified;
        if (warn) warn.hidden = false;
      }
    });
  });

  // Resend with a 60s cooldown persisted across reloads.
  nodes.resend?.addEventListener("click", async () => {
    await withBusy(nodes.resend, async () => {
      try {
        await sendVerificationEmail();
        try {
          sessionStorage.setItem(RESEND_STORAGE_KEY, String(Date.now()));
        } catch (e) {
          /* storage unavailable */
        }
        if (nodes.resendSent) nodes.resendSent.hidden = false;
      } catch (error) {
        toast(friendlyAuthError(error), "error");
      }
    });
    // Runs AFTER withBusy's cleanup, so the cooldown's disabled state
    // (and its countdown timer) is not clobbered by the busy reset.
    updateResendButton();
  });
}

// ---------------------------------------------------------------------
// Route guards (reused by every protected page)
// ---------------------------------------------------------------------

/**
 * Login/register pages call this: a signed-in visitor is bounced away
 * (to email verification when unverified, to the dashboard otherwise).
 */
async function redirectIfAuthenticated() {
  const { user } = await waitForAuthState();
  if (user) {
    window.location.replace(user.emailVerified ? ROUTES.dashboard : ROUTES.verify);
  }
}

/**
 * Protected pages call this. Resolves with the signed-in user, or
 * redirects to the login page and resolves null.
 */
async function requireAuth() {
  const { user } = await waitForAuthState();
  if (!user) {
    window.location.replace(ROUTES.login);
  }
  return user || null;
}

/** Wires every [data-auth-logout] button on the page. */
function initLogoutButtons() {
  for (const button of qsa("[data-auth-logout]")) {
    button.addEventListener("click", async () => {
      await signOutEverywhere();
      window.location.assign(ROUTES.home);
    });
  }
}

// ---------------------------------------------------------------------
// Entry point (called from main.js on every page)
// ---------------------------------------------------------------------

/**
 * Boots auth UI for the current page: nav state, logout buttons, the
 * login/register/reset/verify controllers (whichever hooks exist).
 */
async function initAuthUI() {
  // Nav auth state resolves once Firebase reports the real session.
  void waitForAuthState().then(({ user }) => applyNavAuthState(user));

  initLogoutButtons();
  initLoginForm();
  initRegisterForm();
  initGoogleButtons();
  initForgotPassword();
  initVerifyPage();

  // When the SDK cannot be loaded at all (missing config or blocked CDN),
  // the auth pages show their "not configured" notice instead of forms
  // that can never succeed.
  const fb = await getFirebase();
  if (!fb) {
    const notice = qs("[data-auth-notice]");
    const panel = qs("[data-auth-panel]");
    if (notice && panel) {
      notice.hidden = false;
      panel.hidden = true;
    }
  }
}

export {
  initAuthUI,
  requireAuth,
  redirectIfAuthenticated,
  friendlyAuthError,
  signInWithEmail,
  sendPasswordReset,
  reloadCurrentUser,
};
