// =====================================================================
// Landing Page Controller (index.html)
// =====================================================================
// Owns the content sections of the landing page:
//   1. Featured strip — admin-featured PUBLISHED content (hidden
//      entirely while nothing is featured, so the page never shows
//      an empty marketing section)
//   2. Category groups — Games / Apps / Websites / Offers, each fed
//      by its own Firestore category and linking to its own page
//   - falls back to the demo catalogue while nothing is published
//   - re-renders when the visitor switches language
// The hero "demo" card art is generated locally (no network).
// =====================================================================

import { waitForAuthState } from "../firebase.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, qsa, renderState } from "../ui.js";
import { renderOfferCard, demoOffers, generatedCoverStyle, CATEGORIES } from "../offers.js";
import { fetchActiveOffers, fetchFeaturedOffers } from "../services/offers-service.js";

// ---------------------------------------------------------------------
// Hero demo thumbnail (pure decoration, generated cover art)
// ---------------------------------------------------------------------

function paintHeroThumb() {
  const thumb = qs("[data-hero-thumb]");
  if (!thumb) return;
  thumb.setAttribute("style", generatedCoverStyle("game"));
}

// ---------------------------------------------------------------------
// Featured section (admin-curated content)
// ---------------------------------------------------------------------

let authed = false;

/**
 * Loads featured published content and paints the strip. The section
 * stays hidden unless at least one featured item exists — a homepage
 * never shows an empty marketing block.
 */
async function loadFeaturedSection() {
  const section = qs("[data-featured-section]");
  const statusArea = qs("[data-featured-status]");
  const grid = qs("[data-featured-grid]");
  if (!section || !grid) return;

  let featured;
  try {
    featured = await fetchFeaturedOffers(6);
  } catch (error) {
    // Unreachable SDK or failed query: keep the section hidden rather
    // than surfacing an error on the marketing page.
    section.hidden = true;
    return;
  }

  if (!featured.length) {
    section.hidden = true;
    return;
  }

  grid.replaceChildren();
  for (const item of featured) renderOfferCard(grid, item, { authed, linkToDetails: true });
  statusArea.replaceChildren();
  section.hidden = false;
}

// ---------------------------------------------------------------------
// Category groups section
// ---------------------------------------------------------------------

/** Loads published content and paints the category groups; retried by the error state. */
async function loadOffersSection() {
  const statusArea = qs("[data-offers-status]");
  const groupsWrap = qs("[data-offers-groups]");
  const demoBadge = qs("[data-offers-demo-badge]");
  const notice = qs("[data-offers-notice]");
  if (!statusArea || !groupsWrap) return;

  renderState(statusArea, "loading", { title: t("offers.loading") });
  groupsWrap.hidden = true;

  let offers;
  try {
    offers = await fetchActiveOffers();
  } catch (error) {
    if (error?.message === "firebase-unavailable") {
      // SDK unreachable (offline / blocked CDN): fall back to the demo
      // catalogue, clearly badged, instead of an error wall.
      offers = [];
    } else {
      renderState(statusArea, "error", {
        title: t("offers.errorTitle"),
        body: t("offers.errorBody"),
        retry: loadOffersSection,
        retryLabel: t("common.retry"),
      });
      return;
    }
  }

  // Nothing published yet -> demo catalogue with a clear "demo" badge.
  const usingDemo = offers.length === 0;
  if (usingDemo) offers = demoOffers();
  if (demoBadge) demoBadge.hidden = !usingDemo;
  if (notice) notice.hidden = !usingDemo;

  // Split by category into the page's groups (all four categories).
  const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, []]));
  for (const offer of offers) {
    if (byCategory[offer.category]) byCategory[offer.category].push(offer);
  }

  let anyRendered = false;
  for (const grid of qsa("[data-offers-grid]")) {
    const category = grid.dataset.offersGrid;
    grid.replaceChildren();
    const group = grid.closest(".offer-group");
    for (const offer of byCategory[category] || []) {
      renderOfferCard(grid, offer, { authed, linkToDetails: !usingDemo });
    }
    const count = (byCategory[category] || []).length;
    // Hide a whole group when its category is empty (e.g. no websites).
    if (group) group.hidden = count === 0;
    if (count) anyRendered = true;

    const countNode = grid.parentElement?.querySelector("[data-offers-count]");
    if (countNode) countNode.textContent = String(count);
  }

  statusArea.replaceChildren();
  groupsWrap.hidden = !anyRendered;
  if (!anyRendered) {
    renderState(statusArea, "empty", { title: t("offers.emptyTitle"), body: t("offers.emptyBody") });
  }
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  paintHeroThumb();

  // Wait for the real session so card CTAs point to the right place
  // (offer details for signed-in visitors, register for guests).
  const { user } = await waitForAuthState();
  authed = Boolean(user);
  void loadFeaturedSection(); // 1 — curated strip (self-hiding)
  await loadOffersSection(); // 2 — category groups

  // Language switch re-renders cards (localized titles + money format).
  onLocaleChange(() => {
    void loadFeaturedSection();
    void loadOffersSection();
  });
}

export { init };
