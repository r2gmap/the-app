// =====================================================================
// Offers — shared rendering + demo fallback data
// =====================================================================
// Used by the landing page, the offers browser and the user dashboard.
// Responsibilities:
//   - render an offer card from the <template id="offer-card-template">
//     into any container (identical markup for demo and live data)
//   - generate cover art when an offer has no image
//   - provide the small demo catalogue shown while nothing is published
//
// Data comes from offers-service.js (Firestore); this file never talks
// to Firebase itself — it only renders what it is given.
// =====================================================================

import { t, localizedText, getLocale } from "./i18n.js";
import { formatMoney } from "./format.js";
import { qs, el } from "./ui.js";

// ---------------------------------------------------------------------
// Offer shape (mirrors the Firestore `offers` collection)
// ---------------------------------------------------------------------
// {
//   id, title, titleAr, description, descriptionAr,
//   category: "game" | "app" | "website",
//   reward: number, difficulty: "easy"|"medium"|"hard",
//   estimatedTime, estimatedTimeAr,
//   requirements: string[], requirementsAr: string[],
//   instructions, instructionsAr, image: string|null, banner: string|null,
//   status: "draft"|"published", active: boolean, featured: boolean,
//   displayOrder: number, createdAt, updatedAt
// }

// Every category the platform renders. Each one has its own public
// page (games / apps / websites / offers) fed by the same collection.
const CATEGORIES = ["game", "app", "website", "offer"];

/** Localized label for a category (game/app/website/offer). */
function categoryLabel(category) {
  return t(`categories.${category}`);
}

/** Localized difficulty label. */
function difficultyLabel(difficulty) {
  return t(`difficulty.${difficulty}` || "difficulty.medium");
}

// ---------------------------------------------------------------------
// Generated cover art (no image uploaded)
// ---------------------------------------------------------------------

// One hue per category so cards are recognizable at a glance.
const CATEGORY_HUES = { game: 265, app: 190, website: 155, offer: 32 };

/**
 * Returns CSS background for an offer without an image: a soft
 * gradient tinted by category. Applied inline on the media block.
 */
function generatedCoverStyle(category) {
  const hue = CATEGORY_HUES[category] ?? 220;
  return `background: linear-gradient(150deg, hsl(${hue} 45% 16%), hsl(${hue + 25} 55% 9%))`;
}

