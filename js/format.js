// =====================================================================
// Formatting Helpers (locale-aware)
// =====================================================================
// All money, date and number rendering goes through this file so the
// dashboard, wallet, admin tables and offer cards all print identical
// values in both English (LTR) and Arabic (RTL).
//
// Arabic uses Latin digits (ar-u-nu-latn) so amounts stay readable and
// match the screenshots/support conversations admins will have.
// =====================================================================

const LOCALE_MAP = {
  en: "en-US",
  ar: "ar-u-nu-latn", // Arabic formatting, Latin (western) digits
};

/** Resolves the Intl locale tag used for the active app locale. */
function intlLocale(locale) {
  return LOCALE_MAP[locale] || LOCALE_MAP.en;
}

// ---------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------

/** Formats a dollar amount, e.g. 0.5 -> "$0.50" / "٠٫٥٠ US$" style. */
function formatMoney(amount, locale = "en") {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/** Signed variant for transactions, e.g. "+$0.50" / "-$2.00". */
function formatSignedMoney(amount, locale = "en") {
  const value = Number(amount) || 0;
  const sign = value > 0 ? "+" : "";
  return sign + formatMoney(value, locale);
}

// ---------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------

/** Medium date + time, e.g. "Sep 24, 2026, 3:12 PM". */
function formatDateTime(dateValue, locale = "en") {
  const date = toDate(dateValue);
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Date only, e.g. "Sep 24, 2026". */
function formatDate(dateValue, locale = "en") {
  const date = toDate(dateValue);
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(date);
}

/** Compact relative time, e.g. "5 minutes ago" / "قبل ٥ دقائق". */
function formatRelativeTime(dateValue, locale = "en") {
  const date = toDate(dateValue);
  if (!date) return "—";
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const thresholds = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, seconds] of thresholds) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" }).format(
        Math.round(diffSeconds / seconds),
        unit,
      );
    }
  }
  return "—";
}

// ---------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------

/** Plain integer formatting, e.g. 1200 -> "1,200". */
function formatNumber(value, locale = "en") {
  return new Intl.NumberFormat(intlLocale(locale)).format(Number(value) || 0);
}

// ---------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------

/** Normalizes Firestore Timestamps, ISO strings and Dates to a Date. */
function toDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue?.toDate === "function") return dateValue.toDate();
  if (typeof dateValue === "number") return new Date(dateValue);
  if (typeof dateValue === "string") {
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export { formatMoney, formatSignedMoney, formatDate, formatDateTime, formatRelativeTime, formatNumber };
