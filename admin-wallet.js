// =====================================================================
// Admin Wallet Controller
// =====================================================================
// Shows the append-only platform ledger and keeps the existing manual
// adjustment capability behind the admin role guard. All writes continue
// through wallet-service.js; this file only orchestrates the form and
// renders the result.
// =====================================================================

import { t, getLocale, onLocaleChange } from "./i18n.js";
import { qs, el, renderState, toast, withBusy } from "./ui.js";
import { formatSignedMoney, formatDateTime } from "./format.js";
import { fetchAllTransactions, addManualAdjustment } from "./wallet-service.js";
import { fetchUsers } from "./users-service.js";

let adminUser = null;
let users = [];

async function renderLedger() {
  const list = qs("[data-admin-wallet-list]");
  const status = qs("[data-admin-wallet-status]");
  renderState(status, "loading", { title: t("common.loading") });
  list.replaceChildren();
  try {
    const transactions = await fetchAllTransactions(150);
    if (!transactions.length) {
      renderState(status, "empty", { title: t("admin.wallet.emptyTitle"), body: t("admin.wallet.emptyBody") });
      return;
    }
    const names = new Map(users.map((user) => [user.id || user.uid, user.displayName || user.email || user.id]));
    for (const transaction of transactions) {
      const row = el("article", { class: "card admin-ledger-row" });
      row.append(
        el("div", { class: "admin-ledger-row__cell" }, el("span", { class: "admin-row__label", text: t("admin.wallet.tableUser") }), el("strong", { text: names.get(transaction.userId) || transaction.userId || "—" })),
        el("div", { class: "admin-ledger-row__cell" }, el("span", { class: "admin-row__label", text: t("admin.wallet.tableType") }), el("span", { text: transaction.type ? t(`transaction.type.${transaction.type}`) : "—" })),
        el("div", { class: "admin-ledger-row__cell" }, el("span", { class: "admin-row__label", text: t("admin.wallet.tableAmount") }), el("strong", { class: Number(transaction.amount) >= 0 ? "amount--credit" : "amount--debit", text: formatSignedMoney(transaction.amount, getLocale()) })),
        el("div", { class: "admin-ledger-row__cell admin-ledger-row__description" }, el("span", { class: "admin-row__label", text: t("admin.wallet.tableDescription") }), el("span", { text: transaction.description || "—" })),
        el("div", { class: "admin-ledger-row__cell" }, el("span", { class: "admin-row__label", text: t("admin.wallet.tableDate") }), el("span", { text: formatDateTime(transaction.createdAt, getLocale()) })),
      );
      list.append(row);
    }
    status.replaceChildren();
  } catch (error) {
    renderState(status, "error", { title: t("common.errorTitle"), body: t("common.errorBody"), retry: renderLedger, retryLabel: t("common.retry") });
  }
}

async function populateUsers() {
  try {
    users = await fetchUsers(300);
    const select = qs("[data-admin-wallet-user]");
    if (!select) return;
    select.replaceChildren(el("option", { value: "", text: t("admin.wallet.adjust.user") }));
    for (const user of users) {
      select.append(el("option", { value: user.id || user.uid, text: `${user.displayName || user.email || user.id} — ${user.email || ""}` }));
    }
  } catch (error) {
    console.warn("[admin:wallet] users unavailable", error);
  }
}

function initAdjustmentForm() {
  const dialog = qs("[data-admin-wallet-dialog]");
  const open = qs("[data-admin-wallet-open]");
  const form = qs("[data-admin-wallet-form]");
  if (!dialog || !open || !form) return;
  open.addEventListener("click", () => dialog.showModal());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAdjustment(form, dialog);
  });
}

async function submitAdjustment(form, dialog) {
  const userId = qs("[data-admin-wallet-user]", form).value;
  const amount = Number(qs("[data-admin-wallet-amount]", form).value);
  const description = qs("[data-admin-wallet-description]", form).value.trim();
  if (!userId) return toast(t("admin.wallet.adjust.errors.userRequired"), "error");
  if (!Number.isFinite(amount) || amount === 0) return toast(t("admin.wallet.adjust.errors.amountInvalid"), "error");
  if (!description) return toast(t("admin.wallet.adjust.errors.descriptionRequired"), "error");
  await withBusy(qs("button[type=submit]", form), async () => {
    try {
      await addManualAdjustment({ userId, amount, description }, adminUser);
      dialog.close();
      form.reset();
      toast(t("admin.wallet.adjust.success"), "success");
      await renderLedger();
    } catch (error) {
      toast(t("admin.wallet.adjust.failed"), "error");
    }
  });
}

async function init(user) {
  adminUser = user;
  initAdjustmentForm();
  await populateUsers();
  await renderLedger();
  onLocaleChange(() => void renderLedger());
}

export { init };
