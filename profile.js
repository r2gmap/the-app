// =====================================================================
// Profile Page Controller (profile.html)
// =====================================================================
// Keeps the page simple on purpose:
//   1. Identity card — avatar, name, email, member since, Edit / Log out
//   2. Account details — wallet balance, cash wallet number (the payout
//      destination, stored on the Firestore profile), completed rewards,
//      pending reviews
//   3. "Edit profile" modal — rename, avatar upload/remove (Firebase
//      Storage `avatars/{uid}/…`), cash wallet number
// Logout is handled by the shared auth chrome (data-auth-logout).
// =====================================================================

import { getFirebase } from "../firebase.js";
import { requireAuth } from "../auth.js";
import { t } from "../i18n.js";
import { qs, renderAvatar, toast, withBusy } from "../ui.js";
import { formatMoney, formatDate } from "../format.js";
import { computeUserBalance } from "../services/wallet-service.js";
import { countUserSubmissions } from "../services/submissions-service.js";
import { getUserProfile, updateUserProfile } from "../services/users-service.js";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------
// Summary rendering
// ---------------------------------------------------------------------

async function renderSummary(user, profile) {
  renderAvatar(qs("[data-profile-avatar]"), {
    photoURL: user.photoURL,
    displayName: user.displayName || user.email,
    size: "xl",
  });
  qs("[data-profile-name]").textContent = user.displayName || "—";
  qs("[data-profile-email]").textContent = user.email || "—";

  const [balance, completed, pending] = await Promise.all([
    computeUserBalance(user.uid).catch(() => null),
    countUserSubmissions(user.uid, "approved").catch(() => null),
    countUserSubmissions(user.uid, "pending").catch(() => null),
  ]);

  qs("[data-profile-balance]").textContent = balance === null ? "—" : formatMoney(balance);
  qs("[data-profile-completed]").textContent = completed === null ? "—" : String(completed);
  qs("[data-profile-pending]").textContent = pending === null ? "—" : String(pending);
  // Cash wallet number: the payout destination stored on the profile
  // (set via the edit dialog; withdrawals prefill from it).
  qs("[data-profile-wallet-number]").textContent = profile?.walletNumber?.trim() || "—";
  qs("[data-profile-joined]").textContent = profile?.createdAt
    ? formatDate(profile.createdAt)
    : "—";
}

// ---------------------------------------------------------------------
// Edit-profile modal
// ---------------------------------------------------------------------

function initEditModal(user, profile) {
  const dialog = qs("[data-profile-edit]");
  const openButton = qs("[data-profile-edit-open]");
  const form = qs("[data-profile-edit-form]");
  if (!dialog || !openButton || !form) return;

  const nameInput = qs("[data-profile-name-input]", form);
  const walletInput = qs("[data-profile-wallet-input]", form);
  const fileInput = qs("[data-profile-avatar-input]", form);
  const removeButton = qs("[data-profile-remove-avatar]", form);
  let removeAvatar = false;

  openButton.addEventListener("click", () => {
    // Fresh modal state each time it opens.
    nameInput.value = user.displayName || "";
    walletInput.value = profile?.walletNumber || "";
    fileInput.value = "";
    removeAvatar = false;
    removeButton.hidden = !user.photoURL;
    clearEditErrors(form);
    dialog.showModal();
  });

  removeButton.addEventListener("click", () => {
    removeAvatar = true;
    removeButton.hidden = true;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitEdit();
  });

  async function submitEdit() {
    const displayName = nameInput.value.trim();
    const walletNumber = walletInput.value.trim();
    const file = fileInput.files?.[0];

    // --- validation
    if (!displayName) return showEditError(form, t("profile.edit.errors.nameRequired"));
    if (file && file.size > MAX_AVATAR_BYTES) {
      return showEditError(form, t("profile.edit.errors.uploadFailed"));
    }

    await withBusy(qs("button[type=submit]", form), async () => {
      try {
        // 1) Optional avatar upload to Storage first.
        let photoURL;
        if (removeAvatar) photoURL = null;
        else if (file) photoURL = await uploadAvatar(user.uid, file);

        // 2) Update the Firebase Auth profile (name, photo).
        const fb = await getFirebase();
        const patch = { displayName };
        if (photoURL !== undefined) patch.photoURL = photoURL;
        await fb.sdk.auth.updateProfile(fb.auth.currentUser, patch);

        // 3) Mirror the change onto the Firestore profile document —
        //    including the cash wallet number (payout destination).
        await updateUserProfile(user.uid, {
          displayName,
          walletNumber,
          ...(photoURL !== undefined ? { photoURL } : {}),
        });

        dialog.close();
        toast(t("profile.edit.success"), "success");
        window.location.reload(); // refresh cached auth state everywhere
      } catch (error) {
        console.error("[profile] edit failed", error);
        showEditError(form, t("profile.edit.errors.uploadFailed"));
      }
    });
  }
}

/** Uploads a new avatar and returns its download URL. */
async function uploadAvatar(userId, file) {
  const fb = await getFirebase();
  const { ref, uploadBytes, getDownloadURL } = fb.sdk.storage;
  const safeName = String(file.name || "avatar").replace(/[^\w.\-]+/g, "_");
  const storageRef = ref(fb.storage, `avatars/${userId}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// Modal helpers --------------------------------------------------------

function showEditError(form, message) {
  const node = qs("[data-profile-edit-error]", form);
  if (node) node.textContent = message;
}

/** Clears every inline error in the edit-profile dialog. */
function clearEditErrors(form) {
  const node = qs("[data-profile-edit-error]", form);
  if (node) node.textContent = "";
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function init() {
  const user = await requireAuth();
  if (!user) return;

  // The Firestore profile (joined date, wallet number) is fetched once
  // and shared by the summary and the edit dialog.
  const profile = await getUserProfile(user.uid).catch(() => null);

  await renderSummary(user, profile);
  initEditModal(user, profile);
}

export { init };
