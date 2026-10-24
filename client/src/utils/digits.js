/**
 * Digit conversion with no dependencies, shared by the formatting helpers and the
 * i18n setup (which cannot import the formatting helpers: they import i18n).
 *
 * The site shows Bengali digits (০১২৩৪৫৬৭৮৯) when the reader chose Bangla and Western
 * digits (0-9) when they chose English. Numbers come from the API as ordinary numbers,
 * so the conversion happens at the point of display, never in the data.
 */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Western digits -> Bengali digits. Anything that is not a digit is left alone. */
export function convertToBengaliDigits(value) {
  return String(value ?? '').replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

/** Bengali digits -> Western digits. */
export function convertToLatinDigits(value) {
  return String(value ?? '').replace(/[০-৯]/g, (digit) => String(BN_DIGITS.indexOf(digit)));
}
