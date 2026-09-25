// =====================================================================
// Withdraw Page Controller (withdraw.html)
// =====================================================================
// Withdrawal request form (amount + wallet number) with live
// available-balance feedback, plus the user's request history below.
//
// Validation layers:
//   1. client (here)  — required fields, minimum, available balance
//   2. admin review   — the real gate; a request never moves money
//   3. firestore.rules — only the owner can create their own request
// =====================================================================

import { requireAuth } from "../auth.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, renderState, withBusy } from "../ui.js";
import { formatMoney, formatDateTime } from "../format.js";
import { MIN_WITHDRAWAL, createWithdrawalRequest, fetchUserWithdrawals } from "../services/withdrawals-service.js";
import { computeUserBalance, computePendingWithdrawalsTotal } from "../services/wallet-service.js";
import { statusMeta } from "../components/submission-card.js";

// ---------------------------------------------------------------------
// Available balance (wallet minus pending withdrawals)
// ---------------------------------------------------------------------

async function renderAvailable(user) {
  const node = qs("[data-withdraw-available]");
  const [balance, pending] = await Promise.all([
    computeUserBalance(user.uid).catch(() => null),
    computePendingWithdrawalsTotal(user.uid).catch(() => 0),
  ]);
  if (balance === null) {
    node.textContent = "—";
    return null;
  }
  const available = Math.max(0, Math.round((balance - pending) * 100) / 100);
  node.textContent = formatMoney(available);
  return available;
}

// ---------------------------------------------------------------------
// Request history
// ---------------------------------------------------------------------

async function renderHistory(user) {
  const list = qs("[data-withdraw-list]");
  const statusArea = qs("[data-withdraw-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let requests;
  try {
    requests = await fetchUserWithdrawals(user.uid);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: () => renderHistory(user),
      retryLabel: t("common.retry"),
    });
    return;
  }

  if (!requests.length) {
    renderState(statusArea, "empty", { title: t("withdraw.emptyTitle"), body: t("withdraw.emptyBody") });
    return;
  }

  const template = qs("#withdrawal-row-template");
  for (const request of requests) {
    const row = template.content.firstElementChild.cloneNode(true);
    const meta = statusMeta(request.status);
    const badge = qs("[data-wd-status]", row);
    badge.textContent = t(meta.key);
    badge.classList.add(meta.class);

    qs("[data-wd-amount]", row).textContent = formatMoney(request.amount);
    qs("[data-wd-wallet]", row).textContent = request.walletNumber || "—";
    qs("[data-wd-date]", row).textContent = formatDateTime(request.createdAt);

    const reasonBlock = qs("[data-wd-reason-block]", row);
    if (request.status === "rejected" && request.rejectionReason) {
      reasonBlock.hidden = false;
      qs("[data-wd-reason]", row).textContent = request.rejectionReason;
    }
    list.append(row);
  }
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Request form
// ---------------------------------------------------------------------

async function submitRequest(form, user) {
  const errorNode = qs("[data-withdraw-error]", form);
  errorNode.textContent = "";

  const amountText = qs("[data-withdraw-amount]", form).value.trim();
  const walletNumber = qs("[data-withdraw-wallet]", form).value.trim();
  const amount = Number(amountText);

  // --- client validation
  if (!amountText) return (errorNode.textContent = t("withdraw.errors.amountRequired"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return (errorNode.textContent = t("withdraw.errors.amountInvalid"));
  }
  if (amount < MIN_WITHDRAWAL) {
    return (errorNode.textContent = t("withdraw.errors.minimum", { amount: formatMoney(MIN_WITHDRAWAL) }));
  }
  if (!walletNumber) return (errorNode.textContent = t("withdraw.errors.walletRequired"));

  const available = await renderAvailable(user);
  if (available !== null && amount > available + 0.001) {
    return (errorNode.textContent = t("withdraw.errors.insufficient"));
  }

  await withBusy(qs("button[type=submit]", form), async () => {
    try {
      await createWithdrawalRequest({ user, amount, walletNumber });
      form.reset();
      qs("[data-withdraw-success]").hidden = false;
      await renderAvailable(user);
      await renderHistory(user);
      window.setTimeout(() => (qs("[data-withdraw-success]").hidden = true), 6000);
    } catch (error) {
      console.error("[withdraw] request failed", error);
      errorNode.textContent = t("withdraw.errorBody");
    }
  });
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  const user = await requireAuth();
  if (!user) return;

  const form = qs("[data-withdraw-form]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitRequest(form, user);
  });

  await renderAvailable(user);
  await renderHistory(user);
  onLocaleChange(() => {
    void renderAvailable(user);
    void renderHistory(user);
  });
}

export { init };
