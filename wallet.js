// =====================================================================
// Wallet Page Controller (wallet.html)
// =====================================================================
// Balance card + full transaction history. Every row is rendered from
// the shared #transaction-row-template (also used by the admin user
// activity modal), colored by direction: rewards green, withdrawals
// red, adjustments neutral.
// =====================================================================

import { requireAuth } from "../auth.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, renderState } from "../ui.js";
import { formatMoney } from "../format.js";
import { fetchUserTransactions, computeUserBalance } from "../services/wallet-service.js";
import { renderTransactionRow } from "../components/transaction-row.js";

// ---------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------

async function renderWallet(user) {
  const balanceNode = qs("[data-wallet-balance]");
  const list = qs("[data-wallet-transactions]");
  const statusArea = qs("[data-wallet-status]");

  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  const [balance, transactions] = await Promise.all([
    computeUserBalance(user.uid).catch(() => null),
    fetchUserTransactions(user.uid).catch(() => null),
  ]);

  balanceNode.textContent = balance === null ? "—" : formatMoney(balance);

  if (transactions === null) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: () => renderWallet(user),
      retryLabel: t("common.retry"),
    });
    return;
  }
  if (!transactions.length) {
    renderState(statusArea, "empty", { title: t("wallet.emptyTitle"), body: t("wallet.emptyBody") });
    return;
  }

  for (const transaction of transactions) renderTransactionRow(list, transaction);
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  const user = await requireAuth();
  if (!user) return;

  await renderWallet(user);
  onLocaleChange(() => void renderWallet(user));
}

export { init, renderTransactionRow };
