// =====================================================================
// Admin Content Form Controller (admin/content-form.html)
// =====================================================================
// The create/edit page behind the whole CMS. One form, two modes:
//
//   create: content-form.html            (no id in the URL)
//   edit:   content-form.html?id=<docId> (loads the document first)
//
// Field groups mirror the page sections:
//   basics    — category, title, short + full description (EN)
//   details   — reward, difficulty, estimated time, requirements,
//               instructions
//   media     — thumbnail + banner (file upload to Firebase Storage,
//               or a pasted URL; live preview for both)
//   arabic    — the optional localized twins of every text field
//   publishing— status (draft | published), featured, display order
//
// On save the form uploads any picked images, writes the document
// through offers-service.js (which keeps `active` in sync with the
// chosen status) and returns to the content list.
// =====================================================================

import { t } from "../../i18n.js";
import { qs, el, renderState, toast, withBusy, confirmDialog } from "../../ui.js";
import {
  fetchOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  uploadContentImage,
} from "../../services/offers-service.js";

let currentAdminUid = null; // written into createdBy
let editingContentId = null; // null = creating new content

// ---------------------------------------------------------------------
// Form helpers (field read/write by data-cf-* hook)
// ---------------------------------------------------------------------

/** Sets a form field's value ("" for null/undefined). */
function setField(name, value) {
  const node = qs(`[data-cf-${name}]`);
  if (node) node.value = value ?? "";
}

/** Reads a form field's trimmed value. */
const getField = (name) => String(qs(`[data-cf-${name}]`).value ?? "").trim();

// ---------------------------------------------------------------------
// Media fields: file picker <-> URL field, with live previews
// ---------------------------------------------------------------------

/**
 * Wires one media pair (thumbnail or banner):
 *   - picking a file clears the URL field and shows a local preview
 *   - typing a URL clears the file picker and previews the URL
 * Used for image REPLACEMENT: saving stores the new URL in Firestore,
 * and every surface that renders the content updates automatically.
 */
function initMediaField({ fileHook, urlHook, previewHook, wide = false }) {
  const fileInput = qs(fileHook);
  const urlInput = qs(urlHook);
  const preview = qs(previewHook);

  /** Shows an image preview (and hides the block when src is empty). */
  const showPreview = (src) => {
    preview.replaceChildren();
    if (!src) {
      preview.hidden = true;
      return;
    }
    const img = el("img", { src, alt: "" });
    if (wide) img.className = "media-field__image media-field__image--wide";
    else img.className = "media-field__image";
    img.addEventListener("error", () => {
      preview.hidden = true;
      preview.replaceChildren();
    });
    preview.append(img);
    preview.hidden = false;
  };

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) urlInput.value = ""; // a picked file wins over a pasted URL
    showPreview(file ? URL.createObjectURL(file) : urlInput.value.trim());
  });

  urlInput.addEventListener("input", () => {
    if (urlInput.value.trim()) fileInput.value = ""; // and vice versa
    showPreview(urlInput.value.trim());
  });

  return { showPreview };
}

// ---------------------------------------------------------------------
// Mode: create (empty form) vs edit (load document)
// ---------------------------------------------------------------------

/** Resets every field to the create-mode defaults. */
function resetForm() {
  editingContentId = null;

  const textFields = [
    "title", "title-ar", "description", "description-ar",
    "full-description", "full-description-ar", "time", "time-ar",
    "requirements", "requirements-ar", "instructions", "instructions-ar",
    "thumb-url", "banner-url", "thumb-file", "banner-file",
  ];
  for (const name of textFields) setField(name, "");
  setField("category", "game");
  setField("difficulty", "easy");
  setField("reward", "");
  setField("order", "100");

  // Publishing defaults: published + not featured.
  qs('[data-cf-status][value="published"]').checked = true;
  qs("[data-cf-featured]").checked = false;

  // Titles + hide the delete button (create mode has nothing to delete).
  qs("[data-cf-page-title]").textContent = t("admin.content.form.newTitle");
  qs("[data-cf-head-title]").textContent = t("admin.content.form.newTitle");
  qs("[data-cf-head-subtitle]").textContent = t("admin.content.form.newSubtitle");
  qs("[data-cf-delete]").hidden = true;
}

/** Loads an existing document into the form (edit mode). */
async function loadForEdit(contentId) {
  const statusArea = qs("[data-cf-status-area]");
  const form = qs("[data-content-form]");

  renderState(statusArea, "loading", { title: t("common.loading") });

  let item;
  try {
    item = await fetchOfferById(contentId);
  } catch (error) {
    console.error("[admin:content-form] load failed", error);
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
    });
    return false;
  }
  if (!item) {
    renderState(statusArea, "empty", {
      title: t("admin.content.form.notFoundTitle"),
      body: t("admin.content.form.notFoundBody"),
    });
    return false;
  }

  editingContentId = item.id;

  // --- basics
  setField("category", item.category || "game");
  setField("title", item.title);
  setField("description", item.description);
  setField("full-description", item.fullDescription);

  // --- details
  setField("reward", item.reward ?? "");
  setField("difficulty", item.difficulty || "easy");
  setField("time", item.estimatedTime);
  setField("requirements", (item.requirements || []).join("\n"));
  setField("instructions", item.instructions);

  // --- media (URLs + previews; file pickers stay empty)
  setField("thumb-url", item.image || "");
  setField("banner-url", item.banner || "");
  thumbMedia.showPreview(item.image || "");
  bannerMedia.showPreview(item.banner || "");

  // --- arabic twins
  setField("title-ar", item.titleAr);
  setField("description-ar", item.descriptionAr);
  setField("full-description-ar", item.fullDescriptionAr);
  setField("time-ar", item.estimatedTimeAr);
  setField("requirements-ar", (item.requirementsAr || []).join("\n"));
  setField("instructions-ar", item.instructionsAr);

  // --- publishing (status falls back to the legacy `active` flag)
  const status = item.status ?? (item.active ? "published" : "draft");
  qs(`[data-cf-status][value="${status === "draft" ? "draft" : "published"}"]`).checked = true;
  qs("[data-cf-featured]").checked = Boolean(item.featured);
  setField("order", item.displayOrder ?? 100);

  // --- edit-mode chrome
  qs("[data-cf-page-title]").textContent = t("admin.content.form.editTitle");
  qs("[data-cf-head-title]").textContent = t("admin.content.form.editTitle");
  qs("[data-cf-head-subtitle]").textContent = t("admin.content.form.editSubtitle");
  qs("[data-cf-delete]").hidden = false;

  statusArea.replaceChildren(); // clear the loading state
  form.hidden = false;
  return true;
}

