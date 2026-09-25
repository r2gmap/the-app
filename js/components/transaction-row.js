// =====================================================================
// Transaction Row Component (shared renderer)
// =====================================================================
// Renders one wallet transaction by cloning
// <template id="transaction-row-template">. Used by the user's wallet
// page and the admin's user-activity modal, so both show identical
// rows: type, description, date, signed colored amount.
// =====================================================================

import { t } from "../i18n.js";
import { formatSignedMoney, formatDateTime } from "../format.js";
import { qs } from "../ui.js";

/** Renders one transaction row into `container`. */
function renderTransactionRow(container, transaction) {
  const template = qs("#transaction-row-template");
  if (!template) return null;
  const row = template.content.firstElementChild.cloneNode(true);

  qs("[data-tx-type]", row).textContent = t(`transaction.type.${transaction.type}` || "transaction.type.adjustment");
  qs("[data-tx-desc]", row).textContent = transaction.description || "—";
  qs("[data-tx-date]", row).textContent = formatDateTime(transaction.createdAt);

  const amountNode = qs("[data-tx-amount]", row);
  const amount = Number(transaction.amount) || 0;
  amountNode.textContent = formatSignedMoney(amount);
  amountNode.classList.add(amount >= 0 ? "amount--credit" : "amount--debit");

  container.append(row);
  return row;
}

export { renderTransactionRow };
