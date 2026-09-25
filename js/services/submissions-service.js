// =====================================================================
// Submissions Service — Firestore `taskSubmissions` + Storage proofs
// =====================================================================
// The complete task-submission pipeline:
//
//   taskSubmissions/{id}: {
//     userId, userName, email,
//     offerId, offerTitle,            // snapshot of the offer at send time
//     taskTitle, message, walletNumber,
//     proofImages: string[],          // Storage download URLs
//     rewardSnapshot: number,         // reward promised when submitted
//     status: "pending" | "approved" | "rejected",
//     rejectionReason, reviewedBy, reviewedAt,
//     createdAt, updatedAt
//   }
//
// Flow: user submits -> status "pending" -> admin reviews -> approve
// (batch: status + wallet transaction + notification) or reject (with a
// reason the user receives as a notification). Users can never edit a
// submission after creation — only the rules-permitted proofImages
// completion right after creating the document.
// =====================================================================

import { getFirebase } from "../firebase.js";
import { createNotification } from "./notifications-service.js";
import { sendSubmissionNotification } from "../telegram/telegram-service.js";

// Proof image limits (validated client-side AND in storage.rules).
const MAX_PROOF_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------
// Validation (shared by the form UI and the upload path)
// ---------------------------------------------------------------------

/**
 * Checks a FileList against the proof rules. Returns an array of
 * i18n error keys (empty when everything is acceptable).
 */
