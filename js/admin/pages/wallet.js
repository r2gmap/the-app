// =====================================================================
// Admin Wallet Controller (admin/wallet.html)
// =====================================================================
// Platform-wide transaction ledger + manual adjustments:
//   - every transaction (rewards, withdrawals, adjustments), newest first
//   - "Add adjustment" dialog: pick a user, enter a signed amount and
//     a description — the only manual write path into `transactions`
//     (rules: admin only; users can never write here)
// =====================================================================

import { t, onLocaleChange } from "../../i18n.js";
import { qs, qsa, el, renderState, toast, withBusy } from "../../ui.js";
import { formatSignedMoney, formatDateTime } from "../../format.js";
import { fetchAllTransactions, addManualAdjustment } from "../../services/wallet-service.js";
import { fetchUsers } from "../../services/users-service.js";
import { renderTransactionRow } from "../../components/transaction-row.js";

let usersById = new Map(); // userId -> profile (for the user column)
let allUsers = []; // picker source

// ---------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------

async function renderLedger() {
  const list = qs("[data-admin-transactions-list]");
  const statusArea = qs("[data-admin-transactions-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  const [users, transactions] = await Promise.all([
    fetchUsers().catch(() => []),
    fetchAllTransactions().catch(() => null),
  ]);
  allUsers = users;
  usersById = new Map(users.map((user) => [user.uid ?? user.id, user]));

  if (transactions === null) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderLedger,
      retryLabel: t("common.retry"),
    });
    return;
  }
  if (!transactions.length) {
    renderState(statusArea, "empty", {
      title: t("admin.wallet.emptyTitle"),
      body: t("admin.wallet.emptyBody"),
    });
    return;
  }

  const template = qs("#admin-transaction-row-template");
  for (const transaction of transactions) {
    const row = template.content.firstElementChild.cloneNode(true);
    const user = usersById.get(transaction.userId);
    qs("[data-tr-user]", row).textContent = user?.displayName || user?.email || transaction.userId || "—";
    qs("[data-tr-type]", row).textContent = t(`transaction.type.${transaction.type}` || "transaction.type.adjustment");
    qs("[data-tr-desc]", row).textContent = transaction.description || "—";
    qs("[data-tr-date]", row).textContent = formatDateTime(transaction.createdAt);

    const amountNode = qs("[data-tr-amount]", row);
    const amount = Number(transaction.amount) || 0;
    amountNode.textContent = formatSignedMoney(amount);
    amountNode.classList.add(amount >= 0 ? "amount--credit" : "amount--debit");
    list.append(row);
  }
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Manual adjustment dialog (user picker + signed amount)
// ---------------------------------------------------------------------

function initAdjustmentDialog(adminUser) {
  const dialog = qs("[data-adjust-dialog]");
  const openButton = qs("[data-adjust-open]");
  const searchInput = qs("[data-adjust-user-search]", dialog);
  const results = qs("[data-adjust-user-results]", dialog);
  let selectedUser = null;

  openButton.addEventListener("click", () => {
    selectedUser = null;
    searchInput.value = "";
    results.replaceChildren();
    qs("[data-adjust-amount]", dialog).value = "";
    qs("[data-adjust-description]", dialog).value = "";
    qs("[data-adjust-error]", dialog).textContent = "";
    dialog.showModal();
  });

  // Live user search over the fetched list (client-side).
  searchInput.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();
    results.replaceChildren();
    selectedUser = null;
    if (!term) return;
    for (const user of allUsers
      .filter((user) =>
        [user.displayName, user.email].some((field) =>
          String(field || "").toLowerCase().includes(term),
        ),
      )
      .slice(0, 6)) {
      const option = el(
        "button",
        {
          class: "user-option",
          type: "button",
          onclick: () => {
            selectedUser = user;
            results.replaceChildren(
              el("span", { class: "user-option user-option--selected", text: `${user.displayName || ""} (${user.email})` }),
            );
          },
        },
        `${user.displayName || "—"} · ${user.email}`,
      );
      results.append(option);
    }
  });

  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorNode = qs("[data-adjust-error]", dialog);

    const amount = Number(qs("[data-adjust-amount]", dialog).value);
    const description = qs("[data-adjust-description]", dialog).value.trim();

    if (!selectedUser) return (errorNode.textContent = t("admin.wallet.adjust.errors.userRequired"));
    if (!Number.isFinite(amount) || amount === 0) {
      return (errorNode.textContent = t("admin.wallet.adjust.errors.amountInvalid"));
    }
    if (!description) return (errorNode.textContent = t("admin.wallet.adjust.errors.descriptionRequired"));

    await withBusy(dialog.querySelector("button[type=submit]"), async () => {
      try {
        await addManualAdjustment(
          { userId: selectedUser.uid ?? selectedUser.id, amount, description },
          adminUser,
        );
        dialog.close();
        toast(t("admin.wallet.adjust.success"), "success");
        await renderLedger();
      } catch (error) {
        console.error("[admin:wallet] adjustment failed", error);
        errorNode.textContent = t("admin.wallet.adjust.failed");
      }
    });
  });
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init(adminUser) {
  initAdjustmentDialog(adminUser);
  await renderLedger();
  onLocaleChange(() => void renderLedger());
}

export { init };
