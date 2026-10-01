// =====================================================================
// Admin Submission Review Controller
// =====================================================================
// Loads the protected review queue and adds approve/reject actions to
// the shared submission card. Firestore write logic stays in
// submissions-service.js so the admin UI never bypasses the existing
// Firebase rules or wallet transaction flow.
//
// Future review filters and moderation notes belong in this controller;
// the card template remains the single visual source for proof details.
// =====================================================================

import { t, getLocale, onLocaleChange } from "./i18n.js";
import { qs, qsa, el, renderState, confirmDialog, toast, withBusy } from "./ui.js";
import { formatMoney } from "./format.js";
import { renderSubmissionCard } from "./submission-card.js";
import { fetchSubmissions, approveSubmission, rejectSubmission } from "./submissions-service.js";

let activeFilter = "pending";
let adminUser = null;

async function renderQueue() {
  const list = qs("[data-admin-submissions-list]");
  const status = qs("[data-admin-submissions-status]");
  if (!list || !status) return;
  renderState(status, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let submissions;
  try {
    submissions = await fetchSubmissions(activeFilter === "all" ? null : activeFilter, 100);
  } catch (error) {
    renderState(status, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderQueue,
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!submissions.length) {
    renderState(status, "empty", {
      title: t("admin.submissions.emptyTitle"),
      body: t("admin.submissions.emptyBody"),
    });
    syncFilters();
    return;
  }

  for (const submission of submissions) {
    const card = renderSubmissionCard(list, submission);
    if (!card) continue;
    const actions = el("div", { class: "admin-review-actions" });
    if (submission.status === "pending") {
      const approve = el("button", { class: "btn btn--primary btn--sm", type: "button" }, t("admin.submissions.approve"));
      approve.addEventListener("click", () => void approveOne(submission, approve));
      const reject = el("button", { class: "btn btn--danger btn--sm", type: "button" }, t("admin.submissions.reject"));
      reject.addEventListener("click", () => void rejectOne(submission, reject));
      actions.append(approve, reject);
    }
    card.append(actions);
  }
  status.replaceChildren();
  syncFilters();
}

async function approveOne(submission, button) {
  const amount = formatMoney(submission.rewardSnapshot, getLocale());
  const confirmed = await confirmDialog({
    title: t("admin.submissions.approve"),
    body: t("admin.submissions.approveConfirm", { amount, name: submission.userName || submission.email || "this member" }),
    confirmLabel: t("admin.submissions.approve"),
    cancelLabel: t("common.cancel"),
  });
  if (!confirmed) return;
  await withBusy(button, async () => {
    try {
      await approveSubmission(submission, adminUser);
      toast(t("admin.submissions.approvedToast"), "success");
      await renderQueue();
    } catch (error) {
      console.error("[admin:submissions] approve failed", error);
      toast(t("admin.submissions.actionFailed"), "error");
    }
  });
}

async function rejectOne(submission, button) {
  const reason = window.prompt(t("admin.submissions.rejectReasonPlaceholder"), "");
  if (!reason?.trim()) {
    toast(t("admin.submissions.rejectReasonRequired"), "error");
    return;
  }
  await withBusy(button, async () => {
    try {
      await rejectSubmission(submission, reason, adminUser);
      toast(t("admin.submissions.rejectedToast"), "success");
      await renderQueue();
    } catch (error) {
      console.error("[admin:submissions] reject failed", error);
      toast(t("admin.submissions.actionFailed"), "error");
    }
  });
}

function syncFilters() {
  for (const button of qsa("[data-admin-submission-filter]")) {
    button.setAttribute("aria-pressed", String(button.dataset.adminSubmissionFilter === activeFilter));
    button.classList.toggle("tab__btn--active", button.dataset.adminSubmissionFilter === activeFilter);
  }
}

function initFilters() {
  for (const button of qsa("[data-admin-submission-filter]")) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.adminSubmissionFilter || "pending";
      void renderQueue();
    });
  }
  syncFilters();
}

async function init(user) {
  adminUser = user;
  initFilters();
  await renderQueue();
  onLocaleChange(() => void renderQueue());
}

export { init };
