// =====================================================================
// User Dashboard Controller (dashboard.html)
// =====================================================================
// Sections (all render through page hooks, all with empty states):
//   1. Welcome hero    — avatar, name, welcome message
//   2. Statistics      — wallet balance, completed tasks, pending reviews
//   3. Featured        — up to 6 active offers from Firestore
//   4. Recent activity — the 5 latest submissions
//   5. Quick actions   — static links (games / apps / websites / profile)
// The whole page re-renders on language switch.
// =====================================================================

import { requireAuth } from "../auth.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, renderState, renderAvatar } from "../ui.js";
import { formatMoney } from "../format.js";
import { renderOfferCard } from "../offers.js";
import { renderSubmissionCard } from "../components/submission-card.js";
import { fetchActiveOffers, fetchFeaturedOffers } from "../services/offers-service.js";
import { computeUserBalance } from "../services/wallet-service.js";
import { countUserSubmissions, fetchUserSubmissions } from "../services/submissions-service.js";

// ---------------------------------------------------------------------
// Section 1 — Welcome hero
// ---------------------------------------------------------------------

function renderWelcome(user) {
  renderAvatar(qs("[data-dash-avatar]"), {
    photoURL: user.photoURL,
    displayName: user.displayName || user.email,
    size: "lg",
  });
  qs("[data-dash-name]").textContent = (user.displayName || user.email?.split("@")[0] || "").trim();
}

// ---------------------------------------------------------------------
// Section 2 — Statistics cards
// ---------------------------------------------------------------------

/** Loads the three numbers in parallel and paints them. */
async function renderStats(user) {
  const balanceNode = qs("[data-stat-balance]");
  const completedNode = qs("[data-stat-completed]");
  const pendingNode = qs("[data-stat-pending]");

  const [balance, completed, pending] = await Promise.all([
    computeUserBalance(user.uid).catch(() => null),
    countUserSubmissions(user.uid, "approved").catch(() => null),
    countUserSubmissions(user.uid, "pending").catch(() => null),
  ]);

  balanceNode.textContent = balance === null ? "—" : formatMoney(balance);
  completedNode.textContent = completed === null ? "—" : String(completed);
  pendingNode.textContent = pending === null ? "—" : String(pending);
}

// ---------------------------------------------------------------------
// Section 3 — Featured opportunities
// ---------------------------------------------------------------------

/**
 * Loads the featured strip: admin-featured content first, topped up
 * with the latest published content when fewer than six items are
 * featured, so the dashboard always shows real opportunities.
 */
async function renderFeatured() {
  const grid = qs("[data-dash-featured]");
  const statusArea = qs("[data-dash-featured-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  grid.replaceChildren();

  let offers;
  try {
    const [featured, latest] = await Promise.all([
      fetchFeaturedOffers(6),
      fetchActiveOffers(null, 6),
    ]);
    // Featured first, then latest published items that are not already
    // in the list (deduplicated by id), capped at six cards.
    const seen = new Set(featured.map((item) => item.id));
    offers = [...featured, ...latest.filter((item) => !seen.has(item.id))].slice(0, 6);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderFeatured,
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!offers.length) {
    renderState(statusArea, "empty", {
      title: t("dashboard.empty.featuredTitle"),
      body: t("dashboard.empty.featuredBody"),
    });
    return;
  }

  for (const offer of offers) renderOfferCard(grid, offer, { authed: true });
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Section 4 — Recent activity (latest submissions)
// ---------------------------------------------------------------------

async function renderActivity(user) {
  const list = qs("[data-dash-activity]");
  const statusArea = qs("[data-dash-activity-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let submissions;
  try {
    submissions = await fetchUserSubmissions(user.uid, 5);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: () => renderActivity(user),
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!submissions.length) {
    renderState(statusArea, "empty", {
      title: t("dashboard.empty.activityTitle"),
      body: t("dashboard.empty.activityBody"),
    });
    return;
  }

  for (const submission of submissions) renderSubmissionCard(list, submission);
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  const user = await requireAuth();
  if (!user) return; // redirected to login.html

  renderWelcome(user);
  void renderStats(user);
  void renderFeatured();
  void renderActivity(user);

  onLocaleChange(() => {
    renderWelcome(user);
    void renderStats(user);
    void renderFeatured();
    void renderActivity(user);
  });
}

export { init };
