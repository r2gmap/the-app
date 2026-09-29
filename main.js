// =====================================================================
// Main Entry Point — every page loads this one module
// =====================================================================
// Boot order matters:
//   1. translations are applied first (clears the i18n-pending cloak),
//   2. shared chrome (language switcher, mobile menu, auth nav),
//   3. the current page's controller is loaded dynamically from
//      body[data-page], so a page only ever downloads its own code.
//
// Firebase is NOT statically imported here — it loads inside
// firebase.js via dynamic import, so pages stay usable (translated,
// navigable) even when the Firebase CDN is unreachable.
// =====================================================================

import { applyTranslations, onLocaleChange } from "./i18n.js";
import { initNavigation } from "./navigation.js";
import { initAuthUI, redirectIfAuthenticated } from "./auth.js";

// ---------------------------------------------------------------------
// Page registry: body[data-page] -> controller module
// ---------------------------------------------------------------------

const PAGE_MODULES = {
  home: "./pages/home.js",
  dashboard: "./pages/dashboard.js",
  profile: "./pages/profile.js",
  offers: "./pages/offers.js",
  offer: "./pages/offer.js",
  // The three dedicated category pages share ONE controller, which
  // reads its category from body[data-category] (see pages/category.js).
  games: "./pages/category.js",
  apps: "./pages/category.js",
  websites: "./pages/category.js",
  wallet: "./pages/wallet.js",
  withdraw: "./pages/withdraw.js",
  notifications: "./pages/notifications.js",
  submissions: "./pages/submissions.js",
};

/** Loads and boots the current page's controller, when it has one. */
async function initCurrentPage() {
  const page = document.body.dataset.page;
  if (!page) return;

  // Guest-only pages bounce signed-in visitors away.
  if (page === "login" || page === "register") {
    void redirectIfAuthenticated();
    return;
  }

  const modulePath = PAGE_MODULES[page];
  if (!modulePath) return;
  try {
    const pageModule = await import(modulePath);
    await pageModule.init();
  } catch (error) {
    console.error(`[main] page controller "${page}" failed:`, error);
  }
}

// ---------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------

function boot() {
  applyTranslations(); // 1 — strings + RTL direction
  initNavigation(); // 2 — chrome
  void initAuthUI(); // 3 — nav auth state, forms, guards
  void initCurrentPage(); // 4 — page-specific behaviour
}

// Static markup (already translated once above) is re-applied when the
// visitor switches language; dynamic lists re-render via each page's
// own onLocaleChange subscription.
onLocaleChange(() => applyTranslations());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
