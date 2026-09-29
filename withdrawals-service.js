// =====================================================================
// Withdrawals Service — Firestore `withdrawals` collection
// =====================================================================
// Users request payouts; admins approve (recording a negative wallet
// transaction) or reject (with a reason). Both decisions notify the
// user in-app and ping the admin Telegram group.
//
//   withdrawals/{id}: {
//     userId, userName, email,
//     amount: number,             // always positive here
//     walletNumber,               // payout destination
//     status: "pending" | "approved" | "rejected",
//     rejectionReason, reviewedBy, reviewedAt,
//     createdAt, updatedAt
//   }
// =====================================================================

import { getFirebase } from "../firebase.js";
import { createNotification } from "./notifications-service.js";
import { sendWithdrawalNotification } from "../telegram/telegram-service.js";

// Platform-wide minimum withdrawal (USD). Change it here — it is shown
// in the UI hint and enforced by client validation + admin review.
const MIN_WITHDRAWAL = 1;

// ---------------------------------------------------------------------
// User flow
// ---------------------------------------------------------------------

/**
 * Creates a withdrawal request. The UI validates amount/wallet first;
// the admin review is the real gate (a request never moves money by
 * itself — only approval writes a transaction).
 */
async function createWithdrawalRequest({ user, amount, walletNumber }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, addDoc, serverTimestamp } = fb.sdk.db;

  const payload = {
    userId: user.uid,
    userName: user.displayName || user.email?.split("@")[0] || "",
    email: user.email || "",
    amount: Number(amount),
    walletNumber: String(walletNumber || "").trim(),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(fb.db, "withdrawals"), payload);
  return ref.id;
}

/** The user's withdrawal requests, newest first. */
async function fetchUserWithdrawals(userId, maxCount = 50) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(
      collection(fb.db, "withdrawals"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(maxCount),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------

/** Lists withdrawal requests by status (or all), newest first. */
async function fetchWithdrawals(status = null, maxCount = 100) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  constraints.push(orderBy("createdAt", "desc"), limit(maxCount));
  const snapshot = await getDocs(query(collection(fb.db, "withdrawals"), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------
// Admin actions: approve / reject
// ---------------------------------------------------------------------

/**
 * Approves a withdrawal request. One atomic batch:
 *   1. the request flips to "approved"
 *   2. a NEGATIVE transaction records the payout (wallet decreases)
 *   3. the user receives an in-app notification
 * Telegram ping follows best-effort.
 */
async function approveWithdrawal(withdrawal, adminUser) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, writeBatch, serverTimestamp } = fb.sdk.db;

  const amount = Math.abs(Number(withdrawal.amount) || 0);
  const batch = writeBatch(fb.db);

  batch.update(doc(fb.db, "withdrawals", withdrawal.id), {
    status: "approved",
    reviewedBy: adminUser.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(fb.db, "transactions", crypto.randomUUID()), {
    userId: withdrawal.userId,
    type: "withdrawal",
    amount: -amount,
    description: `Withdrawal to ${withdrawal.walletNumber}`,
    withdrawalId: withdrawal.id,
    createdBy: adminUser.uid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(fb.db, "notifications", crypto.randomUUID()), {
    userId: withdrawal.userId,
    type: "withdrawal_approved",
    data: { amount },
    read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  sendWithdrawalNotification({ ...withdrawal, amount }, "approved").catch(() => {});
}

/**
 * Rejects a withdrawal request with a reason (atomic: status update +
 * user notification; no money moves).
 */
async function rejectWithdrawal(withdrawal, reason, adminUser) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { doc, writeBatch, serverTimestamp } = fb.sdk.db;

  const batch = writeBatch(fb.db);
  batch.update(doc(fb.db, "withdrawals", withdrawal.id), {
    status: "rejected",
    rejectionReason: String(reason || "").trim(),
    reviewedBy: adminUser.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(fb.db, "notifications", crypto.randomUUID()), {
    userId: withdrawal.userId,
    type: "withdrawal_rejected",
    data: { amount: Math.abs(Number(withdrawal.amount) || 0), reason: String(reason || "").trim() },
    read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  sendWithdrawalNotification(withdrawal, "rejected").catch(() => {});
}

export {
  MIN_WITHDRAWAL,
  createWithdrawalRequest,
  fetchUserWithdrawals,
  fetchWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};
