// =====================================================================
// UI Utilities (shared by every page)
// =====================================================================
// Small, reusable DOM helpers so no page module ever duplicates:
//   - element lookup shorthand
//   - toast notifications
//   - loading / empty / error state blocks
//   - initial-avatars (colored circle with initials)
//   - safe text insertion (textContent only — never innerHTML with data)
// =====================================================================

// ---------------------------------------------------------------------
// Element lookup shorthand
// ---------------------------------------------------------------------

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * Creates an element with attributes and children in one call.
 * Text children are inserted with textContent (XSS-safe by design).
 */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// ---------------------------------------------------------------------
// Toast notifications (ephemeral feedback, e.g. "Profile updated")
// ---------------------------------------------------------------------

let toastRegion = null;

/**
 * Shows a short toast message. Types: "success" | "error" | "info".
 * Auto-dismisses; safe to call repeatedly.
 */
function toast(message, type = "info", duration = 3800) {
  if (!toastRegion) {
    toastRegion = el("div", { class: "toast-region", role: "status", "aria-live": "polite" });
    document.body.append(toastRegion);
  }
  const item = el(
    "div",
    { class: `toast toast--${type}` },
    el("span", { class: "toast__dot", "aria-hidden": "true" }),
    el("span", { class: "toast__message", text: message }),
    el(
      "button",
      {
        class: "toast__close",
        type: "button",
        "aria-label": "Dismiss",
        onclick: () => item.remove(),
      },
      "×",
    ),
  );
  toastRegion.append(item);
  if (duration > 0) setTimeout(() => item.remove(), duration);
  return item;
}

// ---------------------------------------------------------------------
// Loading / empty / error states
// ---------------------------------------------------------------------

/**
 * Renders a state block (spinner, empty state or error) into a container.
 * `options.title` / `options.body` are plain text; `options.retry` is an
 * optional click handler that renders a retry button.
 */
function renderState(container, kind, options = {}) {
  container.replaceChildren();

  const icons = {
    loading: null,
    empty: el(
      "svg",
      { class: "state__icon", viewBox: "0 0 48 48", fill: "none", "aria-hidden": "true" },
      el("rect", { x: "8", y: "20", width: "9", height: "20", rx: "3", fill: "currentColor", "fill-opacity": ".35" }),
      el("rect", { x: "20", y: "13", width: "9", height: "27", rx: "3", fill: "currentColor", "fill-opacity": ".6" }),
      el("rect", { x: "32", y: "6", width: "9", height: "34", rx: "3", fill: "currentColor" }),
    ),
    error: el(
      "svg",
      { class: "state__icon", viewBox: "0 0 48 48", fill: "none", "aria-hidden": "true" },
      el("circle", { cx: "24", cy: "24", r: "17", stroke: "currentColor", "stroke-width": "3" }),
      el("path", { d: "M24 15v11", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round" }),
      el("circle", { cx: "24", cy: "32.5", r: "1.8", fill: "currentColor" }),
    ),
  };

  const block = el("div", { class: `state state--${kind}` });

  if (kind === "loading") {
    block.append(el("span", { class: "spinner", "aria-hidden": "true" }));
    if (options.title) block.append(el("p", { class: "state__title", text: options.title }));
  } else {
    if (icons[kind]) block.append(icons[kind]);
    if (options.title) block.append(el("p", { class: "state__title", text: options.title }));
    if (options.body) block.append(el("p", { class: "state__body", text: options.body }));
    if (typeof options.retry === "function") {
      block.append(
        el("button", { class: "btn btn--secondary btn--sm", type: "button", onclick: options.retry }, options.retryLabel || "Try again"),
      );
    }
  }

  container.append(block);
  return block;
}

// ---------------------------------------------------------------------
// Initial avatars (no photo uploaded / no Google account picture)
// ---------------------------------------------------------------------

// Stable hue per name so the same person always gets the same color.
const AVATAR_HUES = [158, 190, 220, 255, 285, 320, 12, 35, 45];

/** Deterministic hue derived from a display name. */
function avatarHue(seedText) {
  let hash = 0;
  const text = String(seedText || "?");
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 9973;
  return AVATAR_HUES[hash % AVATAR_HUES.length];
}

/**
 * Fills a placeholder <div class="avatar"> with initials or a photo.
 * `node` is an existing .avatar element; pass the raw sizes via CSS.
 */
function renderAvatar(node, { photoURL, displayName, size = "md" }) {
  if (!node) return;
  node.className = `avatar avatar--${size}`;
  node.replaceChildren();

  if (photoURL) {
    const img = el("img", { class: "avatar__img", src: photoURL, alt: "" });
    img.addEventListener("error", () => renderAvatar(node, { photoURL: null, displayName, size }));
    node.append(img);
    return;
  }

  const initials = String(displayName || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  node.style.setProperty("--avatar-hue", String(avatarHue(displayName)));
  node.append(el("span", { class: "avatar__initials", text: initials || "?" }));
}

// ---------------------------------------------------------------------
// Buttons (busy state helper)
// ---------------------------------------------------------------------

/**
 * Wraps an async action with busy state on its trigger button:
 * disables the button, shows an inline spinner, re-enables on settle.
 * Always returns the action's result / rethrows its error.
 */
async function withBusy(button, action) {
  if (!button) return action();
  const label = button.querySelector(".btn__label") || button;
  const original = label.textContent;
  button.disabled = true;
  button.classList.add("is-busy");
  try {
    return await action();
  } finally {
    button.disabled = false;
    button.classList.remove("is-busy");
    label.textContent = original;
  }
}

// ---------------------------------------------------------------------
// Confirmation dialog (Promise-based, localized labels)
// ---------------------------------------------------------------------

/**
 * Shows a modal confirmation. Resolves true when confirmed, false on
 * cancel/Escape/backdrop click. Used for destructive or money-moving
 * admin actions (approve, delete).
 */
function confirmDialog({ title, body = "", confirmLabel = "OK", cancelLabel = null, danger = false }) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { class: `modal modal--confirm${danger ? " modal--danger" : ""}` });
    const panel = el("div", { class: "modal__panel" });
    const actions = el("div", { class: "modal__actions" });

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    panel.append(
      el("h2", { class: "modal__title", text: title }),
      body ? el("p", { class: "modal__body", text: body }) : null,
      actions,
    );
    actions.append(
      el(
        "button",
        {
          class: "btn btn--ghost",
          type: "button",
          onclick: () => close(false),
        },
        cancelLabel || "Cancel",
      ),
      el(
        "button",
        {
          class: `btn ${danger ? "btn--danger" : "btn--primary"}`,
          type: "button",
          onclick: () => close(true),
        },
        confirmLabel,
      ),
    );

    dialog.append(panel);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close(false);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close(false);
    });

    document.body.append(dialog);
    dialog.showModal();
  });
}

export { qs, qsa, el, toast, renderState, renderAvatar, withBusy, confirmDialog };
