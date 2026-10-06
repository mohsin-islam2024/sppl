import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/**
 * Vite configuration.
 *
 * - `@` points at `src` so imports stay readable as the tree grows.
 * - `@sppl/shared` resolves to the workspace source, which keeps roles, enums and
 *   zod schemas shared with the API without a build step.
 * - PWA is configured here rather than with a hand-written service worker, so the
 *   precache list follows the build output automatically.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/*.png", "logos/*"],

      manifest: {
        name: "Sotahar Poshchim Para Premier League",
        short_name: "SPPL",
        description:
          "Official website of the Sotahar Poshchim Para Premier League — live scores, fixtures, points table and more.",
        theme_color: "#0a1020",
        background_color: "#0a1020",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "bn",
        icons: [
          { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // The API is never precached; live data must always come from the network.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Cloudinary assets are immutable — cache them hard.
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cloudinary-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts stylesheets and font files.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts" },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sppl/shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Local development talks to the Express server without CORS friction.
      "/api": {
        target: "[localhost](http://localhost:5000)",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries so a content update does not
        // invalidate the vendor chunk for every returning visitor.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          firebase: ["firebase/app", "firebase/auth"],
          query: ["@tanstack/react-query", "axios"],
          i18n: ["i18next", "react-i18next"],
        },
      },
    },
  },
});
