// =====================================================================
// Notifications Service — Firestore `notifications` collection
// =====================================================================
// Users are notified in-app when a submission or withdrawal is
// approved or rejected. Documents are written by the ADMIN client as
// part of the review batches (rules: admins create, owners read and
// may only flip `read`).
//
//   notifications/{id}: {
//     userId,
//     type: "submission_approved" | "submission_rejected"
//         | "withdrawal_approved" | "withdrawal_rejected",
//     data: { offerTitle?, amount?, reason? },   // rendered localized
//     read: boolean,
//     createdAt
//   }
// =====================================================================

import { getFirebase } from "../firebase.js";

// ---------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------

/** Creates a notification for a user (called from review batches). */
async function createNotification({ userId, type, data = {} }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, addDoc, serverTimestamp } = fb.sdk.db;
  const ref = await addDoc(collection(fb.db, "notifications"), {
    userId,
    type,
    data,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ---------------------------------------------------------------------
// User reads + read-state updates
// ---------------------------------------------------------------------

/** The user's notifications, newest first. */
async function fetchUserNotifications(userId, maxCount = 50) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, query, where, orderBy, limit } = fb.sdk.db;
  const snapshot = await getDocs(
    query(
      collection(fb.db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(maxCount),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Unread notification count (cheap aggregation query). */
async function countUnreadNotifications(userId) {
  const fb = await getFirebase();
  if (!fb) return 0;
  const { collection, getCountFromServer, query, where } = fb.sdk.db;
  const { count } = await getCountFromServer(
    query(collection(fb.db, "notifications"), where("userId", "==", userId), where("read", "==", false)),
  );
  return count || 0;
}

/** Marks one notification as read (owners may only touch `read`). */
async function markNotificationRead(notificationId) {
  const fb = await getFirebase();
  if (!fb) return;
  const { doc, updateDoc } = fb.sdk.db;
  await updateDoc(doc(fb.db, "notifications", notificationId), { read: true });
}

/** Marks every unread notification of a user as read. */
async function markAllNotificationsRead(userId) {
  const fb = await getFirebase();
  if (!fb) return;
  const { collection, getDocs, query, where, writeBatch } = fb.sdk.db;
  const snapshot = await getDocs(
    query(collection(fb.db, "notifications"), where("userId", "==", userId), where("read", "==", false)),
  );
  const batch = writeBatch(fb.db);
  for (const d of snapshot.docs) batch.update(d.ref, { read: true });
  if (snapshot.docs.length) await batch.commit();
}

export { createNotification, fetchUserNotifications, countUnreadNotifications, markNotificationRead, markAllNotificationsRead };
