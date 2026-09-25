// =====================================================================
// Offers Browser Controller (offers.html)
// =====================================================================
// Category tabs (All / Games / Apps / Websites) + responsive grid of
// active offers, with loading / empty / error states. The initial tab
// can be deep-linked with a hash (#games, #apps, #websites) so the
// dashboard's quick actions land directly on a category.
// =====================================================================

import { waitForAuthState } from "../firebase.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, qsa, renderState } from "../ui.js";
import { renderOfferCard, demoOffers } from "../offers.js";
import { fetchActiveOffers } from "../services/offers-service.js";

let authed = false;
let activeCategory = "all";

// ---------------------------------------------------------------------
// Data loading + rendering
// ---------------------------------------------------------------------

async function renderOffers() {
  const grid = qs("[data-offers-grid-page]");
  const statusArea = qs("[data-offers-status-page]");
  renderState(statusArea, "loading", { title: t("offersPage.loading") });
  grid.replaceChildren();

  let offers;
  let sdkUnavailable = false;
  try {
    offers = await fetchActiveOffers(activeCategory === "all" ? null : activeCategory, 60);
  } catch (error) {
    if (error?.message === "firebase-unavailable") {
      sdkUnavailable = true; // blocked CDN/offline -> demo fallback below
      offers = [];
    } else {
      renderState(statusArea, "error", {
        title: t("offersPage.errorTitle"),
        body: t("offersPage.errorBody"),
        retry: renderOffers,
        retryLabel: t("common.retry"),
      });
      return;
    }
  }

  // Demo catalogue while nothing is published (all-tab), or whenever
  // the SDK itself is unreachable (filtered to the active category).
  const usingDemo =
    sdkUnavailable || (offers.length === 0 && activeCategory === "all");
  if (usingDemo) {
    offers = demoOffers().filter(
      (offer) => activeCategory === "all" || offer.category === activeCategory,
    );
  }

  if (!offers.length) {
    renderState(statusArea, "empty", {
      title: t("offersPage.emptyTitle"),
      body: t("offersPage.emptyBody"),
    });
    return;
  }

  for (const offer of offers) {
    renderOfferCard(grid, offer, { authed, linkToDetails: !usingDemo });
  }
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Category tabs
// ---------------------------------------------------------------------

function initTabs() {
  const tabs = qsa("[data-category-tab]");
  if (!tabs.length) return;

  // Initial category from the URL hash (deep links from the homepage
  // groups and the dashboard quick actions), e.g. #games -> "game".
  const hash = window.location.hash.replace("#", "");
  if (["games", "apps", "websites", "offers"].includes(hash)) activeCategory = hash.replace(/s$/, "");

  const syncTabs = () => {
    for (const tab of tabs) {
      tab.setAttribute("aria-pressed", String(tab.dataset.categoryTab === activeCategory));
      tab.classList.toggle("tab__btn--active", tab.dataset.categoryTab === activeCategory);
    }
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      activeCategory = tab.dataset.categoryTab;
      syncTabs();
      void renderOffers();
    });
  }
  syncTabs();
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  initTabs();
  const { user } = await waitForAuthState();
  authed = Boolean(user);
  await renderOffers();
  onLocaleChange(() => void renderOffers());
}

export { init };
