// =====================================================================
// Admin Panel Entry Point — protected admin shell
// =====================================================================
// Responsibilities:
//   1. translations + shared chrome (language switcher, mobile menu);
//   2. backend-config admin login (email/password only, never Google);
//   3. Firebase custom-token session persistence;
//   4. role-based route guard for every protected admin page;
//   5. dynamic import of the current page controller.
//
// The backend validates the configured ADMIN_EMAIL and ADMIN_PASSWORD.
// Firestore rules remain the final authorization boundary and require
// users/{uid}.role == "admin" for data and Storage access.
// =====================================================================

import { applyTranslations, t, onLocaleChange } from "./i18n.js";
import { initNavigation } from "./navigation.js";
import { getFirebase, waitForAuthState, signOutEverywhere } from "./firebase.js";
import { qs, qsa, withBusy } from "./ui.js";
import { isAdminUser, requestAdminSession } from "./admin-service.js";

const ADMIN_LOGIN_ROUTE = "login";

// =====================================================================
// Page registry
// =====================================================================

const ADMIN_PAGES = {
  overview: "./overview.js",
  content: "./content.js",
  "content-form": "./content-form.js",
  submissions: "./admin-submissions.js",
  users: "./users.js",
  wallet: "./admin-wallet.js",
  withdrawals: "./withdrawals.js",
  support: "./admin-support.js",
};

// =====================================================================
// Admin login — backend credentials + Firebase session
// =====================================================================

function adminLoginError(error) {
  switch (error?.code) {
    case "invalid_credentials":
      return t("admin.login.invalidCredentials");
    case "server_not_configured":
      return t("admin.login.serverNotConfigured");
    case "admin-network-failed":
    case "auth/network-request-failed":
      return t("admin.login.networkFailed");
    case "admin_disabled":
      return t("admin.login.disabled");
    case "auth/operation-not-allowed":
      return t("admin.login.providerFailed");
    default:
      return t("admin.login.genericFailed");
  }
}

/**
 * Explicitly selects local Firebase Auth persistence so a successful
 * backend-issued admin session survives page navigation and reloads.
 */
async function signInWithAdminToken(token) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { browserLocalPersistence, setPersistence, signInWithCustomToken } = fb.sdk.auth;
  await setPersistence(fb.auth, browserLocalPersistence);
  return signInWithCustomToken(fb.auth, token);
}

function initAdminLoginPage() {
  const form = qs("[data-admin-login-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAdminLogin(form);
  });

  // A returning administrator should not see the credential form again.
  void redirectExistingAdmin();
}

async function redirectExistingAdmin() {
  const authState = await waitForAuthState();
  if (!authState.user) return;
  try {
    if (await isAdminUser(authState.user.uid)) {
      window.location.replace("dashboard.html");
    } else {
      await signOutEverywhere();
    }
  } catch (error) {
    await signOutEverywhere().catch(() => {});
  }
}

/** Handles backend login, token exchange, and the profile authorization check. */
async function submitAdminLogin(form) {
  const errorNode = qs("[data-admin-login-error]", form);
  const emailNode = qs("[data-admin-identifier]", form);
  const passwordNode = qs("[data-admin-password]", form);
  const email = emailNode?.value.trim() || "";
  const password = passwordNode?.value || "";
  errorNode.textContent = "";

  if (!email || !password) {
    errorNode.textContent = t("auth.errors.fieldRequired");
    return;
  }

  const submitButton = qs("button[type=submit]", form);
  await withBusy(submitButton, async () => {
    const label = qs(".btn__label", submitButton);
    if (label) label.textContent = t("admin.login.checking");
    try {
      // The backend compares these values with Secret Manager config and
      // returns only a short-lived Firebase custom token.
      const token = await requestAdminSession(email, password);
      await signInWithAdminToken(token);

      const authState = await waitForAuthState();
      if (authState.error || !authState.user) throw new Error("admin-auth-state-unavailable");
      if (!(await isAdminUser(authState.user.uid))) {
        await signOutEverywhere().catch(() => {});
        errorNode.textContent = t("admin.login.notAdmin");
        return;
      }
      window.location.replace("dashboard.html");
    } catch (error) {
      await signOutEverywhere().catch(() => {});
      errorNode.textContent = error?.message === "admin-auth-state-unavailable"
        ? t("admin.login.profileCheckFailed")
        : adminLoginError(error);
    }
  });
}

// =====================================================================
// Route guard — every protected admin page uses the same gate
// =====================================================================

/** Resolves with the signed-in admin or redirects before page data loads. */
async function requireAdmin() {
  try {
    const authState = await waitForAuthState();
    if (authState.error || !authState.user) {
      window.location.replace(ADMIN_LOGIN_ROUTE);
      return null;
    }

    const admin = await isAdminUser(authState.user.uid);
    if (!admin) {
      await signOutEverywhere().catch(() => {});
      window.location.replace(ADMIN_LOGIN_ROUTE);
      return null;
    }
    return authState.user;
  } catch (error) {
    await signOutEverywhere().catch(() => {});
    window.location.replace(ADMIN_LOGIN_ROUTE);
    return null;
  }
}

// =====================================================================
// Admin shell chrome
// =====================================================================

function initAdminShell(adminUser) {
  for (const node of qsa("[data-admin-user-name]")) {
    node.textContent = adminUser.displayName || adminUser.email || "";
  }
  for (const node of qsa("[data-admin-user-email]")) {
    node.textContent = adminUser.email || "";
  }
  for (const button of qsa("[data-admin-logout]")) {
    button.addEventListener("click", async () => {
      await signOutEverywhere();
      window.location.assign(ADMIN_LOGIN_ROUTE);
    });
  }

  const navTrigger = qs("[data-admin-nav-trigger]");
  navTrigger?.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    navTrigger.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.body.classList.remove("menu-open");
  });

  const page = document.body.dataset.adminPage;
  for (const link of qsa("[data-admin-nav-link]")) {
    const section = link.dataset.adminNavLink;
    const active = page === section || page.startsWith(`${section}-`);
    if (active) link.setAttribute("aria-current", "page");
  }
}

// =====================================================================
// Bootstrap
// =====================================================================

async function boot() {
  applyTranslations();
  initNavigation();
  onLocaleChange(() => applyTranslations());

  const page = document.body.dataset.adminPage;
  if (page === "login") {
    initAdminLoginPage();
    return;
  }

  const adminUser = await requireAdmin();
  if (!adminUser) return;

  initAdminShell(adminUser);
  const modulePath = ADMIN_PAGES[page];
  if (!modulePath) return;
  try {
    const pageModule = await import(modulePath);
    await pageModule.init(adminUser);
  } catch (error) {
    console.error(`[admin] page controller "${page}" failed:`, error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  void boot();
}