function validateProofFiles(files) {
  const errors = [];
  const list = Array.from(files || []);
  if (list.length > MAX_PROOF_IMAGES) errors.push({ key: "offer.submit.errors.tooManyFiles" });
  for (const file of list) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push({ key: "offer.submit.errors.invalidType", params: { name: file.name } });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      errors.push({ key: "offer.submit.errors.fileTooLarge", params: { name: file.name } });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------
// User flow: create a submission
// ---------------------------------------------------------------------

/**
 * Creates the submission document, uploads every proof image to
 * Firebase Storage (`proofs/{userId}/{submissionId}/…`), then saves the
 * download URLs back onto the document.
 *
 * Resolves with the created submission id. Throws on any failure — the
 * form UI is responsible for showing a localized error.
 */
async function createSubmission({ offer, user, taskTitle, message, walletNumber, files }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, addDoc, doc, updateDoc, serverTimestamp } = fb.sdk.db;

  // 1) Document first (status pending, no images yet)…
  const payload = {
    userId: user.uid,
    userName: user.displayName || user.email?.split("@")[0] || "",
    email: user.email || "",
    offerId: offer.id,
    offerTitle: offer.title || "",
    taskTitle: String(taskTitle || "").trim(),
    message: String(message || "").trim(),
    walletNumber: String(walletNumber || "").trim(),
    proofImages: [],
    rewardSnapshot: Number(offer.reward) || 0,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const submissionRef = await addDoc(collection(fb.db, "taskSubmissions"), payload);

  // 2) …then upload the proof images and complete the document.
  try {
    const urls = await uploadProofImages(user.uid, submissionRef.id, files);
    await updateDoc(submissionRef, { proofImages: urls, updatedAt: serverTimestamp() });
  } catch (error) {
    // The submission exists but has no images — delete it so the user
    // can retry cleanly instead of leaving a proof-less pending row.
    const { deleteDoc } = fb.sdk.db;
    await deleteDoc(submissionRef).catch(() => {});
    throw error;
  }

  // 3) Notify the admin team via Telegram. Best-effort and never part
  //    of the critical path (see telegram-service.js for the security
  //    model — sending happens from the admin client).
  fireAdminPing(() => sendSubmissionNotification({ ...payload, id: submissionRef.id }, "received"));

  return submissionRef.id;
}

/** Uploads proof files under the user's own Storage folder. */
async function uploadProofImages(userId, submissionId, files) {
  const fb = await getFirebase();
  const { ref, uploadBytes, getDownloadURL } = fb.sdk.storage;
  const uploads = Array.from(files || []).slice(0, MAX_PROOF_IMAGES).map(async (file, index) => {
    const safeName = String(file.name || "proof").replace(/[^\w.\-]+/g, "_");
    const path = `proofs/${userId}/${submissionId}/${Date.now()}_${index}_${safeName}`;
    const storageRef = ref(fb.storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  });
  return Promise.all(uploads);
}

/** Runs an admin ping, swallowing every error (notifications must never fail a flow). */
function fireAdminPing(task) {
  Promise.resolve()
    .then(task)
    .catch((error) => console.warn("[telegram] notification skipped:", error?.message || error));
}

// ---------------------------------------------------------------------
// User reads
// ---------------------------------------------------------------------

/** The signed-in user's submissions, newest first. */
async function fetchUserSubmissions(userId, maxCount = 50) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(
      collection(fb.db, "taskSubmissions"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(maxCount),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** The user's latest submission for one offer (pending check on the offer page). */
async function fetchUserSubmissionForOffer(userId, offerId) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(
      collection(fb.db, "taskSubmissions"),
      where("userId", "==", userId),
      where("offerId", "==", offerId),
      orderBy("createdAt", "desc"),
      limit(1),
    ),
  );
  const first = snapshot.docs[0];
  return first ? { id: first.id, ...first.data() } : null;
}

/** Counts the user's submissions by status using the cheap count aggregation. */
async function countUserSubmissions(userId, status) {
  const fb = await getFirebase();
  if (!fb) return 0;
  const { collection, getCountFromServer, query, where } = fb.sdk.db;
  const constraints = [where("userId", "==", userId)];
  if (status) constraints.push(where("status", "==", status));
  const { count } = await getCountFromServer(query(collection(fb.db, "taskSubmissions"), ...constraints));
  return count || 0;
}

// ---------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------

/** Lists submissions by status (or all), newest first. */
async function fetchSubmissions(status = null, maxCount = 100) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  constraints.push(orderBy("createdAt", "desc"), limit(maxCount));
  const snapshot = await getDocs(query(collection(fb.db, "taskSubmissions"), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------
// Admin actions: approve / reject (atomic batches)
// ---------------------------------------------------------------------

/**
 * Approves a pending submission. In ONE Firestore batch:
 *   1. the submission flips to "approved"
 *   2. a wallet transaction credits the offer's CURRENT reward
 *      (re-read from the live offer — never a client-supplied amount)
 *   3. the user receives an in-app notification
 * Then a Telegram ping is sent best-effort.
 */
async function approveSubmission(submission, adminUser) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, getDoc, writeBatch, serverTimestamp } = fb.sdk.db;

  // The credited amount comes from the live offer document, falling
  // back to the promised snapshot if the offer was deleted meanwhile.
  let reward = Number(submission.rewardSnapshot) || 0;
  let offerTitle = submission.offerTitle;
  if (submission.offerId) {
    const offerSnap = await getDoc(doc(fb.db, "offers", submission.offerId)).catch(() => null);
    if (offerSnap?.exists()) {
      const offer = offerSnap.data();
      if (typeof offer.reward === "number") reward = offer.reward;
      if (offer.title) offerTitle = offer.title;
    }
  }

  const batch = writeBatch(fb.db);
  batch.update(doc(fb.db, "taskSubmissions", submission.id), {
    status: "approved",
    reviewedBy: adminUser.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(fb.db, "transactions", crypto.randomUUID()), {
    userId: submission.userId,
    type: "reward",
    amount: reward,
    description: `Reward: ${offerTitle}`,
    submissionId: submission.id,
    offerId: submission.offerId || null,
    createdBy: adminUser.uid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(fb.db, "notifications", crypto.randomUUID()), {
    userId: submission.userId,
    type: "submission_approved",
    data: { offerTitle, amount: reward },
    read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  fireAdminPing(() => sendSubmissionNotification({ ...submission, offerTitle, reward }, "approved"));
}

/**
 * Rejects a pending submission with a reason. Atomic batch: status
 * update + user notification; then the Telegram ping.
 */
async function rejectSubmission(submission, reason, adminUser) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, writeBatch, serverTimestamp } = fb.sdk.db;

  const batch = writeBatch(fb.db);
  batch.update(doc(fb.db, "taskSubmissions", submission.id), {
    status: "rejected",
    rejectionReason: String(reason || "").trim(),
    reviewedBy: adminUser.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(fb.db, "notifications", crypto.randomUUID()), {
    userId: submission.userId,
    type: "submission_rejected",
    data: { offerTitle: submission.offerTitle, reason: String(reason || "").trim() },
    read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  fireAdminPing(() => sendSubmissionNotification(submission, "rejected"));
}

export {
  createSubmission,
  validateProofFiles,
  fetchUserSubmissions,
  fetchUserSubmissionForOffer,
  countUserSubmissions,
  fetchSubmissions,
  approveSubmission,
  rejectSubmission,
  MAX_PROOF_IMAGES,
};
