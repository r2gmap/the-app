// =====================================================================
// Content Service — Firestore `offers` collection
// =====================================================================
// The reusable content structure powering the whole public site:
// Games / Apps / Websites / Offers all live in ONE collection and are
// separated by the `category` field, so each category automatically
// appears in its own section of the website with no code changes.
//
//   offers/{contentId}: {
//     title, titleAr,                       // localized title
//     description, descriptionAr,           // SHORT description (cards)
//     fullDescription, fullDescriptionAr,   // FULL description (details)
//     category: "game" | "app" | "website" | "offer",
//     reward: number (USD),
//     difficulty: "easy" | "medium" | "hard",
//     estimatedTime, estimatedTimeAr,
//     requirements: string[], requirementsAr: string[],
//     instructions, instructionsAr,
//     image: string | null,                 // thumbnail (Storage URL)
//     banner: string | null,                // wide banner (details page)
//     status: "draft" | "published",        // draft is never public
//     active: boolean,                      // kept in sync with status
//                                          // (legacy mirror — public
//                                          // queries + rules filter on it)
//     featured: boolean,                    // homepage + dashboard strip
//     displayOrder: number,                 // lower shows first
//     createdBy, createdAt, updatedAt
//   }
//
// Draft/publish contract: `status` is the source of truth and `active`
// is always written as (status === "published") so legacy queries,
// security rules and old documents keep working unchanged. Drafts are
// invisible to users at the query AND rule level.
//
// Reads for the public site are limited to published content by both
// the query and firestore.rules. Writes are admin-only (rules).
// =====================================================================

import { getFirebase } from "../firebase.js";

// Every category the platform supports. Adding a category here (plus a
// label key + page) is all it takes to introduce a new content type.
const CONTENT_CATEGORIES = ["game", "app", "website", "offer"];

// ---------------------------------------------------------------------
// Public reads (guests + users) — published content only
// ---------------------------------------------------------------------

/**
 * Fetches PUBLISHED content, display order first (lower number first),
 * then newest — optionally filtered by category.
 * Used by the homepage groups, the category pages and the dashboard.
 */
