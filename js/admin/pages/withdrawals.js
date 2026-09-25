// =====================================================================
// Admin Withdrawals Controller (admin/withdrawals.html)
// =====================================================================
// Review withdrawal requests:
//   - filter tabs (pending / approved / rejected / all)
//   - APPROVE -> confirm dialog (includes a live balance check warning)
//                then the atomic batch: request status + negative
//                transaction + user notification
//   - REJECT  -> reason dialog -> status + user notification
// Telegram pings fire best-effort after both decisions.
// =====================================================================

import { t, onLocaleChange } from "../../i18n.js";
import { qs, qsa, renderState, toast, withBusy, confirmDialog } from "../../ui.js";
import { formatMoney, formatDateTime } from "../../format.js";
import { fetchWithdrawals, approveWithdrawal, rejectWithdrawal } from "../../services/withdrawals-service.js";
import { computeUserBalance } from "../../services/wallet-service.js";
import { statusMeta } from "../../components/submission-card.js";

let activeFilter = "pending";
let adminUser = null;
let rejectingWithdrawal = null;

// ---------------------------------------------------------------------
// List + filters
// ---------------------------------------------------------------------

async function renderWithdrawals() {
  const list = qs("[data-admin-withdrawals-list]");
  const statusArea = qs("[data-admin-withdrawals-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let requests;
  try {
    requests = await fetchWithdrawals(activeFilter === "all" ? null : activeFilter);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderWithdrawals,
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!requests.length) {
    renderState(statusArea, "empty", {
      title: t("admin.withdrawals.emptyTitle"),
      body: t("admin.withdrawals.emptyBody"),
    });
    return;
  }

  const template = qs("#admin-withdrawal-row-template");
  for (const request of requests) {
    const row = template.content.firstElementChild.cloneNode(true);
    const meta = statusMeta(request.status);

    const badge = qs("[data-wr-status]", row);
    badge.textContent = t(meta.key);
    badge.classList.add(meta.class);

    qs("[data-wr-user]", row).textContent = request.userName || "—";
    qs("[data-wr-email]", row).textContent = request.email || "—";
    qs("[data-wr-amount]", row).textContent = formatMoney(request.amount);
    qs("[data-wr-wallet]", row).textContent = request.walletNumber || "—";
    qs("[data-wr-date]", row).textContent = formatDateTime(request.createdAt);

    if (request.status === "rejected" && request.rejectionReason) {
      const block = qs("[data-wr-reason-block]", row);
      block.hidden = false;
      qs("[data-wr-reason]", row).textContent = request.rejectionReason;
    }

    // Review actions exist only while pending.
    const actions = qs("[data-wr-actions]", row);
    actions.hidden = request.status !== "pending";
    if (!actions.hidden) {
      qs("[data-wr-approve]", row).addEventListener("click", () => void approve(request));
      qs("[data-wr-reject]", row).addEventListener("click", () => openRejectDialog(request));
    }

    list.append(row);
  }
  statusArea.replaceChildren();
}

/** Wires the status filter tabs (all / pending / approved / rejected). */
function initFilters() {
  for (const tab of qsa("[data-withdrawals-filter]")) {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.withdrawalsFilter;
      for (const other of qsa("[data-withdrawals-filter]")) {
        other.setAttribute("aria-pressed", String(other === tab));
        other.classList.toggle("tab__btn--active", other === tab);
      }
      void renderWithdrawals();
    });
  }
}

// ---------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------

async function approve(request) {
  // Live balance check so the admin sees shortfalls before approving.
  let balanceWarning = "";
  try {
    const balance = await computeUserBalance(request.userId);
    if (balance < Math.abs(request.amount) - 0.001) {
      balanceWarning = "\n" + t("admin.withdrawals.insufficientBalance", { balance: formatMoney(balance) });
    }
  } catch (error) {
    /* balance unknown — proceed, the admin decides */
  }

  const confirmed = await confirmDialog({
    title: t("admin.withdrawals.approve"),
    body:
      t("admin.withdrawals.approveConfirm", {
        amount: formatMoney(request.amount),
        name: request.userName || request.email,
      }) + balanceWarning,
    confirmLabel: t("admin.withdrawals.approve"),
  });
  if (!confirmed) return;

  await withBusy(null, async () => {
    try {
      await approveWithdrawal(request, adminUser);
      toast(t("admin.withdrawals.approvedToast"), "success");
      await renderWithdrawals();
    } catch (error) {
      console.error("[admin:withdrawals] approve failed", error);
      toast(t("admin.withdrawals.actionFailed"), "error");
    }
  });
}

/** Opens the reject dialog for one withdrawal request. */
function openRejectDialog(request) {
  rejectingWithdrawal = request;
  const dialog = qs("[data-withdraw-reject-dialog]");
  qs("[data-withdraw-reject-reason]", dialog).value = "";
  qs("[data-withdraw-reject-error]", dialog).textContent = "";
  dialog.showModal();
}

/** Wires the shared reject dialog (reason textarea + confirm). */
function initRejectDialog() {
  const dialog = qs("[data-withdraw-reject-dialog]");
  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = qs("[data-withdraw-reject-reason]", dialog).value.trim();
    const errorNode = qs("[data-withdraw-reject-error]", dialog);
    if (!reason) return (errorNode.textContent = t("admin.withdrawals.rejectReasonRequired"));

    await withBusy(dialog.querySelector("button[type=submit]"), async () => {
      try {
        await rejectWithdrawal(rejectingWithdrawal, reason, adminUser);
        dialog.close();
        toast(t("admin.withdrawals.rejectedToast"), "success");
        await renderWithdrawals();
      } catch (error) {
        console.error("[admin:withdrawals] reject failed", error);
        toast(t("admin.withdrawals.actionFailed"), "error");
      }
    });
  });
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init(contextAdminUser) {
  adminUser = contextAdminUser;
  initFilters();
  initRejectDialog();
  await renderWithdrawals();
  onLocaleChange(() => void renderWithdrawals());
}

export { init };
