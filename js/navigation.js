// =====================================================================
// Navigation Components
// =====================================================================
// Shared chrome behaviour used by every page:
//   - the language switcher (EN / العربية)
//   - the mobile menu open/close trigger
//   - the auto-updating copyright year
// Nothing here talks to Firebase — pure presentation.
// =====================================================================

import { getLocale, setLocale, onLocaleChange } from "./i18n.js";
import { qs, qsa, el } from "./ui.js";

// ---------------------------------------------------------------------
// Language switcher
// ---------------------------------------------------------------------

// Label shown on the button for each supported locale.
const LOCALE_LABELS = { en: "English", ar: "العربية" };

/**
 * Builds the EN/AR switch inside every [data-lang-switch] container.
 * The active locale's button carries aria-pressed so screen readers
 * announce the current choice.
 */
function buildLanguageSwitchers() {
  for (const container of qsa("[data-lang-switch]")) {
    container.replaceChildren();
    const buttons = Object.entries(LOCALE_LABELS).map(([code, label]) =>
      el(
        "button",
        {
          class: "lang-switch__btn",
          type: "button",
          "data-locale": code,
          "aria-pressed": String(getLocale() === code),
          onclick: () => setLocale(code),
        },
        label,
      ),
    );
    container.append(...buttons);
  }
}

// Keep every switcher in sync when the locale changes anywhere.
onLocaleChange(() => {
  for (const btn of qsa(".lang-switch__btn")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.locale === getLocale()));
  }
});

// ---------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------

/**
 * Wires the hamburger trigger to its [data-menu-panel]. The panel is
 * toggled with the [hidden] attribute and the trigger's aria-expanded
 * state; closing on Escape and on link click keeps it natural on phones.
 */
function initMobileMenu() {
  const trigger = qs("[data-menu-trigger]");
  const panel = qs("[data-menu-panel]");
  if (!trigger || !panel) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
  };

  trigger.addEventListener("click", () => setOpen(panel.hidden));
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });
}

// ---------------------------------------------------------------------
// Misc chrome
// ---------------------------------------------------------------------

/** Fills every [data-current-year] span with the current year. */
function initCurrentYear() {
  const year = String(new Date().getFullYear());
  for (const node of qsa("[data-current-year]")) node.textContent = year;
}

/** Entry point called once from main.js on every page. */
function initNavigation() {
  buildLanguageSwitchers();
  initMobileMenu();
  initCurrentYear();
}

export { initNavigation };