// ---------------------------------------------------------------------
// Save (create or update)
// ---------------------------------------------------------------------

/** Collects, validates, uploads and writes the content document. */
async function saveContent() {
  const errorNode = qs("[data-cf-error]");
  errorNode.textContent = "";

  // --- client-side validation (mirrors firestore.rules shapes)
  if (!getField("title")) {
    errorNode.textContent = t("admin.offers.form.errors.titleRequired");
    return;
  }
  const reward = Number(getField("reward"));
  if (!Number.isFinite(reward) || reward < 0) {
    errorNode.textContent = t("admin.offers.form.errors.rewardInvalid");
    return;
  }

  await withBusy(qs("[data-cf-save]"), async () => {
    try {
      // --- media: picked files are uploaded first; the URL is the fallback
      let image = getField("thumb-url") || null;
      const thumbFile = qs("[data-cf-thumb-file]").files?.[0];
      if (thumbFile) image = await uploadContentImage(thumbFile, "thumbnail");

      let banner = getField("banner-url") || null;
      const bannerFile = qs("[data-cf-banner-file]").files?.[0];
      if (bannerFile) banner = await uploadContentImage(bannerFile, "banner");

      // --- the full form payload (schema lives in offers-service.js)
      const form = {
        title: getField("title"),
        titleAr: getField("title-ar"),
        description: getField("description"),
        descriptionAr: getField("description-ar"),
        fullDescription: getField("full-description"),
        fullDescriptionAr: getField("full-description-ar"),
        category: qs("[data-cf-category]").value,
        reward,
        difficulty: qs("[data-cf-difficulty]").value,
        estimatedTime: getField("time"),
        estimatedTimeAr: getField("time-ar"),
        requirements: getField("requirements"),
        requirementsAr: getField("requirements-ar"),
        instructions: getField("instructions"),
        instructionsAr: getField("instructions-ar"),
        image,
        banner,
        status: qs('[data-cf-status]:checked')?.value === "draft" ? "draft" : "published",
        featured: qs("[data-cf-featured]").checked,
        displayOrder: Number(getField("order")) || 100,
      };

      // --- write, then return to the list
      if (editingContentId) await updateOffer(editingContentId, form, currentAdminUid);
      else await createOffer(form, currentAdminUid);

      toast(t("admin.content.form.saved"), "success");
      window.location.assign("content.html");
    } catch (error) {
      console.error("[admin:content-form] save failed", error);
      errorNode.textContent = t("admin.offers.form.saveFailed");
    }
  });
}

// ---------------------------------------------------------------------
// Delete (edit mode only, behind a confirmation dialog)
// ---------------------------------------------------------------------

async function deleteContent() {
  if (!editingContentId) return;
  const confirmed = await confirmDialog({
    title: t("admin.content.deleteTitle"),
    body: t("admin.content.deleteConfirm"),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!confirmed) return;

  await withBusy(qs("[data-cf-delete]"), async () => {
    try {
      await deleteOffer(editingContentId);
      toast(t("admin.content.deletedToast"), "success");
      window.location.assign("content.html");
    } catch (error) {
      console.error("[admin:content-form] delete failed", error);
      toast(t("admin.offers.form.deleteFailed"), "error");
    }
  });
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

// Media pairs, created once at module scope (used by loadForEdit too).
const thumbMedia = initMediaField({
  fileHook: "[data-cf-thumb-file]",
  urlHook: "[data-cf-thumb-url]",
  previewHook: "[data-cf-thumb-preview]",
});
const bannerMedia = initMediaField({
  fileHook: "[data-cf-banner-file]",
  urlHook: "[data-cf-banner-url]",
  previewHook: "[data-cf-banner-preview]",
  wide: true,
});

/** Entry point: wires the form actions, then loads create or edit mode. */
async function init(adminUser) {
  currentAdminUid = adminUser?.uid || null;

  const form = qs("[data-content-form]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveContent();
  });
  qs("[data-cf-cancel]").addEventListener("click", () => window.location.assign("content.html"));
  qs("[data-cf-delete]").addEventListener("click", () => void deleteContent());

  // Mode switch: ?id=… edits an existing document, otherwise create.
  const params = new URLSearchParams(window.location.search);
  const contentId = (params.get("id") || "").trim();

  resetForm();

  if (contentId) {
    const loaded = await loadForEdit(contentId);
    if (loaded) form.hidden = false;
  } else {
    form.hidden = false;
    qs("[data-cf-status-area]")?.replaceChildren();
  }
}

export { init };
