// =====================================================================
// Support Service — private Firestore tickets + optional image proof
// =====================================================================
// The browser writes a narrow, user-owned ticket record. It never receives
// an operator token, webhook URL, email credential, or messaging API detail.
// Admins read the queue through Firestore rules; a deployed backend can
// process the same supportTickets/{ticketId} create event if delivery to an
// external helpdesk is enabled later.
// =====================================================================

import { getFirebase } from "./firebase.js";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateSupportAttachment(file) {
  if (!file) return null;
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return "support.errors.invalidAttachment";
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) return "support.errors.attachmentTooLarge";
  return null;
}

/** Creates one support ticket and uploads its optional private image first. */
async function createSupportTicket({ user, category, message, file }) {
  if (!user?.uid) throw new Error("support-auth-required");
  const cleanCategory = String(category || "").trim();
  const cleanMessage = String(message || "").trim();
  if (!cleanCategory || !cleanMessage) throw new Error("support-fields-required");
  const fileError = validateSupportAttachment(file);
  if (fileError) throw new Error(fileError);

  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, doc, setDoc, serverTimestamp } = fb.sdk.db;
  const { ref, uploadBytes, getDownloadURL } = fb.sdk.storage;
  const ticketRef = doc(collection(fb.db, "supportTickets"));
  const attachmentUrls = [];

  if (file) {
    const safeName = String(file.name || "attachment")
      .replace(/[^\w.\-]+/g, "_")
      .slice(-120);
    const storageRef = ref(fb.storage, `support-attachments/${user.uid}/${ticketRef.id}/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    attachmentUrls.push(await getDownloadURL(storageRef));
  }

  await setDoc(ticketRef, {
    userId: user.uid,
    userName: user.displayName || user.email?.split("@")[0] || "",
    email: user.email || "",
    category: cleanCategory,
    message: cleanMessage.slice(0, 4000),
    attachmentUrls,
    status: "open",
    createdAt: serverTimestamp(),
  });

  return ticketRef.id;
}

/** Admin-only queue read. Firestore rules are the authorization boundary. */
async function fetchSupportTickets(maxCount = 100) {
  const fb = await getFirebase();
  if (!fb) throw new Error("firebase-unavailable");
  const { collection, getDocs, limit, orderBy, query } = fb.sdk.db;
  const snapshot = await getDocs(
    query(collection(fb.db, "supportTickets"), orderBy("createdAt", "desc"), limit(maxCount)),
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  validateSupportAttachment,
  createSupportTicket,
  fetchSupportTickets,
};
