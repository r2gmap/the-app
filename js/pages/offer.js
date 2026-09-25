// =====================================================================
// Offer Details Controller (offer.html?id=…)
// =====================================================================
// One page, four visitor states:
//   guest            -> offer preview + sign-in / sign-up call to action
//   unverified email -> offer preview + "verify your email first"
//   verified         -> full details + the proof-submission form
//   already pending  -> full details + "your proof is under review"
//
// Submission form: task title, message, wallet number and up to 5
// proof images (validated client-side, enforced again by
// storage.rules). Images go to Firebase Storage, the submission to
// Firestore `taskSubmissions`, then the visitor sees the success panel.
// =====================================================================

import { waitForAuthState } from "../firebase.js";
import { t, localizedText, onLocaleChange } from "../i18n.js";
import { qs, qsa, el, renderState, toast, withBusy } from "../ui.js";
import { formatMoney } from "../format.js";
import { categoryLabel, difficultyLabel, localizedRequirements, generatedCoverStyle } from "../offers.js";
import { fetchOfferById } from "../services/offers-service.js";
import { createSubmission, validateProofFiles, fetchUserSubmissionForOffer } from "../services/submissions-service.js";

let offer = null;
let selectedFiles = [];

// ---------------------------------------------------------------------
// Loading + not-found states
// ---------------------------------------------------------------------

function offerIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("id") || "").trim();
}

async function renderOfferShell() {
  const statusArea = qs("[data-offer-status]");
  const content = qs("[data-offer-content]");
  content.hidden = true;

  const id = offerIdFromUrl();
  if (!id || id.startsWith("demo-")) return showNotFound(statusArea, content);

  try {
    offer = await fetchOfferById(id);
  } catch (error) {
    renderState(statusArea, "error", {
      title: t("common.errorTitle"),
      body: t("common.errorBody"),
      retry: renderOfferShell,
      retryLabel: t("common.retry"),
    });
    return;
  }
  if (!offer || offer.active === false) return showNotFound(statusArea, content);

  statusArea.replaceChildren();
  content.hidden = false;
  renderOfferDetails();
  await renderVisitorState();
}

function showNotFound(statusArea, content) {
  content.hidden = true;
  renderState(statusArea, "empty", {
    title: t("offer.notFoundTitle"),
    body: t("offer.notFoundBody"),
  });
  const cta = el("a", { class: "btn btn--primary", href: "offers.html" }, t("offer.notFoundCta"));
  statusArea.firstElementChild?.append(cta);
}

// ---------------------------------------------------------------------
// Offer details (locale-aware)
// ---------------------------------------------------------------------

function renderOfferDetails() {
  // --- optional wide banner above the hero (uploaded in the CMS)
  renderBanner();

  // --- thumbnail or generated cover art in the hero
  const media = qs("[data-offer-image]");
  media.replaceChildren();
  if (offer.image) {
    const img = el("img", { class: "offer-hero__image", src: offer.image, alt: "" });
    img.addEventListener("error", () => {
      img.remove();
      applyGenerated(media);
    });
    media.append(img);
  } else {
    applyGenerated(media);
  }

  qs("[data-offer-title]").textContent = localizedText(offer, "title");
  qs("[data-offer-category]").textContent = categoryLabel(offer.category);
  qs("[data-offer-difficulty]").textContent = difficultyLabel(offer.difficulty);
  qs("[data-offer-time]").textContent = localizedText(offer, "estimatedTime") || "—";
  qs("[data-offer-reward]").textContent = formatMoney(offer.reward);

  // Full description when the CMS provided one; the short description
  // (always present) is the fallback for legacy content.
  qs("[data-offer-description]").textContent =
    localizedText(offer, "fullDescription") || localizedText(offer, "description");

  const requirementsList = qs("[data-offer-requirements]");
  requirementsList.replaceChildren();
  for (const requirement of localizedRequirements(offer)) {
    requirementsList.append(el("li", { class: "check-list__item" }, requirement));
  }
  qs("[data-offer-instructions]").textContent = localizedText(offer, "instructions") || "—";
}

/** Paints the optional banner image; the block stays hidden without one. */
function renderBanner() {
  const banner = qs("[data-offer-banner]");
  if (!banner) return;
  banner.replaceChildren();
  if (!offer.banner) {
    banner.hidden = true;
    return;
  }
  const img = el("img", { class: "offer-banner__image", src: offer.banner, alt: "" });
  img.addEventListener("error", () => {
    banner.hidden = true;
    banner.replaceChildren();
  });
  banner.append(img);
  banner.hidden = false;
}

