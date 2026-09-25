// =====================================================================
// Admin Content Controller (admin/content.html)
// =====================================================================
// The content management list: every game, app, website and offer on
// the platform, managed without touching code. Capabilities:
//   - search + category filter + status (published/draft) filter
//   - publish / unpublish toggle (drafts are never public)
//   - feature toggle (homepage + dashboard featured sections)
//   - display-order arrows (swap with the neighbour in the same
//     category — lower number shows first on the site)
//   - edit -> content-form.html?id=… (full form page)
//   - delete behind a confirmation dialog
// Writes go through offers-service.js; Firestore rules keep every
// write admin-only.
// =====================================================================

import { t, onLocaleChange } from "../../i18n.js";
import { qs, qsa, el, renderState, toast, withBusy, confirmDialog } from "../../ui.js";
import { formatMoney } from "../../format.js";
import {
  fetchAllOffers,
  setContentStatus,
  setContentFeatured,
  updateContentOrder,
  deleteOffer,
} from "../../services/offers-service.js";
import { categoryLabel, difficultyLabel, generatedCoverStyle, CATEGORIES } from "../../offers.js";

let allContent = []; // full catalogue, client-side filter source
let categoryFilter = "all"; // "all" | "game" | "app" | "website" | "offer"
let statusFilter = "all"; // "all" | "published" | "draft"

// ---------------------------------------------------------------------
// Sorting — the list mirrors the public site's ordering
// ---------------------------------------------------------------------

/**
 * Sorts content the way the public site shows it: grouped by category,
 * then display order (lower first), then newest. This is what makes
 * the reorder arrows predictable.
 */
function sortForDisplay(items) {
  const categoryRank = new Map(CATEGORIES.map((category, index) => [category, index]));
  return [...items].sort((a, b) => {
    const rank = (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99);
    if (rank !== 0) return rank;
    if ((a.displayOrder ?? 100) !== (b.displayOrder ?? 100)) {
      return (a.displayOrder ?? 100) - (b.displayOrder ?? 100);
    }
    return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
  });
}

// ---------------------------------------------------------------------
// List rendering (+ client-side search / filters)
// ---------------------------------------------------------------------

/** Loads the whole catalogue and paints the list; retried by the error state. */
async function renderContent() {
  const list = qs("[data-admin-content-list]");
  const statusArea = qs("[data-admin-content-status]");
  renderState(statusArea, "loading", { title: t("common.loading") });
  list.replaceChildren();

  try {
    allContent = sortForDisplay(await fetchAllOffers());
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderContent,
      retryLabel: t("common.retry"),
    });
    return;
  }

  applyFilters();
}

/** Applies search + category + status filters and repaints the rows. */
function applyFilters() {
  const list = qs("[data-admin-content-list]");
  const statusArea = qs("[data-admin-content-status]");
  const term = qs("[data-admin-content-search]").value.trim().toLowerCase();

  const matches = allContent.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (statusFilter !== "all" && statusOf(item) !== statusFilter) return false;
    if (!term) return true;
    return [item.title, item.titleAr, item.description, item.category]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });

  list.replaceChildren();
  if (!allContent.length) {
    renderState(statusArea, "empty", {
      title: t("admin.content.emptyTitle"),
      body: t("admin.content.emptyBody"),
    });
    return;
  }
  if (!matches.length) {
    renderState(statusArea, "empty", { title: t("admin.users.emptyTitle"), body: t("admin.users.emptyBody") });
    return;
  }

  const template = qs("#admin-content-row-template");
  for (const item of matches) {
    const row = template.content.firstElementChild.cloneNode(true);
    paintRow(row, item);
    list.append(row);
  }
  statusArea.replaceChildren();
}

/** Normalized status: `status` when present, derived from legacy `active`. */
function statusOf(item) {
  return item.status ?? (item.active ? "published" : "draft");
}

