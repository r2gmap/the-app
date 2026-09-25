// =====================================================================
// Admin Submissions Controller (admin/submissions.html)
// =====================================================================
// Review queue: filter by status, inspect every submission detail
// (user, offer, task, message, wallet number, proof images), then
//   - APPROVE -> atomic batch: status + wallet transaction + user
//     notification (the credited amount is re-read from the live offer)
//   - REJECT  -> reason dialog -> status + user notification
// Both actions also ping the admin Telegram group (best-effort).
// =====================================================================

import { t, onLocaleChange } from "../../i18n.js";
import { qs, qsa, el, renderState, toast, withBusy, confirmDialog } from "../../ui.js";
import { formatMoney, formatDateTime } from "../../format.js";
import { fetchSubmissions, approveSubmission, rejectSubmission } from "../../services/submissions-service.js";
import { statusMeta } from "../../components/submission-card.js";

let activeFilter = "pending";
let adminUser = null;
let rejectingSubmission = null;

// ---------------------------------------------------------------------
// List rendering + filters
// ---------------------------------------------------------------------

async function renderSubmissions() {
  const list = qs("[data-admin-submissions-list]");
  const statusArea = qs("[data-admin-submissions-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let submissions;
  try {
    submissions = await fetchSubmissions(activeFilter === "all" ? null : activeFilter);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderSubmissions,
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!submissions.length) {
    renderState(statusArea, "empty", {
      title: t("admin.submissions.emptyTitle"),
      body: t("admin.submissions.emptyBody"),
    });
    return;
  }

  const template = qs("#admin-submission-row-template");
  for (const submission of submissions) {
    list.append(buildSubmissionCard(template, submission));
  }
  statusArea.replaceChildren();
}

/** Builds one review card from the template and wires its actions. */
function buildSubmissionCard(template, submission) {
  const card = template.content.firstElementChild.cloneNode(true);
  const meta = statusMeta(submission.status);

  const badge = qs("[data-sr-status]", card);
  badge.textContent = t(meta.key);
  badge.classList.add(meta.class);

  qs("[data-sr-user]", card).textContent = submission.userName || "—";
  qs("[data-sr-email]", card).textContent = submission.email || "—";
  qs("[data-sr-offer]", card).textContent = submission.offerTitle || "—";
  qs("[data-sr-task]", card).textContent = submission.taskTitle || "—";
  qs("[data-sr-reward]", card).textContent = formatMoney(submission.rewardSnapshot);
  qs("[data-sr-wallet]", card).textContent = submission.walletNumber || "—";
  qs("[data-sr-date]", card).textContent = formatDateTime(submission.createdAt);
  qs("[data-sr-message]", card).textContent = submission.message || "—";

  // Proof thumbnails open full-size in a new tab.
  const proofWrap = qs("[data-sr-proof]", card);
  for (const url of submission.proofImages || []) {
    proofWrap.append(
      el("a", { class: "proof-thumb", href: url, target: "_blank", rel: "noopener" }, el("img", { src: url, alt: "", loading: "lazy" })),
    );
  }

  // Rejection reason (already reviewed rows).
  if (submission.status === "rejected" && submission.rejectionReason) {
    const block = qs("[data-sr-reason-block]", card);
    block.hidden = false;
    qs("[data-sr-reason]", card).textContent = submission.rejectionReason;
  }

  // Review actions only appear while the submission is pending.
  const actions = qs("[data-sr-actions]", card);
  actions.hidden = submission.status !== "pending";
  if (!actions.hidden) {
    qs("[data-sr-approve]", card).addEventListener("click", () => void approve(submission));
    qs("[data-sr-reject]", card).addEventListener("click", () => openRejectDialog(submission));
  }

  return card;
}

// ---------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------

async function approve(submission) {
  const confirmed = await confirmDialog({
    title: t("admin.submissions.approve"),
    body: t("admin.submissions.approveConfirm", {
      amount: formatMoney(submission.rewardSnapshot),
      name: submission.userName || submission.email,
    }),
    confirmLabel: t("admin.submissions.approve"),
  });
  if (!confirmed) return;

  await withBusy(null, async () => {
    try {
      await approveSubmission(submission, adminUser);
      toast(t("admin.submissions.approvedToast"), "success");
      await renderSubmissions();
    } catch (error) {
      console.error("[admin:submissions] approve failed", error);
      toast(t("admin.submissions.actionFailed"), "error");
    }
  });
}

/** Opens the shared reject dialog (a reason is required). */
function openRejectDialog(submission) {
  rejectingSubmission = submission;
  const dialog = qs("[data-reject-dialog]");
  const textarea = qs("[data-reject-reason]", dialog);
  textarea.value = "";
  const errorNode = qs("[data-reject-error]", dialog);
  errorNode.textContent = "";
  dialog.showModal();
}

/** Wires the shared reject dialog (reason textarea + confirm). */
function initRejectDialog() {
  const dialog = qs("[data-reject-dialog]");
  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = qs("[data-reject-reason]", dialog).value.trim();
    if (!reason) {
      qs("[data-reject-error]", dialog).textContent = t("admin.submissions.rejectReasonRequired");
      return;
    }
    await withBusy(dialog.querySelector("button[type=submit]"), async () => {
      try {
        await rejectSubmission(rejectingSubmission, reason, adminUser);
        dialog.close();
        toast(t("admin.submissions.rejectedToast"), "success");
        await renderSubmissions();
      } catch (error) {
        console.error("[admin:submissions] reject failed", error);
        toast(t("admin.submissions.actionFailed"), "error");
      }
    });
  });
}

// ---------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------

function initFilters() {
  for (const tab of qsa("[data-submissions-filter]")) {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.submissionsFilter;
      for (const other of qsa("[data-submissions-filter]")) {
        other.setAttribute("aria-pressed", String(other === tab));
        other.classList.toggle("tab__btn--active", other === tab);
      }
      void renderSubmissions();
    });
  }
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init(contextAdminUser) {
  adminUser = contextAdminUser;
  initFilters();
  initRejectDialog();
  await renderSubmissions();
  onLocaleChange(() => void renderSubmissions());
}

export { init };
