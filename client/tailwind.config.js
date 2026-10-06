import colors from "./theme/colors.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic names — components should use these, not raw palettes.
        brand: {
          DEFAULT: colors.blue[500],
          light: colors.blue[400],
          dark: colors.blue[600],
          soft: colors.blue[900],
        },
        gold: {
          DEFAULT: colors.gold[500],
          light: colors.gold[400],
          soft: colors.gold[300],
          dark: colors.gold[600],
        },
        live: {
          DEFAULT: colors.red[500],
          light: colors.red[400],
          dark: colors.red[600],
        },
        win: colors.green[500],
        // Surface tokens driven by CSS variables so light/dark theme is one switch.
        surface: {
          base: "rgb(var(--surface-base) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
        },
        content: {
          primary: "rgb(var(--content-primary) / <alpha-value>)",
          secondary: "rgb(var(--content-secondary) / <alpha-value>)",
          muted: "rgb(var(--content-muted) / <alpha-value>)",
          inverse: "rgb(var(--content-inverse) / <alpha-value>)",
        },
        // Raw palettes still available for one-off needs.
        navy: colors.navy,
        crest: colors.blue,
        danger: colors.red,
        neutral: colors.slate,
      },
      fontFamily: {
        // Bangla body text; Latin falls through to Inter.
        sans: ['"Noto Sans Bengali"', "Inter", "system-ui", "sans-serif"],
        display: ["Inter", '"Noto Sans Bengali"', "system-ui", "sans-serif"],
        numeric: ["Inter", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        card: "0.875rem",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)",
        raised:
          "0 4px 12px rgb(0 0 0 / 0.10), 0 20px 40px -20px rgb(0 0 0 / 0.35)",
        gold: "0 0 0 1px rgb(245 180 0 / 0.35), 0 8px 30px -12px rgb(245 180 0 / 0.45)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      maxWidth: {
        content: "80rem",
        prose: "44rem",
      },
      keyframes: {
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-live": "pulse-live 1.6s ease-in-out infinite",
        "slide-up": "slide-up 0.35s ease-out both",
        ticker: "ticker 30s linear infinite",
      },
      // A live cricket card is information-dense; the default container is too wide.
      screens: {
        "3xl": "1920px",
      },
    },
  },
  plugins: [],
};
