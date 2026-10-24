/**
 * Small formatting helpers.
 *
 * The site is bilingual and the numbers are the part that actually gets argued
 * about, so the rules are stated once here rather than open-coded per component:
 *   - Overs use the cricket notation with one decimal (3.4 overs, never 3.67).
 *   - Rates and averages are shown to two decimals.
 *   - A figure that does not exist yet is a dash, never a zero. A batter with no
 *     dismissals has no average; printing 0.00 claims a fact that is not true.
 */

import i18n from "../i18n/index.js";
import { convertToBengaliDigits, convertToLatinDigits } from "./digits.js";

/** Cricket over figure: legal balls -> "3.4". */
export function formatOvers(balls = 0) {
  const safe = Math.max(0, Math.floor(balls || 0));
  return toBengaliDigits(`${Math.floor(safe / 6)}.${safe % 6}`);
}

/** Runs per over, to two decimals. */
export function formatRunRate(runs = 0, balls = 0) {
  if (!balls) return "—";
  return toBengaliDigits((runs / (balls / 6)).toFixed(2));
}

/** A rate that may not exist yet. */
export function formatRate(value, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return toBengaliDigits(Number(value).toFixed(decimals));
}

/** Net run rate with an explicit sign, as cricket tables always show. */
export function formatNrr(value) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  const fixed = Number(value).toFixed(3);
  return toBengaliDigits(Number(fixed) > 0 ? `+${fixed}` : fixed);
}

/** A bowling figure: "3/24", or null when the player has not bowled. */
export function formatBowling(wickets, runs) {
  if (runs === null || runs === undefined) return null;
  return toBengaliDigits(`${wickets ?? 0}/${runs}`);
}

/** Run margin text, e.g. "45 runs" / "6 wickets". */
export function formatMargin(margin) {
  return margin && String(margin).trim() ? String(margin).trim() : "";
}

/**
 * A date in the reader's language.
 *
 * Bangla month names are supplied explicitly rather than relying on the ICU data
 * built into the browser: a Chromium build without full locale data falls back to
 * English mid-sentence, which looks broken on an otherwise Bangla page.
 */
const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

/** True when the reader is using the site in Bangla. Bangla is also the fallback. */
function isBanglaNow() {
  return (i18n.resolvedLanguage || i18n.language || "bn").startsWith("bn");
}

/**
 * A number as the reader should see it: Bengali digits in Bangla, Western digits in
 * English.
 *
 * The name is kept from when this only ever produced Bengali digits, and about a
 * hundred call sites use it. It used to convert unconditionally, so switching the site
 * to English left every number it touched in Bengali digits. It now follows the
 * language the reader has chosen; `localizeDigits` is the same function under a name
 * that says what it does, for new code.
 */
export function toBengaliDigits(value) {
  return isBanglaNow() ? convertToBengaliDigits(value) : convertToLatinDigits(value);
}

export const localizeDigits = toBengaliDigits;

/**
 * Format a date.
 * @param {string|Date|null} value
 * @param {'bn'|'en'} lang
 * @param {{ withYear?: boolean, withTime?: boolean }} [options]
 */
export function formatDate(
  value,
  lang = "bn",
  { withYear = true, withTime = false } = {},
) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  let time = "";
  if (withTime) {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    // 12-hour clock with a Bangla / English meridiem label.
    const suffix = hours < 12 ? "AM" : "PM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    time = ` ${hour12}:${minutes} ${suffix}`;
  }

  if (lang === "bn") {
    // The caller names the language, so convert explicitly rather than by the global one.
    const datePart = `${convertToBengaliDigits(day)} ${BN_MONTHS[month]}${withYear ? ` ${convertToBengaliDigits(year)}` : ""}`;
    return `${datePart}${convertToBengaliDigits(time)}`;
  }

  const monthEn = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][month];

  const datePart = `${day} ${monthEn}${withYear ? ` ${year}` : ""}`;
  return `${datePart}${time}`;
}

/** Short date for a fixture chip: "9 Jan". */
export function formatShortDate(value, lang = "bn") {
  return formatDate(value, lang, { withYear: false });
}

/**
 * A countdown label.
 *
 * Returns null when there is no date, which is the case for Season 2 right now —
 * the caller hides the whole countdown rather than rendering something meaningless.
 */
export function formatCountdown(targetDate, lang = "bn") {
  if (!targetDate) return null;

  const target = new Date(targetDate).getTime();
  if (Number.isNaN(target)) return null;

  const diff = target - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days > 1)
    return lang === "bn"
      ? `${convertToBengaliDigits(days)} দিন বাকি`
      : `${days} days to go`;
  if (days === 1) return lang === "bn" ? "আগামীকাল" : "Tomorrow";
  if (days === 0) return lang === "bn" ? "আজ" : "Today";
  return lang === "bn" ? "শেষ হয়েছে" : "Completed";
}

/**
 * Truncate text for a card without cutting a word.
 */
export function truncate(text, maxLength = 140) {
  if (!text) return "";
  const value = String(text).trim();
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

/**
 * Initials for an avatar fallback, using the first letter of the first two words.
 */
export function initials(name) {
  if (!name) return "?";
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Is a date in the past?
 * Used to decide whether a completed season shows an archive banner.
 */
export function isPast(value) {
  if (!value) return false;
  const date = new Date(value).getTime();
  return !Number.isNaN(date) && date < Date.now();
}
