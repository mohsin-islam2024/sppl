import AppRoutes from './router/index.jsx';

/**
 * App root.
 *
 * The skip link is the first focusable element on the page: it lets a keyboard or
 * screen-reader user jump past the header straight into the content of whatever
 * route rendered. `#main` is the <main> element in both layouts.
 *
 * Deliberately thin otherwise: providers live in main.jsx and routing lives in
 * router/, so the tree can be wrapped (analytics, a global toast host) without
 * touching the entry point.
 */
export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        মূল কনটেন্টে যান / Skip to content
      </a>
      <AppRoutes />
    </>
  );
}
