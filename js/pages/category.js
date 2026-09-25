// =====================================================================
// Category Browser Controller (games.html / apps.html / websites.html)
// =====================================================================
// One controller powers every dedicated category page. The page
// declares its category on the body element:
//
//   <body data-page="games" data-category="game">
//
// so adding a future category page is markup only — no new controller.
// Responsibilities:
//   - load PUBLISHED content for this category from Firestore,
//     display order first (set by the admin CMS)
//   - render cards through the shared offer-card template
//   - loading / empty / error states, re-render on language switch
// The "offers" category is served by offers.html (tabbed browser).
// =====================================================================

import { waitForAuthState } from "../firebase.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, renderState, el } from "../ui.js";
import { renderOfferCard, categoryLabelPlural } from "../offers.js";
import { fetchActiveOffers } from "../services/offers-service.js";

let authed = false;
let category = null; // "game" | "app" | "website"

// ---------------------------------------------------------------------
// Data loading + rendering
// ---------------------------------------------------------------------

/** Loads the category's published content and paints the grid. */
async function renderCategory() {
  const grid = qs("[data-category-grid]");
  const statusArea = qs("[data-category-status]");
  if (!grid || !category) return;

  renderState(statusArea, "loading", { title: t("common.loading") });
  grid.replaceChildren();

  let items;
  try {
    items = await fetchActiveOffers(category, 60);
  } catch (error) {
    if (error?.message === "firebase-unavailable") {
      // SDK unreachable (offline / blocked CDN): show the honest empty
      // state instead of an error wall — the page stays usable.
      items = [];
    } else {
      renderState(statusArea, "error", {
        title: t("common.errorTitle"),
        body: t("common.errorBody"),
        retry: renderCategory,
        retryLabel: t("common.retry"),
      });
      return;
    }
  }

  // Professional empty state: names the category (e.g. "No Games
  // available right now"), explains what's coming, and links onward.
  if (!items.length) {
    renderState(statusArea, "empty", {
      title: t("categoryPage.emptyTitle", { category: categoryLabelPlural(category) }),
      body: t("categoryPage.emptyBody"),
    });
    statusArea.firstElementChild?.append(
      el("a", { class: "btn btn--secondary", href: "offers.html" }, t("offers.browseAll")),
    );
    return;
  }

  for (const item of items) renderOfferCard(grid, item, { authed });
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  // The category comes from the page itself (see banner comment).
  category = document.body.dataset.category || "game";

  // Wait for the real session so card CTAs point to the right place
  // (content details for signed-in visitors, register for guests).
  const { user } = await waitForAuthState();
  authed = Boolean(user);
  await renderCategory();

  // Language switch re-renders cards (localized titles + money format).
  onLocaleChange(() => void renderCategory());
}

export { init };
