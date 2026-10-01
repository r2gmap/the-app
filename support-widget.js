// =====================================================================
// Floating support launcher — authenticated, private ticket creation
// =====================================================================
// The panel is intentionally added to the shared public shell so support
// is reachable without a public email address or client-side messaging
// service. Firestore rules bind every ticket to the signed-in identity.
// =====================================================================

import { t, onLocaleChange } from "./i18n.js";
import { waitForAuthState } from "./firebase.js";
import { createSupportTicket, validateSupportAttachment } from "./support-service.js";
import { qs } from "./ui.js";

const CATEGORIES = [
  ["reward", "support.category.reward"],
  ["submission", "support.category.submission"],
  ["withdrawal", "support.category.withdrawal"],
  ["account", "support.category.account"],
  ["other", "support.category.other"],
];

let currentUser = null;
let widget = null;
let copyBound = false;

function buildWidget() {
  if (widget || !document.body) return;
  widget = document.createElement("aside");
  widget.className = "support-widget";
  widget.setAttribute("dir", "auto");
  widget.innerHTML = `
    <button class="support-widget__launcher" type="button" data-support-toggle
      aria-expanded="false" aria-controls="support-panel"></button>
    <section class="support-widget__panel" id="support-panel" data-support-panel hidden
      role="dialog" aria-labelledby="support-panel-title">
      <div class="support-widget__head">
        <div>
          <p class="support-widget__eyebrow" data-support-eyebrow></p>
          <h2 class="support-widget__title" id="support-panel-title" data-support-title></h2>
        </div>
        <button class="support-widget__close" type="button" data-support-close
          aria-label="Close"></button>
      </div>
      <p class="support-widget__intro" data-support-intro></p>
      <form class="support-widget__form" data-support-form novalidate>
        <label class="field">
          <span class="field__label" data-support-category-label></span>
          <select class="field__control" name="category" data-support-category required></select>
        </label>
        <label class="field">
          <span class="field__label" data-support-message-label></span>
          <textarea class="field__control" name="message" data-support-message rows="5" maxlength="4000" required></textarea>
        </label>
        <label class="field">
          <span class="field__label" data-support-attachment-label></span>
          <input class="field__control" type="file" name="attachment" data-support-attachment
            accept="image/jpeg,image/png,image/webp" />
          <span class="field__hint" data-support-attachment-hint></span>
        </label>
        <p class="support-widget__identity" data-support-identity hidden></p>
        <p class="form-message form-message--error" data-support-error role="alert"></p>
        <p class="form-message form-message--success" data-support-success role="status"></p>
        <button class="btn btn--primary support-widget__submit" type="submit" data-support-submit></button>
      </form>
    </section>
  `;
  document.body.append(widget);

  const panel = qs("[data-support-panel]", widget);
  const toggle = qs("[data-support-toggle]", widget);
  const close = qs("[data-support-close]", widget);
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) qs("[data-support-message]", widget)?.focus();
  };
  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  document.querySelectorAll("[data-support-open]").forEach((button) => {
    button.addEventListener("click", () => setOpen(true));
  });

  qs("[data-support-form]", widget).addEventListener("submit", (event) => {
    event.preventDefault();
    void submitTicket(event.currentTarget);
  });
  qs("[data-support-attachment]", widget).addEventListener("change", (event) => {
    const error = validateSupportAttachment(event.target.files?.[0]);
    if (error) event.target.value = "";
    qs("[data-support-error]", widget).textContent = error ? t(error) : "";
  });

  refreshCopy();
  if (!copyBound) {
    copyBound = true;
    onLocaleChange(refreshCopy);
  }
}

function refreshCopy() {
  if (!widget) return;
  widget.setAttribute("dir", document.documentElement.dir || "ltr");
  qs("[data-support-toggle]", widget).textContent = t("support.launcher");
  qs("[data-support-eyebrow]", widget).textContent = t("support.eyebrow");
  qs("[data-support-title]", widget).textContent = t("support.panelTitle");
  qs("[data-support-intro]", widget).textContent = t("support.panelIntro");
  qs("[data-support-close]", widget).textContent = t("common.close");
  qs("[data-support-close]", widget).setAttribute("aria-label", t("common.close"));
  qs("[data-support-category-label]", widget).textContent = t("support.categoryLabel");
  qs("[data-support-message-label]", widget).textContent = t("support.messageLabel");
  qs("[data-support-attachment-label]", widget).textContent = t("support.attachmentLabel");
  qs("[data-support-attachment-hint]", widget).textContent = t("support.attachmentHint");
  qs("[data-support-message]", widget).placeholder = t("support.messagePlaceholder");
  qs("[data-support-submit]", widget).textContent = t("support.send");
  const select = qs("[data-support-category]", widget);
  const selected = select.value || "account";
  select.replaceChildren(...CATEGORIES.map(([value, key]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = t(key);
    return option;
  }));
  select.value = selected;
  const identity = qs("[data-support-identity]", widget);
  if (currentUser) {
    identity.hidden = false;
    identity.textContent = t("support.signedInAs", {
      email: currentUser.email || "",
    });
  } else {
    identity.hidden = false;
    identity.innerHTML = `${t("support.signInRequired")} <a href="login.html">${t("nav.login")}</a>`;
  }
}

async function submitTicket(form) {
  const errorNode = qs("[data-support-error]", widget);
  const successNode = qs("[data-support-success]", widget);
  const button = qs("[data-support-submit]", widget);
  const message = qs("[data-support-message]", form).value.trim();
  errorNode.textContent = "";
  successNode.textContent = "";
  if (!currentUser) {
    errorNode.textContent = t("support.signInToSend");
    return;
  }
  if (!message) {
    errorNode.textContent = t("support.messageRequired");
    return;
  }

  button.disabled = true;
  try {
    await createSupportTicket({
      user: currentUser,
      category: qs("[data-support-category]", form).value,
      message,
      file: qs("[data-support-attachment]", form).files?.[0] || null,
    });
    form.reset();
    successNode.textContent = t("support.sent");
  } catch (error) {
    const key = error?.message?.startsWith("support.") ? error.message : "support.sendFailed";
    errorNode.textContent = t(key);
  } finally {
    button.disabled = false;
  }
}

async function initSupportWidget() {
  buildWidget();
  const { user } = await waitForAuthState();
  currentUser = user;
  refreshCopy();
}

export { initSupportWidget };