/** Fills one cloned row with the item's data and wires its actions. */
function paintRow(row, item) {
  // --- cover: uploaded thumbnail or a category-tinted gradient
  const thumb = qs("[data-cr-thumb]", row);
  if (item.image) {
    thumb.append(el("img", { src: item.image, alt: "" }));
  } else {
    thumb.setAttribute("style", generatedCoverStyle(item.category));
  }

  qs("[data-cr-title]", row).textContent = item.title || "—";
  qs("[data-cr-category]", row).textContent = categoryLabel(item.category);
  qs("[data-cr-featured]", row).hidden = !item.featured;
  qs("[data-cr-reward]", row).textContent = formatMoney(item.reward);
  qs("[data-cr-order]", row).textContent = String(item.displayOrder ?? 100);

  // --- status badge: published (green) vs draft (muted)
  const statusBadge = qs("[data-cr-status]", row);
  const published = statusOf(item) === "published";
  statusBadge.textContent = published ? t("admin.content.published") : t("admin.content.draft");
  statusBadge.classList.add(published ? "badge--approved" : "badge--muted");

  // --- actions (each closes over the item's id)
  const togglePublish = qs("[data-cr-toggle-publish]", row);
  togglePublish.textContent = published ? t("admin.content.unpublish") : t("admin.content.publish");
  togglePublish.addEventListener("click", () => void togglePublishStatus(item));

  const featuredBtn = qs("[data-cr-toggle-featured]", row);
  featuredBtn.classList.toggle("icon-btn--active", Boolean(item.featured));
  featuredBtn.addEventListener("click", () => void toggleFeatured(item));

  const editLink = qs("[data-cr-edit]", row);
  editLink.href = `content-form.html?id=${encodeURIComponent(item.id)}`;

  qs("[data-cr-delete]", row).addEventListener("click", () => void removeContent(item));

  // --- reorder arrows: swap displayOrder with the same-category neighbour
  qs("[data-cr-up]", row).addEventListener("click", () => void moveContent(item, -1));
  qs("[data-cr-down]", row).addEventListener("click", () => void moveContent(item, +1));
}

// ---------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------

/** Publishes / unpublishes an item (drafts never appear publicly). */
async function togglePublishStatus(item) {
  const next = statusOf(item) === "published" ? "draft" : "published";
  try {
    await setContentStatus(item.id, next);
    toast(next === "published" ? t("admin.content.publishedToast") : t("admin.content.unpublishedToast"), "success", 2000);
    await renderContent();
  } catch (error) {
    console.error("[admin:content] publish toggle failed", error);
    toast(t("admin.offers.form.saveFailed"), "error");
  }
}

/** Marks / unmarks an item as featured (homepage + dashboard strip). */
async function toggleFeatured(item) {
  try {
    await setContentFeatured(item.id, !item.featured);
    toast(t("admin.content.featuredToast"), "success", 2000);
    await renderContent();
  } catch (error) {
    console.error("[admin:content] featured toggle failed", error);
    toast(t("admin.offers.form.saveFailed"), "error");
  }
}

/**
 * Moves an item up/down within its category by swapping displayOrder
 * values with the adjacent item. Two sequential writes — acceptable
 * for an admin action; the list re-renders from source afterwards.
 */
async function moveContent(item, direction) {
  // Neighbours = same category, in display order.
  const neighbours = allContent.filter((entry) => entry.category === item.category);
  const index = neighbours.findIndex((entry) => entry.id === item.id);
  const neighbour = neighbours[index + direction];
  if (!neighbour) return; // already first / last in its category

  try {
    const a = item.displayOrder ?? 100;
    const b = neighbour.displayOrder ?? 100;
    await Promise.all([updateContentOrder(item.id, b), updateContentOrder(neighbour.id, a)]);
    await renderContent();
  } catch (error) {
    console.error("[admin:content] reorder failed", error);
    toast(t("admin.content.reorderFailed"), "error");
  }
}

/** Deletes an item after an explicit confirmation dialog. */
async function removeContent(item) {
  const confirmed = await confirmDialog({
    title: t("admin.content.deleteTitle"),
    body: t("admin.content.deleteConfirm"),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await deleteOffer(item.id);
    toast(t("admin.content.deletedToast"), "success");
    await renderContent();
  } catch (error) {
    console.error("[admin:content] delete failed", error);
    toast(t("admin.offers.form.deleteFailed"), "error");
  }
}

// ---------------------------------------------------------------------
// Filters + search wiring
// ---------------------------------------------------------------------

/** Wires the category chips, status chips and the search input. */
function initFilters() {
  for (const chip of qsa("[data-category-filter]")) {
    chip.addEventListener("click", () => {
      categoryFilter = chip.dataset.categoryFilter;
      for (const other of qsa("[data-category-filter]")) {
        const active = other === chip;
        other.classList.toggle("tab__btn--active", active);
        other.setAttribute("aria-pressed", String(active));
      }
      applyFilters();
    });
  }
  for (const chip of qsa("[data-status-filter]")) {
    chip.addEventListener("click", () => {
      statusFilter = chip.dataset.statusFilter;
      for (const other of qsa("[data-status-filter]")) {
        const active = other === chip;
        other.classList.toggle("tab__btn--active", active);
        other.setAttribute("aria-pressed", String(active));
      }
      applyFilters();
    });
  }
  qs("[data-admin-content-search]").addEventListener("input", applyFilters);
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  initFilters();
  await renderContent();
  onLocaleChange(() => void renderContent());
}

export { init };
