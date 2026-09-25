// =====================================================================
// Admin Panel Entry Point — every admin page loads this one module
// =====================================================================
// Responsibilities:
//   1. translations + shared chrome (language switcher, mobile menu)
//   2. the ADMIN LOGIN page (email/username + password — never Google)
//   3. role-based route guard: every admin page except login requires
//      users/{uid}.role == "admin", otherwise the visitor is signed
//      out and redirected to admin/login.html
//   4. dynamic import of the current page controller (body[data-admin-page])
// =====================================================================

import { applyTranslations, t, onLocaleChange } from "../i18n.js";
import { initNavigation } from "../navigation.js";
import { getFirebase, waitForAuthState, signOutEverywhere } from "../firebase.js";
import { qs, qsa, withBusy } from "../ui.js";
import { isAdminUser, resolveAdminIdentifier } from "../services/admin-service.js";
import { signInWithEmail } from "../auth.js";

// ---------------------------------------------------------------------
// Page registry (body[data-admin-page] -> controller module)
// ---------------------------------------------------------------------

const ADMIN_PAGES = {
  overview: "./pages/overview.js",
  content: "./pages/content.js", // content management list
  "content-form": "./pages/content-form.js", // create / edit content
  submissions: "./pages/submissions.js",
  users: "./pages/users.js",
  wallet: "./pages/wallet.js",
  withdrawals: "./pages/withdrawals.js",
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
      // Username -> email resolution via `adminUsernames` aliases.
      const email = await resolveAdminIdentifier(identifier);
      if (!email) {
        errorNode.textContent = t("admin.login.notAdmin");
        return;
      }

      const { user } = await signInWithEmail(email, password);

      // The role check is the real gate: a normal user who somehow
      // knows admin credentials is signed straight back out.
      const admin = await isAdminUser(user.uid);
      if (!admin) {
        await signOutEverywhere();
        errorNode.textContent = t("admin.login.notAdmin");
        return;
      }

      window.location.assign("dashboard.html");
    } catch (error) {
      // Wrong password / unknown account share one message (no probing).
      const key = error?.code === "auth/user-not-found" || error?.code === "auth/wrong-password"
        ? "admin.login.notAdmin"
        : null;
      errorNode.textContent = key ? t(key) : t("auth.errors.generic");
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
  const { user } = await waitForAuthState();
  if (!user) {
    window.location.replace("login.html");
    return null;
  }
  const admin = await isAdminUser(user.uid);
  if (!admin) {
    await signOutEverywhere();
    window.location.replace("login.html");
    return null;
  }
  return user;
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