function applyGenerated(media) {
  media.setAttribute("style", generatedCoverStyle(offer.category));
  media.append(
    el(
      "span",
      { class: "offer-hero__initial", "aria-hidden": "true" },
      (localizedText(offer, "title") || "?").charAt(0).toUpperCase(),
    ),
  );
}

// ---------------------------------------------------------------------
// Visitor state (guest / unverified / form / pending)
// ---------------------------------------------------------------------

async function renderVisitorState() {
  const guestPanel = qs("[data-offer-guest]");
  const verifyPanel = qs("[data-offer-verify]");
  const pendingPanel = qs("[data-offer-pending]");
  const formPanel = qs("[data-offer-form-panel]");

  [guestPanel, verifyPanel, pendingPanel, formPanel].forEach((panel) => (panel.hidden = true));

  const { user } = await waitForAuthState();
  if (!user) {
    guestPanel.hidden = false;
    return;
  }
  if (!user.emailVerified) {
    verifyPanel.hidden = false;
    return;
  }

  // A pending submission for this offer replaces the form with a note.
  try {
    const existing = await fetchUserSubmissionForOffer(user.uid, offer.id);
    if (existing && existing.status === "pending") {
      pendingPanel.hidden = false;
      return;
    }
  } catch (error) {
    /* on failure, fall through and show the form — rules still guard */
  }

  formPanel.hidden = false;
}

// ---------------------------------------------------------------------
// Proof image picker (previews + removal, no upload yet)
// ---------------------------------------------------------------------

function initFilePicker() {
  const input = qs("[data-input-files]");
  const previews = qs("[data-proof-previews]");
  if (!input || !previews) return;

  input.addEventListener("change", () => {
    const errors = validateProofFiles([...selectedFiles, ...input.files]);
    if (errors.length) {
      const first = errors[0];
      toast(t(first.key, first.params), "error");
      input.value = "";
      return;
    }
    selectedFiles = [...selectedFiles, ...Array.from(input.files)];
    input.value = "";
    renderPreviews(previews);
  });

  renderPreviews(previews);
}

function renderPreviews(previews) {
  previews.replaceChildren();
  selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const item = el("div", { class: "proof-preview" });
    const img = el("img", { src: url, alt: file.name });
    img.addEventListener("load", () => URL.revokeObjectURL(url));
    const remove = el(
      "button",
      {
        class: "proof-preview__remove",
        type: "button",
        "aria-label": t("offer.submit.removeImage"),
        title: t("offer.submit.removeImage"),
        onclick: () => {
          selectedFiles.splice(index, 1);
          renderPreviews(previews);
        },
      },
      "×",
    );
    item.append(img, remove);
    previews.append(item);
  });
}

// ---------------------------------------------------------------------
// Submission form
// ---------------------------------------------------------------------

function initSubmissionForm() {
  const form = qs("[data-offer-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitProof(form);
  });
}

async function submitProof(form) {
  const errorNode = qs("[data-offer-form-error]", form);
  errorNode.textContent = "";

  const taskTitle = qs("[data-input-task]", form).value.trim();
  const message = qs("[data-input-message]", form).value.trim();
  const walletNumber = qs("[data-input-wallet]", form).value.trim();

  // --- client validation (Firestore + Storage rules remain the gate)
  if (!taskTitle) return (errorNode.textContent = t("offer.submit.errors.taskTitleRequired"));
  if (!walletNumber) return (errorNode.textContent = t("offer.submit.errors.walletRequired"));
  if (!selectedFiles.length) return (errorNode.textContent = t("offer.submit.errors.imagesRequired"));

  const { user } = await waitForAuthState();
  if (!user) return;

  await withBusy(qs("[data-offer-submit]", form), async () => {
    try {
      await createSubmission({ offer, user, taskTitle, message, walletNumber, files: selectedFiles });
      qs("[data-offer-form-panel]").hidden = true;
      qs("[data-offer-success]").hidden = false;
      qs("[data-offer-success]").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("[offer] submission failed", error);
      errorNode.textContent = t("offer.submit.errorBody");
    }
  });
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  await renderOfferShell();
  initFilePicker();
  initSubmissionForm();

  onLocaleChange(async () => {
    if (offer) {
      renderOfferDetails();
      await renderVisitorState();
    }
  });
}

export { init };
