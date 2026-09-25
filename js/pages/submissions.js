// =====================================================================
// My Submissions Page Controller (submissions.html)
// =====================================================================
// The user's complete submission history with statuses, rewards,
// rejection reasons and proof thumbnails — rendered through the shared
// submission-card component (same card as the dashboard).
// =====================================================================

import { requireAuth } from "../auth.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, renderState, el } from "../ui.js";
import { fetchUserSubmissions } from "../services/submissions-service.js";
import { renderSubmissionCard } from "../components/submission-card.js";

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

async function renderSubmissions(user) {
  const list = qs("[data-submissions-list]");
  const statusArea = qs("[data-submissions-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let submissions;
  try {
    submissions = await fetchUserSubmissions(user.uid);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: () => renderSubmissions(user),
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!submissions.length) {
    const block = renderState(statusArea, "empty", {
      title: t("submissions.emptyTitle"),
      body: t("submissions.emptyBody"),
    });
    block.append(el("a", { class: "btn btn--primary btn--sm", href: "offers.html" }, t("submissions.emptyCta")));
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
  if (!user) return;

  await renderSubmissions(user);
  onLocaleChange(() => void renderSubmissions(user));
}

export { init };
