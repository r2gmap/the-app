// =====================================================================
// Floating support widget — private ticket creation
// =====================================================================
// The panel is available across the public shell, but the ticket remains
// private. The browser writes only a Firestore ticket through rules; the
// backend trigger then forwards it to Telegram using Secret Manager.
// No Telegram URL, token, or chat ID is exposed to the browser.
// =====================================================================

import { t, onLocaleChange } from "./i18n.js";
import { waitForAuthState } from "./firebase.js";
import { createSupportTicket, validateSupportAttachment } from "./support-service.js";
import { qs } from "./ui.js";

const CATEGORIES = [
  ["submission", "support.category.completed"],
  ["reward", "support.category.reward"],
  ["account", "support.category.account"],
  ["withdrawal", "support.category.withdrawal"],
  ["other", "support.category.other"],
];

let currentUser = null;
let widget = null;
let copyBound = false;
let supportErrorKey = "";
let supportSuccessKey = "";

// =====================================================================
// Widget markup and interaction
// =====================================================================

function setCategory(value) {
  const input = qs("[data-support-category]", widget);
  const next = CATEGORIES.some(([category]) => category === value) ? value : "submission";
  if (input) input.value = next;
  for (const button of widget.querySelectorAll("[data-support-category-option]")) {
    button.setAttribute("aria-pressed", String(button.dataset.category === next));
  }
}

function buildWidget() {
  if (widget || !document.body) return;
  widget = document.createElement("aside");
  widget.className = "support-widget";
  widget.setAttribute("dir", "auto");
  widget.innerHTML = `
    <button class="support-widget__launcher" type="button" data-support-toggle
      aria-expanded="false" aria-controls="support-panel">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5.5 13.5v-2a6.5 6.5 0 0113 0v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        <path d="M5.5 13.5H4.8A1.8 1.8 0 003 15.3v1.4a1.8 1.8 0 001.8 1.8h.7v-5Zm13 0h.7a1.8 1.8 0 011.8 1.8v1.4a1.8 1.8 0 01-1.8 1.8h-.7v-5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
        <path d="M18.5 19.2c-.9 1-2.1 1.5-3.7 1.5h-1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
      <span class="visually-hidden" data-support-launcher-label></span>
    </button>
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
        <fieldset class="field support-widget__quick-field">
          <legend class="field__label" data-support-category-label></legend>
          <div class="support-widget__quick-actions" role="group" data-support-categories></div>
          <input type="hidden" name="category" value="submission" data-support-category />
        </fieldset>
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

  qs("[data-support-categories]", widget).addEventListener("click", (event) => {
    const button = event.target.closest("[data-support-category-option]");
    if (button) setCategory(button.dataset.category);
  });
  qs("[data-support-form]", widget).addEventListener("submit", (event) => {
    event.preventDefault();
    void submitTicket(event.currentTarget);
  });
  qs("[data-support-attachment]", widget).addEventListener("change", (event) => {
    const error = validateSupportAttachment(event.target.files?.[0]);
    if (error) event.target.value = "";
    supportErrorKey = error || "";
    supportSuccessKey = "";
    qs("[data-support-error]", widget).textContent = error ? t(error) : "";
    qs("[data-support-success]", widget).textContent = "";
  });

  refreshCopy();
  if (!copyBound) {
    copyBound = true;
    onLocaleChange(refreshCopy);
  }
}

// =====================================================================
// Localized copy and state rendering
// =====================================================================

function refreshCopy() {
  if (!widget) return;
  widget.setAttribute("dir", document.documentElement.dir || "ltr");
  qs("[data-support-launcher-label]", widget).textContent = t("support.launcher");
  qs("[data-support-toggle]", widget).setAttribute("aria-label", t("support.launcher"));
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

  const quickActions = qs("[data-support-categories]", widget);
  quickActions.replaceChildren(...CATEGORIES.map(([value, key]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-widget__quick-action";
    button.dataset.supportCategoryOption = "";
    button.dataset.category = value;
    button.textContent = t(key);
    return button;
  }));
  setCategory(qs("[data-support-category]", widget).value || "submission");

  const identity = qs("[data-support-identity]", widget);
  identity.hidden = false;
  identity.replaceChildren();
  if (currentUser) {
    identity.textContent = t("support.signedInAs", { email: currentUser.email || "" });
  } else {
    identity.append(
      document.createTextNode(`${t("support.signInRequired")} `),
      Object.assign(document.createElement("a"), {
        href: "login.html",
        textContent: t("nav.login"),
      }),
    );
  }

  qs("[data-support-error]", widget).textContent = supportErrorKey ? t(supportErrorKey) : "";
  qs("[data-support-success]", widget).textContent = supportSuccessKey ? t(supportSuccessKey) : "";
}

// =====================================================================
// Ticket submission
// =====================================================================

async function submitTicket(form) {
  const errorNode = qs("[data-support-error]", widget);
  const successNode = qs("[data-support-success]", widget);
  const button = qs("[data-support-submit]", widget);
  const message = qs("[data-support-message]", form).value.trim();
  supportErrorKey = "";
  supportSuccessKey = "";
  errorNode.textContent = "";
  successNode.textContent = "";
  if (!currentUser) {
    supportErrorKey = "support.signInToSend";
    errorNode.textContent = t(supportErrorKey);
    return;
  }
  if (!message) {
    supportErrorKey = "support.messageRequired";
    errorNode.textContent = t(supportErrorKey);
    return;
  }

  button.disabled = true;
  button.classList.add("is-busy");
  button.textContent = t("support.sending");
  try {
    await createSupportTicket({
      user: currentUser,
      category: qs("[data-support-category]", form).value,
      message,
      file: qs("[data-support-attachment]", form).files?.[0] || null,
    });
    form.reset();
    setCategory("submission");
    supportSuccessKey = "support.sent";
    successNode.textContent = t(supportSuccessKey);
  } catch (error) {
    const key = error?.message?.startsWith("support.") ? error.message : "support.sendFailed";
    supportErrorKey = key;
    errorNode.textContent = t(supportErrorKey);
  } finally {
    button.disabled = false;
    button.classList.remove("is-busy");
    button.textContent = t("support.send");
  }
}

async function initSupportWidget() {
  buildWidget();
  const { user } = await waitForAuthState();
  currentUser = user;
  refreshCopy();
}

export { initSupportWidget };
