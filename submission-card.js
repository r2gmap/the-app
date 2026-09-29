// =====================================================================
// Submission Card Component (shared renderer)
// =====================================================================
// Renders one task-submission card by cloning the
// <template id="submission-card-template"> that both the dashboard and
// the "My submissions" page include. Status-aware: badges, rejection
// reasons and proof thumbnails appear only when relevant.
// =====================================================================

import { t, getLocale } from "../i18n.js";
import { formatMoney, formatDateTime } from "../format.js";
import { qs, el } from "../ui.js";

// ---------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------

/** Badge class + localized label for a submission status. */
function statusMeta(status) {
  const map = {
    pending: { class: "badge--pending", key: "status.pending" },
    approved: { class: "badge--approved", key: "status.approved" },
    rejected: { class: "badge--rejected", key: "status.rejected" },
  };
  return map[status] || map.pending;
}

// ---------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------

/**
 * Renders one submission card into `container`.
 * The template must exist on the page (see dashboard.html /
 * submissions.html).
 */
function renderSubmissionCard(container, submission) {
  const template = qs("#submission-card-template");
  if (!template) return null;

  const card = template.content.firstElementChild.cloneNode(true);
  const locale = getLocale();

  // --- status badge
  const badge = qs("[data-sub-status]", card);
  const meta = statusMeta(submission.status);
  badge.textContent = t(meta.key);
  badge.classList.add(meta.class);

  // --- core details
  qs("[data-sub-offer]", card).textContent = submission.offerTitle || "—";
  qs("[data-sub-task]", card).textContent = submission.taskTitle || "—";
  qs("[data-sub-reward]", card).textContent = formatMoney(submission.rewardSnapshot, locale);
  qs("[data-sub-date]", card).textContent = formatDateTime(submission.createdAt, locale);

  // --- rejection reason (rejected only)
  const reasonBlock = qs("[data-sub-reason-block]", card);
  if (submission.status === "rejected" && submission.rejectionReason) {
    reasonBlock.hidden = false;
    qs("[data-sub-reason]", card).textContent = submission.rejectionReason;
  }

  // --- proof thumbnails (open full-size in a new tab)
  const proofWrap = qs("[data-sub-proof]", card);
  for (const url of submission.proofImages || []) {
    const link = el("a", {
      class: "proof-thumb",
      href: url,
      target: "_blank",
      rel: "noopener",
      "data-i18n-title": "admin.submissions.openProof",
    });
    link.setAttribute("title", t("admin.submissions.openProof"));
    link.append(el("img", { src: url, alt: "", loading: "lazy" }));
    proofWrap.append(link);
  }

  container.append(card);
  return card;
}

export { renderSubmissionCard, statusMeta };