async function fetchActiveOffers(category = null, maxCount = 24) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");

  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const constraints = [
    where("active", "==", true),
    orderBy("displayOrder", "asc"),
    orderBy("createdAt", "desc"),
    limit(maxCount),
  ];
  if (category) constraints.splice(1, 0, where("category", "==", category));

  // Firestore snapshot -> plain objects (id merged in).
  const snapshot = await getDocs(query(collection(fb.db, "offers"), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetches PUBLISHED + FEATURED content for the homepage and dashboard
 * featured sections, display order first.
 */
async function fetchFeaturedOffers(maxCount = 6) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");

  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(
      collection(fb.db, "offers"),
      where("active", "==", true),
      where("featured", "==", true),
      orderBy("displayOrder", "asc"),
      orderBy("createdAt", "desc"),
      limit(maxCount),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetches a single content item by id. Returns null when missing.
 * Visibility (draft vs published) is enforced by the caller + rules:
 * guests can only GET published documents anyway.
 */
async function fetchOfferById(offerId) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, getDoc } = fb.sdk.db;
  const snapshot = await getDoc(doc(fb.db, "offers", offerId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

// ---------------------------------------------------------------------
// Admin reads + writes
// ---------------------------------------------------------------------

/** Lists ALL content (draft + published) for the admin console, newest first. */
async function fetchAllOffers(maxCount = 200) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(collection(fb.db, "offers"), orderBy("createdAt", "desc"), limit(maxCount)),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Builds the Firestore payload from the admin content form. Shared by
 * create and update so both write the exact same shape — the single
 * source of truth for the content document schema.
 *
 * `active` is derived from `status` here so the two can never drift.
 */
function offerDocumentData(form, adminUid) {
  const status = form.status === "draft" ? "draft" : "published";
  // Defensive text helper: tolerates undefined optional fields.
  const text = (value) => String(value ?? "").trim();
  return {
    title: text(form.title),
    titleAr: text(form.titleAr),
    description: text(form.description),
    descriptionAr: text(form.descriptionAr),
    fullDescription: text(form.fullDescription),
    fullDescriptionAr: text(form.fullDescriptionAr),
    category: form.category,
    reward: Number(form.reward),
    difficulty: form.difficulty,
    estimatedTime: text(form.estimatedTime),
    estimatedTimeAr: text(form.estimatedTimeAr),
    requirements: splitLines(form.requirements),
    requirementsAr: splitLines(form.requirementsAr),
    instructions: text(form.instructions),
    instructionsAr: text(form.instructionsAr),
    image: form.image || null,
    banner: form.banner || null,
    status,
    active: status === "published",
    featured: Boolean(form.featured),
    displayOrder: Number.isFinite(Number(form.displayOrder)) ? Number(form.displayOrder) : 100,
    createdBy: adminUid || null,
  };
}

/** Splits a textarea value into a clean list of non-empty lines. */
const splitLines = (text) =>
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Creates a new content item (draft or published). */
async function createOffer(form, adminUid) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, addDoc, serverTimestamp } = fb.sdk.db;
  const payload = offerDocumentData(form, adminUid);
  const ref = await addDoc(collection(fb.db, "offers"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Updates an existing content item (full form save). */
async function updateOffer(offerId, form, adminUid) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, updateDoc, serverTimestamp } = fb.sdk.db;
  await updateDoc(doc(fb.db, "offers", offerId), {
    ...offerDocumentData(form, adminUid),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Publishes or unpublishes a content item (the quick toggle in the
 * admin list). `active` is kept in sync with the new status.
 */
async function setContentStatus(offerId, status) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, updateDoc, serverTimestamp } = fb.sdk.db;
  const published = status === "published";
  await updateDoc(doc(fb.db, "offers", offerId), {
    status: published ? "published" : "draft",
    active: published,
    updatedAt: serverTimestamp(),
  });
}

/** Legacy alias: activate/deactivate maps onto publish/unpublish. */
async function setOfferActive(offerId, active) {
  return setContentStatus(offerId, active ? "published" : "draft");
}

/** Marks or unmarks a content item as featured (homepage + dashboard). */
async function setContentFeatured(offerId, featured) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, updateDoc, serverTimestamp } = fb.sdk.db;
  await updateDoc(doc(fb.db, "offers", offerId), { featured: Boolean(featured), updatedAt: serverTimestamp() });
}

/** Writes a new display order value (used by the admin reorder arrows). */
async function updateContentOrder(offerId, displayOrder) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, updateDoc, serverTimestamp } = fb.sdk.db;
  await updateDoc(doc(fb.db, "offers", offerId), {
    displayOrder: Number(displayOrder) || 0,
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a content item permanently (admin list, after confirmation). */
async function deleteOffer(offerId) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, deleteDoc } = fb.sdk.db;
  await deleteDoc(doc(fb.db, "offers", offerId));
}

// ---------------------------------------------------------------------
// Admin: media uploads (Firebase Storage)
// ---------------------------------------------------------------------

/**
 * Uploads a content image to Firebase Storage and returns its download
 * URL. `kind` is "thumbnail" (cards, lists) or "banner" (details page)
 * and only shapes the storage path — both live under offer-images/,
 * which storage.rules opens for public reads and admin-only writes.
 * Saving the returned URL into the Firestore document is what makes
 * image replacement propagate automatically to every surface.
 */
async function uploadContentImage(file, kind = "thumbnail") {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { ref, uploadBytes, getDownloadURL } = fb.sdk.storage;
  const safeName = String(file.name || "image").replace(/[^\w.\-]+/g, "_");
  const path = `offer-images/${kind}/${Date.now()}_${safeName}`;
  const storageRef = ref(fb.storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/** Legacy alias kept for older callers (thumbnail upload). */
const uploadOfferImage = (file) => uploadContentImage(file, "thumbnail");

export {
  CONTENT_CATEGORIES,
  fetchActiveOffers,
  fetchFeaturedOffers,
  fetchOfferById,
  fetchAllOffers,
  createOffer,
  updateOffer,
  setOfferActive,
  setContentStatus,
  setContentFeatured,
  updateContentOrder,
  deleteOffer,
  uploadContentImage,
  uploadOfferImage,
};
