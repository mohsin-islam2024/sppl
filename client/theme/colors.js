/**
 * SPPL design tokens — single source of truth for colour.
 *
 * Palette derived from the official SPPL tournament crest: a deep navy field, a
 * bright blue accent from the stumps and motion lines, and the gold of the trophy
 * lettering. Every colour in the app must come from here so a rebrand is one edit.
 */
const colors = {
  // Field / surfaces
  navy: {
    950: "#05091a",
    900: "#0a1020",
    800: "#101833",
    700: "#141c33",
    600: "#1c2745",
    500: "#26355c",
  },
  // Primary accent — crest blue
  blue: {
    50: "#eef5ff",
    300: "#7db4f5",
    400: "#4a92ea",
    500: "#1e6fd9",
    600: "#1659b3",
    700: "#10448c",
    900: "#0a2b5c",
  },
  // Trophy gold — champion, awards, highlights
  gold: {
    300: "#ffe082",
    400: "#fbc94a",
    500: "#f5b400",
    600: "#c98f00",
    700: "#96690a",
  },
  // Live / danger / wickets
  red: {
    400: "#f2666f",
    500: "#e63946",
    600: "#c2212e",
  },
  // Success — wins, qualified
  green: {
    400: "#4ade80",
    500: "#22c55e",
    600: "#16803c",
  },
  // Neutrals
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
};

export default colors;
