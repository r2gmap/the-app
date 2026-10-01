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

import { getFirebase } from "./firebase.js";

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
// Admin: media + file uploads (Firebase Storage)
// ---------------------------------------------------------------------
//
// THE ASSET REGISTRY — every file type the platform can attach to
// content is declared HERE, in one place. Adding a future file type
// (an APK download for an app offer, a ZIP resource pack, a PDF
// rulebook…) is exactly two steps:
//
//   1. Add a row to ASSET_KINDS below (folder, accepted MIME types,
//      size cap, human label).
//   2. Open the matching folder in storage.rules (see the prepared
//      offer-files/ block there) and adjust its size limit if needed.
//
// Nothing else changes: uploadContentAsset() validates against this
// registry, stores the file under the right folder, and hands back the
// download URL that gets saved into the Firestore document.
const ASSET_KINDS = {
  // --- in use today ---------------------------------------------------
  thumbnail: {
    folder: "offer-images/thumbnail",
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * 1024 * 1024,
  },
  banner: {
    folder: "offer-images/banner",
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * 1024 * 1024,
  },
  // --- prepared for future features (not wired to a form yet) ---------
  apk: {
    folder: "offer-files/apk",
    accept: ["application/vnd.android.package-archive"],
    maxBytes: 100 * 1024 * 1024,
  },
  zip: {
    folder: "offer-files/zip",
    accept: ["application/zip", "application/x-zip-compressed"],
    maxBytes: 100 * 1024 * 1024,
  },
  pdf: {
    folder: "offer-files/pdf",
    accept: ["application/pdf"],
    maxBytes: 20 * 1024 * 1024,
  },
};

/**
 * Generic content uploader. Validates the file against the ASSET_KINDS
 * registry (MIME type + size cap) BEFORE touching the network, stores
 * it under the kind's folder, and returns the download URL to save in
 * Firestore. All future file uploads (APK / ZIP / PDF / new images)
 * flow through this one function so validation stays consistent.
 */
async function uploadContentAsset(file, kind = "thumbnail") {
  const spec = ASSET_KINDS[kind];
  if (!spec) throw new Error(`unknown-asset-kind:${kind}`);

  // --- client-side gate (storage.rules enforce the same server-side)
  if (file && spec.accept.length && !spec.accept.includes(file.type)) {
    throw new Error("unsupported-file-type");
  }
  if (file && file.size > spec.maxBytes) {
    throw new Error("file-too-large");
  }

  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { ref, uploadBytes, getDownloadURL } = fb.sdk.storage;

  // Timestamped, sanitized names keep folders tidy and cache-safe.
  const safeName = String(file.name || "asset").replace(/[^\w.\-]+/g, "_");
  const path = `${spec.folder}/${Date.now()}_${safeName}`;
  const storageRef = ref(fb.storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/**
 * Uploads a content image (thumbnail or banner). Kept as a thin alias
 * over uploadContentAsset so existing callers read clearly at the
 * call site. Saving the returned URL into the Firestore document is
 * what makes image replacement propagate to every surface.
 */
async function uploadContentImage(file, kind = "thumbnail") {
  return uploadContentAsset(file, kind);
}

/** Legacy alias kept for older callers (thumbnail upload). */
const uploadOfferImage = (file) => uploadContentImage(file, "thumbnail");

// ---------------------------------------------------------------------
// Admin: duplicate content
// ---------------------------------------------------------------------

/**
 * Duplicates an existing content item. The copy keeps every field
 * (including image URLs — Storage files are shared, not copied) but
 * ALWAYS starts as a draft with " (copy)" appended to the title, so a
 * duplicate can never appear publicly before an admin reviews it.
 * Returns the new document id.
 */
async function duplicateOffer(offerId, adminUid) {
  const source = await fetchOfferById(offerId);
  if (!source) throw new Error("content-not-found");

  // Map the stored document back into the form shape used by
  // createOffer — the single source of truth for the schema.
  const copy = {
    title: `${source.title || ""} (copy)`.trim(),
    titleAr: source.titleAr || "",
    description: source.description || "",
    descriptionAr: source.descriptionAr || "",
    fullDescription: source.fullDescription || "",
    fullDescriptionAr: source.fullDescriptionAr || "",
    category: source.category || "game",
    reward: Number(source.reward) || 0,
    difficulty: source.difficulty || "easy",
    estimatedTime: source.estimatedTime || "",
    estimatedTimeAr: source.estimatedTimeAr || "",
    requirements: Array.isArray(source.requirements) ? source.requirements : [],
    requirementsAr: Array.isArray(source.requirementsAr) ? source.requirementsAr : [],
    instructions: source.instructions || "",
    instructionsAr: source.instructionsAr || "",
    image: source.image || null,
    banner: source.banner || null,
    status: "draft", // a duplicate is never born public
    featured: false, // and never featured until an admin chooses
    displayOrder: source.displayOrder ?? 100,
  };
  return createOffer(copy, adminUid);
}

export {
  CONTENT_CATEGORIES,
  ASSET_KINDS,
  fetchActiveOffers,
  fetchFeaturedOffers,
  fetchOfferById,
  fetchAllOffers,
  createOffer,
  updateOffer,
  duplicateOffer,
  uploadContentAsset,
  setOfferActive,
  setContentStatus,
  setContentFeatured,
  updateContentOrder,
  deleteOffer,
  uploadContentImage,
  uploadOfferImage,
};
