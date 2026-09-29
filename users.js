// =====================================================================
// Admin Users Controller (admin/users.html)
// =====================================================================
// User management: search by name/email (client-side filter over the
// fetched list — see README for the server-side search upgrade path)
// and a per-user activity dialog: wallet balance, completed + pending
// counts, recent submissions and recent transactions.
// =====================================================================

import { t, onLocaleChange } from "../../i18n.js";
import { qs, el, renderState, renderAvatar, withBusy } from "../../ui.js";
import { formatMoney, formatDate, formatDateTime } from "../../format.js";
import { fetchUsers } from "../../services/users-service.js";
import { computeUserBalance, fetchUserTransactions } from "../../services/wallet-service.js";
import { countUserSubmissions, fetchUserSubmissions } from "../../services/submissions-service.js";
import { statusMeta } from "../../components/submission-card.js";
import { renderTransactionRow } from "../../components/transaction-row.js";

let allUsers = [];

// ---------------------------------------------------------------------
// List + search
// ---------------------------------------------------------------------

async function renderUsers() {
  const list = qs("[data-admin-users-list]");
  const statusArea = qs("[data-admin-users-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  try {
    allUsers = await fetchUsers();
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderUsers,
      retryLabel: t("common.retry"),
    });
    return;
  }
  applySearch();
}

/** Re-renders the user list filtered by the search box term. */
function applySearch() {
  const list = qs("[data-admin-users-list]");
  const statusArea = qs("[data-admin-users-status]");
  const term = qs("[data-admin-users-search]").value.trim().toLowerCase();

  const matches = allUsers.filter((user) => {
    if (!term) return true;
    return [user.displayName, user.email].some((field) =>
      String(field || "").toLowerCase().includes(term),
    );
  });

  list.replaceChildren();
  if (!matches.length) {
    renderState(statusArea, "empty", {
      title: t("admin.users.emptyTitle"),
      body: t("admin.users.emptyBody"),
    });
    return;
  }

  const template = qs("#admin-user-row-template");
  for (const user of matches) {
    const row = template.content.firstElementChild.cloneNode(true);

    renderAvatar(qs("[data-ur-avatar]", row), {
      photoURL: user.photoURL,
      displayName: user.displayName || user.email,
      size: "sm",
    });
    qs("[data-ur-name]", row).textContent = user.displayName || "—";
    qs("[data-ur-email]", row).textContent = user.email || "—";
    qs("[data-ur-joined]", row).textContent = user.createdAt ? formatDate(user.createdAt) : "—";

    const roleBadge = qs("[data-ur-role]", row);
    const isAdmin = user.role === "admin";
    roleBadge.textContent = isAdmin ? t("admin.users.roleAdmin") : t("admin.users.roleUser");
    roleBadge.classList.add(isAdmin ? "badge--primary" : "badge--muted");

    qs("[data-ur-activity]", row).addEventListener("click", () => openActivityDialog(user));
    list.append(row);
  }
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Activity dialog
// ---------------------------------------------------------------------

async function openActivityDialog(user) {
  const dialog = qs("[data-user-activity-dialog]");
  const body = qs("[data-activity-body]", dialog);
  const spinner = qs("[data-activity-loading]", dialog);

  body.replaceChildren();
  spinner.hidden = false;
  dialog.showModal();

  const [balance, completed, pending, submissions, transactions] = await Promise.all([
    computeUserBalance(user.uid ?? user.id).catch(() => null),
    countUserSubmissions(user.uid ?? user.id, "approved").catch(() => null),
    countUserSubmissions(user.uid ?? user.id, "pending").catch(() => null),
    fetchUserSubmissions(user.uid ?? user.id, 5).catch(() => []),
    fetchUserTransactions(user.uid ?? user.id, 5).catch(() => []),
  ]);

  spinner.hidden = true;

  // --- stat chips
  const stats = el("div", { class: "stat-chips" });
  const chip = (label, value) =>
    el("div", { class: "stat-chip" }, el("p", { class: "stat-chip__label", text: label }), el("p", { class: "stat-chip__value", text: value }));
  stats.append(
    chip(t("admin.users.activity.balance"), balance === null ? "—" : formatMoney(balance)),
    chip(t("admin.users.activity.completed"), completed === null ? "—" : String(completed)),
    chip(t("admin.users.activity.pending"), pending === null ? "—" : String(pending)),
  );
  body.append(stats);

  // --- recent submissions
  body.append(el("h3", { class: "modal__subtitle", text: t("admin.users.activity.recentSubmissions") }));
  if (submissions.length) {
    const list = el("ul", { class: "mini-list" });
    for (const submission of submissions) {
      const meta = statusMeta(submission.status);
      list.append(
        el(
          "li",
          { class: "mini-list__item" },
          el("span", { text: `${submission.offerTitle} — ${submission.taskTitle}` }),
          el("span", { class: `badge ${meta.class}`, text: t(meta.key) }),
          el("span", { class: "mini-list__date", text: formatDateTime(submission.createdAt) }),
        ),
      );
    }
    body.append(list);
  } else {
    body.append(el("p", { class: "muted", text: t("admin.users.activity.noSubmissions") }));
  }

  // --- recent transactions
  body.append(el("h3", { class: "modal__subtitle", text: t("admin.users.activity.recentTransactions") }));
  if (transactions.length) {
    const txList = el("div", { class: "transaction-list transaction-list--compact" });
    for (const transaction of transactions) renderTransactionRow(txList, transaction);
    body.append(txList);
  } else {
    body.append(el("p", { class: "muted", text: t("admin.users.activity.noTransactions") }));
  }
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  qs("[data-admin-users-search]").addEventListener("input", applySearch);
  await renderUsers();
  onLocaleChange(() => applySearch());
}

export { init };
