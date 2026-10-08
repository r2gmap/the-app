// =====================================================================
// Shared Offer Card Renderer
// =====================================================================
// One renderer powers the homepage, category pages, browse page and
// member dashboard. Keeping the card markup in each page's <template>
// means the visual structure remains easy to edit without touching data
// logic; this module only fills the safe text/image hooks.
//
// Future content fields belong in the CMS and should be mapped here once
// so every surface stays consistent: title, description, requirement,
// thumbnail, reward, estimated time and difficulty.
// =====================================================================

import { localizedText, getLocale, t } from "./i18n.js";
import { formatMoney } from "./format.js";

const CATEGORIES = ["game", "app", "website", "offer"];

/** CSS-only cover art keeps cards useful when a CMS image is not set. */
function generatedCoverStyle(category = "offer") {
  const palettes = {
    game: ["#123a45", "#24736c"],
    app: ["#1f3158", "#5577a8"],
    website: ["#503e30", "#a16e42"],
    offer: ["#3d3658", "#75659e"],
  };
  const [from, to] = palettes[category] || palettes.offer;
  return `background: radial-gradient(circle at 78% 20%, rgba(255,255,255,.18), transparent 28%), linear-gradient(135deg, ${from}, ${to});`;
}

function categoryLabel(category) {
  return t(`categories.${category}`);
}

function categoryLabelPlural(category) {
  return t(`categoriesPlural.${category}`);
}

function difficultyLabel(difficulty) {
  return difficulty ? t(`difficulty.${difficulty}`) : "";
}

function localizedRequirements(item) {
  const source = item?.requirementsAr && document.documentElement.lang === "ar"
    ? item.requirementsAr
    : item?.requirements;
  if (Array.isArray(source)) return source.filter(Boolean).map(String);
  if (source) return String(source).split(/\n|•/).map((value) => value.trim()).filter(Boolean);
  const fallback = localizedText(item, "requirement");
  return fallback ? [fallback] : [];
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value || "";
}

/**
 * Renders one CMS item into a page's #offer-card-template target.
 * `authed` controls whether the CTA points to the detail flow or signup.
 */
function renderOfferCard(container, offer, { authed = false, linkToDetails = true } = {}) {
  const template = document.querySelector("#offer-card-template");
  if (!template || !container || !offer) return null;

  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".offer-card");
  const media = fragment.querySelector("[data-card-media]");
  const image = offer.image || offer.thumbnail;
  const title = localizedText(offer, "title") || "Untitled opportunity";
  const requirement = localizedText(offer, "requirement") || localizedRequirements(offer)[0] || "Complete the listed requirement";
  const time = localizedText(offer, "estimatedTime");
  const difficulty = offer.difficulty || "";

  if (media) {
    media.setAttribute("style", generatedCoverStyle(offer.category));
    const typeNode = media.querySelector("[data-card-type]");
    if (typeNode) typeNode.textContent = categoryLabel(offer.category);
    if (image) {
      const img = document.createElement("img");
      img.className = "offer-card__image";
      img.src = image;
      img.alt = "";
      img.addEventListener("error", () => img.remove());
      media.prepend(img);
    } else {
      const initial = document.createElement("span");
      initial.className = "offer-card__cover-initial";
      initial.setAttribute("aria-hidden", "true");
      initial.textContent = title.charAt(0).toUpperCase();
      media.append(initial);
    }
  }

  setText(card, "[data-card-title]", title);
  setText(card, "[data-card-desc]", localizedText(offer, "description"));
  setText(card, "[data-card-requirement]", requirement);
  setText(card, "[data-card-requirement-label]", t("offers.requirementLabel"));
  setText(card, "[data-card-reward-label]", t("offers.rewardLabel"));
  setText(card, "[data-card-reward]", formatMoney(offer.reward, getLocale()));

  const timeNode = card.querySelector("[data-card-time]");
  if (timeNode) {
    timeNode.hidden = !time;
    setText(timeNode, "[data-card-time-value]", time);
  }
  const difficultyNode = card.querySelector("[data-card-difficulty]");
  if (difficultyNode) {
    difficultyNode.hidden = !difficulty;
    difficultyNode.classList.add(`offer-card__chip--${difficulty}`);
    setText(difficultyNode, "[data-card-difficulty-value]", difficultyLabel(difficulty));
  }

  const cta = card.querySelector("[data-card-cta]");
  if (cta) {
    const detailsAvailable = linkToDetails && offer.id;
    cta.href = detailsAvailable && authed ? `offer.html?id=${encodeURIComponent(offer.id)}` : "register.html";
    cta.textContent = detailsAvailable && authed ? t("offers.viewOffer") : t("nav.signUp");
  }
  card.dataset.category = offer.category || "";
  card.dataset.offerId = offer.id || "";
  container.append(fragment);
  return card;
}

export {
  CATEGORIES,
  generatedCoverStyle,
  categoryLabel,
  categoryLabelPlural,
  difficultyLabel,
  localizedRequirements,
  renderOfferCard,
};
