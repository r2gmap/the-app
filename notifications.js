// =====================================================================
// Notifications Page Controller (notifications.html)
// =====================================================================
// The user's in-app inbox: decisions on submissions and withdrawals.
// Rows render localized from the structured `type` + `data` fields
// (never stored sentences), support per-row and mark-all read, and the
// header shows the unread count.
// =====================================================================

import { requireAuth } from "../auth.js";
import { t, onLocaleChange } from "../i18n.js";
import { qs, renderState, el, withBusy } from "../ui.js";
import { formatMoney, formatRelativeTime } from "../format.js";
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notifications-service.js";

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

/** Localized title for a notification type. */
function notificationTitle(notification) {
  return t(`notifications.types.${notification.type}.title` || "notifications.title");
}

/** Localized body with the stored offer/amount/reason interpolated. */
function notificationBody(notification) {
  const data = notification.data || {};
  return t(`notifications.types.${notification.type}.body` || "notifications.title", {
    offer: data.offerTitle || "—",
    amount: data.amount !== undefined ? formatMoney(data.amount) : "—",
    reason: data.reason || "—",
  });
}

/** Renders the whole list + unread counter. */
async function renderNotifications(user) {
  const list = qs("[data-notifications-list]");
  const statusArea = qs("[data-notifications-status]");
  const counter = qs("[data-notifications-count]");
  const markAllButton = qs("[data-notifications-mark-all]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  let notifications;
  try {
    notifications = await fetchUserNotifications(user.uid);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: () => renderNotifications(user),
      retryLabel: t("common.retry"),
    });
    return;
  }

  const unread = notifications.filter((n) => !n.read).length;
  counter.textContent = t("notifications.unreadCount", { count: unread });
  markAllButton.hidden = unread === 0;

  if (!notifications.length) {
    renderState(statusArea, "empty", {
      title: t("notifications.emptyTitle"),
      body: t("notifications.emptyBody"),
    });
    return;
  }

  const template = qs("#notification-row-template");
  for (const notification of notifications) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.classList.toggle("notification--unread", !notification.read);

    qs("[data-nt-title]", row).textContent = notificationTitle(notification);
    qs("[data-nt-body]", row).textContent = notificationBody(notification);
    qs("[data-nt-date]", row).textContent = formatRelativeTime(notification.createdAt);

    const markButton = qs("[data-nt-mark]", row);
    markButton.hidden = notification.read;
    markButton.addEventListener("click", () =>
      withBusy(markButton, async () => {
        await markNotificationRead(notification.id).catch(() => {});
        await renderNotifications(user);
      }),
    );

    list.append(row);
  }
  statusArea.replaceChildren();
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  const user = await requireAuth();
  if (!user) return;

  qs("[data-notifications-mark-all]").addEventListener("click", () =>
    withBusy(qs("[data-notifications-mark-all]"), async () => {
      await markAllNotificationsRead(user.uid).catch(() => {});
      await renderNotifications(user);
    }),
  );

  await renderNotifications(user);
  onLocaleChange(() => void renderNotifications(user));
}

export { init };
