// =====================================================================
// Admin Overview Controller (admin/dashboard.html)
// =====================================================================
// Dashboard cards — Users, Total content, per-category counts (Games /
// Apps / Websites / Offers) and the three review states (pending /
// approved / rejected) — computed with Firestore count aggregations
// (cheap, no document reads), plus the latest pending submissions for
// one-click review.
// =====================================================================

import { t, onLocaleChange } from "../../i18n.js";
import { qs, renderState, el } from "../../ui.js";
import { formatMoney, formatDateTime } from "../../format.js";
import { fetchOverviewCounts } from "../../services/admin-service.js";
import { fetchSubmissions } from "../../services/submissions-service.js";

// ---------------------------------------------------------------------
// Stat cards (nine: users, content, 4 categories, 3 review states)
// ---------------------------------------------------------------------

async function renderCounts() {
  const hooks = {
    users: qs("[data-overview-users]"),
    content: qs("[data-overview-content]"),
    games: qs("[data-overview-games]"),
    apps: qs("[data-overview-apps]"),
    websites: qs("[data-overview-websites]"),
    offers: qs("[data-overview-offers]"),
    pending: qs("[data-overview-pending]"),
    approved: qs("[data-overview-approved]"),
    rejected: qs("[data-overview-rejected]"),
  };
  for (const node of Object.values(hooks)) node.textContent = "…";

  try {
    const counts = await fetchOverviewCounts();
    for (const [key, node] of Object.entries(hooks)) {
      node.textContent = String(counts[key] ?? 0);
    }
  } catch (error) {
    for (const node of Object.values(hooks)) node.textContent = "—";
    console.error("[admin:overview] counts failed", error);
  }
}

// ---------------------------------------------------------------------
// Latest pending submissions
// ---------------------------------------------------------------------

async function renderPendingList() {
  const list = qs("[data-overview-pending-list]");
  const statusArea = qs("[data-overview-pending-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let submissions;
  try {
    submissions = await fetchSubmissions("pending", 5);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderPendingList,
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!submissions.length) {
    renderState(statusArea, "empty", {
      title: t("admin.overview.emptyPendingTitle"),
      body: t("admin.overview.emptyPendingBody"),
    });
    return;
  }

  const template = qs("#admin-pending-row-template");
  for (const submission of submissions) {
    const row = template.content.firstElementChild.cloneNode(true);
    qs("[data-pr-user]", row).textContent = submission.userName || submission.email || "—";
    qs("[data-pr-offer]", row).textContent = submission.offerTitle || "—";
    qs("[data-pr-task]", row).textContent = submission.taskTitle || "—";
    qs("[data-pr-reward]", row).textContent = formatMoney(submission.rewardSnapshot);
    qs("[data-pr-date]", row).textContent = formatDateTime(submission.createdAt);
    list.append(row);
  }
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  await renderCounts();
  await renderPendingList();
  onLocaleChange(() => {
    void renderCounts();
    void renderPendingList();
  });
}

export { init };
