// =====================================================================
// Admin Panel Entry Point — every admin page loads this one module
// =====================================================================
// Responsibilities:
//   1. translations + shared chrome (language switcher, mobile menu)
//   2. the ADMIN LOGIN page (admin email + password — never Google)
//   3. role-based route guard: every admin page except login requires
//      users/{uid}.role == "admin", otherwise the visitor is signed
//      out and redirected to admin/login.html
//   4. dynamic import of the current page controller (body[data-admin-page])
// =====================================================================

import { applyTranslations, t, onLocaleChange } from "./i18n.js";
import { initNavigation } from "./navigation.js";
import { getFirebase, waitForAuthState, signOutEverywhere } from "./firebase.js";
import { qs, qsa, withBusy } from "./ui.js";
import { isAdminUser, resolveAdminIdentifier } from "./admin-service.js";
import { signInWithEmail } from "./auth.js";

// ---------------------------------------------------------------------
// Page registry (body[data-admin-page] -> controller module)
// ---------------------------------------------------------------------

const ADMIN_PAGES = {
  overview: "./overview.js",
  content: "./content.js", // content management list
  "content-form": "./content-form.js", // create / edit content
  submissions: "./admin-submissions.js",
  users: "./users.js",
  wallet: "./admin-wallet.js",
  withdrawals: "./withdrawals.js",
  support: "./admin-support.js",
};

// ---------------------------------------------------------------------
// Admin login page (no guard — this is the entry door)
// ---------------------------------------------------------------------

function initAdminLoginPage() {
  const form = qs("[data-admin-login-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAdminLogin(form);
  });
}

/** Handles the admin login form: resolve identifier -> sign in -> role check. */
async function submitAdminLogin(form) {
  const errorNode = qs("[data-admin-login-error]", form);
  errorNode.textContent = "";

  const identifier = qs("[data-admin-identifier]", form).value.trim();
  const password = qs("[data-admin-password]", form).value;
  if (!identifier || !password) {
    errorNode.textContent = t("auth.errors.fieldRequired");
    return;
  }

  await withBusy(qs("button[type=submit]", form), async () => {
    // The SDK must be reachable at all before any sign-in attempt.
    const fb = await getFirebase();
    if (!fb) {
      errorNode.textContent = t("auth.notConfiguredBody");
      return;
    }

    try {
      // The dedicated admin door accepts email only; role is checked
      // after Firebase authentication, never inferred from the identifier.
      const email = await resolveAdminIdentifier(identifier);
      if (!email) {
        errorNode.textContent = t("admin.login.notAdmin");
        return;
      }

      await signInWithEmail(email, password);

      // Do not trust the object returned by signIn alone. Re-read the
      // Firebase auth state, then use that UID for the Firestore role read.
      const authState = await waitForAuthState();
      if (authState.error || !authState.user) {
        throw new Error("admin-auth-state-unavailable");
      }

      // The role check is the real gate: a normal user who somehow
      // knows admin credentials is signed straight back out. A missing
      // profile and a non-admin profile intentionally share one message.
      const admin = await isAdminUser(authState.user.uid);
      if (!admin) {
        await signOutEverywhere().catch(() => {});
        errorNode.textContent = t("admin.login.notAdmin");
        return;
      }
      window.location.assign("dashboard.html");
    } catch (error) {
      // If Auth succeeded but the state/profile check failed, do not leave
      // a session behind on the login page. Signing out is harmless when
      // Firebase rejected the credentials before creating a session.
      await signOutEverywhere().catch(() => {});
      // Wrong password / unknown account / invalid credentials share one
      // message so the login page cannot be used for account enumeration.
      const nonEnumeratingCodes = new Set([
        "auth/invalid-credential",
        "auth/invalid-email",
        "auth/user-disabled",
        "auth/user-not-found",
        "auth/wrong-password",
      ]);
      errorNode.textContent = nonEnumeratingCodes.has(error?.code)
        ? t("admin.login.notAdmin")
        : t("auth.errors.generic");
    }
  });
}

// ---------------------------------------------------------------------
// Role-based route guard + admin shell
// ---------------------------------------------------------------------

/**
 * Ensures the current visitor is an admin. Returns the admin user, or
 * null after redirecting unauthorized visitors to the login page.
 */
async function requireAdmin() {
  try {
    const authState = await waitForAuthState();
    if (authState.error || !authState.user) {
      window.location.replace("login.html");
      return null;
    }

    const admin = await isAdminUser(authState.user.uid);
    if (!admin) {
      await signOutEverywhere().catch(() => {});
      window.location.replace("login.html");
      return null;
    }
    return authState.user;
  } catch (error) {
    // A denied/failed profile read must never leave the protected shell
    // running without a decision. Redirect with the same safe outcome as
    // a signed-out or non-admin visitor.
    await signOutEverywhere().catch(() => {});
    window.location.replace("login.html");
    return null;
  }
}

/** Fills the shell's user chip and wires logout + active nav link. */
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
      window.location.assign("login.html");
    });
  }

  // Mobile drawer trigger (CSS transforms the sidebar; see admin.css).
  const navTrigger = qs("[data-admin-nav-trigger]");
  navTrigger?.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    navTrigger.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.body.classList.remove("menu-open");
  });

  // Highlight the current section in the sidebar. Sub-pages (e.g.
  // content-form) highlight their parent section (content).
  const page = document.body.dataset.adminPage;
  for (const link of qsa("[data-admin-nav-link]")) {
    const section = link.dataset.adminNavLink;
    const active = page === section || page.startsWith(`${section}-`);
    if (active) link.setAttribute("aria-current", "page");
  }
}

// ---------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------

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
  if (!adminUser) return; // redirected

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
  boot();
}
