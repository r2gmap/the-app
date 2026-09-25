// =====================================================================
// Wallet Service — Firestore `transactions` collection
// =====================================================================
// The wallet is append-only: every reward, withdrawal and adjustment is
// a transaction document, and the balance is ALWAYS the sum of them.
//
//   transactions/{id}: {
//     userId,
//     type: "reward" | "withdrawal" | "adjustment",
//     amount: number,        // positive = credit, negative = debit
//     description,
//     submissionId?, offerId?, withdrawalId?,   // traceability links
//     createdBy,             // admin uid (rules: admins write only)
//     createdAt
//   }
//
// SECURITY: users can never write transactions (firestore.rules). The
// balance is computed from server data — amounts typed into any form
// are never trusted; only the admin client, after the rules check the
// admin role, can append, and approvals re-read the live offer reward.
// =====================================================================

import { getFirebase } from "../firebase.js";

// ---------------------------------------------------------------------
// User reads
// ---------------------------------------------------------------------

/** The user's transactions, newest first. */
async function fetchUserTransactions(userId, maxCount = 100) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(
      collection(fb.db, "transactions"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(maxCount),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Sums every transaction of a user in integer cents (no float drift).
 * Pagination walks the whole history so the total is exact.
 */
async function computeUserBalance(userId) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit, startAfter } = fb.sdk.db;

  let cents = 0;
  let cursor = null;
  const pageSize = 500;

  // Walk the transaction history in pages, accumulating cents.
  for (;;) {
    const constraints = [where("userId", "==", userId), orderBy("createdAt", "desc"), limit(pageSize)];
    if (cursor) constraints.push(startAfter(cursor));
    const snapshot = await getDocs(query(collection(fb.db, "transactions"), ...constraints));
    for (const d of snapshot.docs) {
      const amount = d.data().amount;
      if (typeof amount === "number" && Number.isFinite(amount)) {
        cents += Math.round(amount * 100);
      }
    }
    if (snapshot.docs.length < pageSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  return Math.round(cents) / 100;
}

// ---------------------------------------------------------------------
// Admin reads + writes
// ---------------------------------------------------------------------

/** Lists recent transactions across all users (admin console). */
async function fetchAllTransactions(maxCount = 100) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(collection(fb.db, "transactions"), orderBy("createdAt", "desc"), limit(maxCount)),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Adds a manual adjustment (positive credit or negative deduction).
 * Admin-only by rules; creates nothing else — the wallet stays a pure
//  append-only ledger.
 */
async function addManualAdjustment({ userId, amount, description }, adminUser) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, addDoc, serverTimestamp } = fb.sdk.db;
  const ref = await addDoc(collection(fb.db, "transactions"), {
    userId,
    type: "adjustment",
    amount: Number(amount),
    description: String(description || "").trim(),
    createdBy: adminUser.uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Sum of a user's PENDING withdrawal requests (reserved money). */
async function computePendingWithdrawalsTotal(userId) {
  const fb = await getFirebase();
  if (!fb) return 0;
  const { collection, getDocs, query, where } = fb.sdk.db;
  const snapshot = await getDocs(
    query(collection(fb.db, "withdrawals"), where("userId", "==", userId), where("status", "==", "pending")),
  );
  let total = 0;
  for (const d of snapshot.docs) {
    const amount = d.data().amount;
    if (typeof amount === "number" && Number.isFinite(amount)) total += amount;
  }
  return Math.round(total * 100) / 100;
}

export {
  fetchUserTransactions,
  computeUserBalance,
  fetchAllTransactions,
  addManualAdjustment,
  computePendingWithdrawalsTotal,
};