/** First letter of the title, shown large on generated covers. */
function coverInitial(offer) {
  const title = localizedText(offer, "title") || "?";
  return title.charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------
// Card rendering
// ---------------------------------------------------------------------

/**
 * Renders one offer card into `container` by cloning the shared
 * template. All user/admin content is inserted with textContent and
 * safe attributes only — never innerHTML.
 *
 * `options.authed` decides where the card's CTA points:
 *   - signed in  -> offer.html?id=<offerId> (real offers)
 *                   register.html (demo offers — they have no page)
 *   - signed out -> register.html (existing landing behaviour)
 */
function renderOfferCard(container, offer, options = {}) {
  const template = qs("#offer-card-template");
  if (!template) return null;

  const card = template.content.firstElementChild.cloneNode(true);
  const isDemo = Boolean(offer.demo);

  // --- media block: uploaded image or generated cover art
  const media = qs("[data-card-media]", card);
  if (offer.image) {
    const img = el("img", { class: "offer-card__image", src: offer.image, alt: "" });
    img.addEventListener("error", () => {
      img.remove();
      applyGeneratedCover(media, offer);
    });
    media.append(img);
  } else {
    applyGeneratedCover(media, offer);
  }
  qs("[data-card-type]", card).textContent = categoryLabel(offer.category);

  // --- featured ribbon (content marked as featured by an admin)
  if (offer.featured) {
    qs("[data-card-media]", card).append(
      el("span", { class: "badge badge--featured offer-card__featured" }, t("common.featuredLabel")),
    );
  }

  // --- body: localized title, description, requirement, reward
  qs("[data-card-title]", card).textContent = localizedText(offer, "title");
  qs("[data-card-desc]", card).textContent = localizedText(offer, "description");

  const requirement = Array.isArray(offer.requirements)
    ? localizedRequirements(offer)[0] || ""
    : "";
  qs("[data-card-requirement]", card).textContent = requirement;
  qs("[data-card-requirement-label]", card).textContent = `${t("offers.requirementLabel")}:`;

  qs("[data-card-reward-label]", card).textContent = t("offers.rewardLabel");
  qs("[data-card-reward]", card).textContent = formatMoney(offer.reward, getLocale());

  // --- call to action
  const cta = qs("[data-card-cta]", card);
  cta.textContent = t("offers.viewOffer");
  if (isDemo) {
    cta.href = "register.html";
  } else if (options.authed || options.linkToDetails) {
    cta.href = `offer.html?id=${encodeURIComponent(offer.id)}`;
  } else {
    cta.href = "register.html";
  }

  container.append(card);
  return card;
}

/** Applies the generated cover (gradient + initial) to a media block. */
function applyGeneratedCover(media, offer) {
  media.setAttribute("style", generatedCoverStyle(offer.category));
  media.append(el("span", { class: "offer-card__cover-initial", "aria-hidden": "true" }, coverInitial(offer)));
}

/** Localized requirements list (falls back to the English list). */
function localizedRequirements(offer) {
  if (getLocale() === "ar" && Array.isArray(offer.requirementsAr) && offer.requirementsAr.length) {
    return offer.requirementsAr;
  }
  return Array.isArray(offer.requirements) ? offer.requirements : [];
}

// ---------------------------------------------------------------------
// Demo catalogue
// ---------------------------------------------------------------------
// Shown while `offers` has no live documents. Every demo card carries
// `demo: true` so the UI can badge it and never link it to a detail
// page. English + Arabic text included.

function demoOffers() {
  return [
    {
      demo: true,
      id: "demo-game-1",
      title: "Space Frontier",
      titleAr: "جبهة الفضاء",
      description: "A relaxed space exploration game. Reach the target level and send a screenshot.",
      descriptionAr: "لعبة استكشاف فضاء هادئة. صِل إلى المستوى المطلوب وأرسل لقطة شاشة.",
      category: "game",
      reward: 0.5,
      difficulty: "easy",
      estimatedTime: "10–15 minutes",
      estimatedTimeAr: "10–15 دقيقة",
      requirements: ["Reach level 5", "Send a screenshot of your level"],
      requirementsAr: ["الوصول إلى المستوى 5", "إرسال لقطة شاشة للمستوى"],
      instructions: "Install the game, play until level 5, then upload a screenshot showing your level.",
      instructionsAr: "ثبّت اللعبة والعب حتى المستوى 5 ثم ارفع لقطة شاشة تُظهر مستواك.",
      image: null,
      active: true,
    },
    {
      demo: true,
      id: "demo-game-2",
      title: "Empire Tycoon",
      titleAr: "قطب الإمبراطوريات",
      description: "Build your first settlement and keep it running for one full day.",
      descriptionAr: "ابنِ مستوطنتك الأولى وأبقِها تعمل ليوم كامل.",
      category: "game",
      reward: 0.75,
      difficulty: "medium",
      estimatedTime: "20–30 minutes",
      estimatedTimeAr: "20–30 دقيقة",
      requirements: ["Build a settlement", "Keep it active for 24 hours"],
      requirementsAr: ["بناء مستوطنة", "إبقاؤها نشطة لمدة 24 ساعة"],
      instructions: "Install the game, complete the tutorial and build your first settlement.",
      instructionsAr: "ثبّت اللعبة وأكمل الدرس التمهيدي وابنِ مستوطنتك الأولى.",
      image: null,
      active: true,
    },
    {
      demo: true,
      id: "demo-app-1",
      title: "FitTrack",
      titleAr: "فِت تراك",
      description: "A simple step counter. Log 5,000 steps in a day and screenshot your total.",
      descriptionAr: "عدّاد خطوات بسيط. سجّل 5000 خطوة في اليوم وأرسل لقطة لإجماليك.",
      category: "app",
      reward: 0.4,
      difficulty: "easy",
      estimatedTime: "A full day",
      estimatedTimeAr: "يوم كامل",
      requirements: ["Install the app", "Reach 5,000 steps in one day"],
      requirementsAr: ["تثبيت التطبيق", "الوصول إلى 5000 خطوة في يوم واحد"],
      instructions: "Install FitTrack, allow the step counter, and screenshot today's total at 5,000+.",
      instructionsAr: "ثبّت فِت تراق وفعّل عدّاد الخطوات وأرسل لقطة لإجمالي اليوم عند تجاوز 5000.",
      image: null,
      active: true,
    },
    {
      demo: true,
      id: "demo-app-2",
      title: "Lingo Cards",
      titleAr: "بطاقات لينجو",
      description: "Flashcards for language learners. Finish the first deck with a passing score.",
      descriptionAr: "بطاقات تعليمية لمتعلمي اللغات. أكمل المجموعة الأولى بدرجة ناجحة.",
      category: "app",
      reward: 0.6,
      difficulty: "easy",
      estimatedTime: "15–20 minutes",
      estimatedTimeAr: "15–20 دقيقة",
      requirements: ["Complete deck one", "Score 80% or higher"],
      requirementsAr: ["إكمال المجموعة الأولى", "الحصول على 80% أو أكثر"],
      instructions: "Install the app, open the first deck, finish it and screenshot your score.",
      instructionsAr: "ثبّت التطبيق وافتح المجموعة الأولى وأكملها وأرسل لقطة لدرجتك.",
      image: null,
      active: true,
    },
    {
      demo: true,
      id: "demo-offer-1",
      title: "Weekend Survey Sprint",
      titleAr: "سباق استبيانات نهاية الأسبوع",
      description: "Answer three short surveys and screenshot the completion screen.",
      descriptionAr: "أجب عن ثلاثة استبيانات قصيرة وأرسل لقطة لشاشة الإكمال.",
      category: "offer",
      reward: 0.45,
      difficulty: "easy",
      estimatedTime: "Around 10 minutes",
      estimatedTimeAr: "نحو 10 دقائق",
      requirements: ["Complete all three surveys", "Screenshot the completion screen"],
      requirementsAr: ["إكمال الاستبيانات الثلاثة", "إرسال لقطة لشاشة الإكمال"],
      instructions: "Open the survey hub from the task link, finish all three surveys, then upload one screenshot of the completion screen.",
      instructionsAr: "افتح مركز الاستبيانات من رابط المهمة وأكمل الاستبيانات الثلاثة ثم ارفع لقطة واحدة لشاشة الإكمال.",
      image: null,
      active: true,
    },
  ];
}

export { renderOfferCard, demoOffers, categoryLabel, difficultyLabel, localizedRequirements, generatedCoverStyle, CATEGORIES };
