// =====================================================================
// Admin support queue — authorized review of supportTickets
// =====================================================================

import { fetchSupportTickets } from "./support-service.js";
import { t, onLocaleChange } from "./i18n.js";
import { qs, renderState } from "./ui.js";

let tickets = [];

function formatTicketDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(document.documentElement.lang || "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderTickets() {
  const list = qs("[data-support-ticket-list]");
  if (!list) return;
  list.replaceChildren();
  if (!tickets.length) {
    renderState(list, "empty", {
      title: t("admin.support.emptyTitle"),
      body: t("admin.support.emptyBody"),
    });
    return;
  }

  for (const ticket of tickets) {
    const card = document.createElement("article");
    card.className = "card admin-support-ticket";

    const heading = document.createElement("div");
    heading.className = "admin-support-ticket__heading";
    const title = document.createElement("h2");
    title.className = "admin-support-ticket__category";
    title.textContent = t(`support.category.${ticket.category}`);
    const time = document.createElement("time");
    time.className = "admin-support-ticket__time";
    time.dateTime = ticket.createdAt?.toDate?.()?.toISOString?.() || "";
    time.textContent = formatTicketDate(ticket.createdAt);
    heading.append(title, time);

    const identity = document.createElement("p");
    identity.className = "admin-support-ticket__identity";
    identity.textContent = `${ticket.userName || "—"} · ${ticket.email || "—"}`;

    const message = document.createElement("p");
    message.className = "admin-support-ticket__message";
    message.textContent = ticket.message || "";

    card.append(heading, identity, message);
    for (const url of ticket.attachmentUrls || []) {
      const link = document.createElement("a");
      link.className = "btn btn--secondary btn--sm admin-support-ticket__attachment";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = t("admin.support.openAttachment");
      card.append(link);
    }
    list.append(card);
  }
}

async function loadTickets() {
  const list = qs("[data-support-ticket-list]");
  renderState(list, "loading", { title: t("common.loading") });
  try {
    tickets = await fetchSupportTickets();
    renderTickets();
  } catch (error) {
    renderState(list, "error", {
      title: t("admin.support.errorTitle"),
      body: t("admin.support.errorBody"),
      retry: loadTickets,
      retryLabel: t("common.retry"),
    });
  }
}

async function init() {
  await loadTickets();
  onLocaleChange(renderTickets);
}

export { init };
