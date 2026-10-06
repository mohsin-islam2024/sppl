import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { registerSW } from 'virtual:pwa-register';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './i18n/index.js';
import './styles/index.css';

/**
 * Application entry.
 *
 * Provider order matters:
 *   QueryClient  — data layer, outermost so nothing below re-creates it
 *   Helmet       — head management for SEO tags
 *   Theme        — reads localStorage before first paint of themed content
 *   Auth         — depends on Firebase, which is independent of the above
 *   Router       — innermost, because routes are the leaf
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Scores change constantly but a points table does not; individual hooks
      // override this. Five minutes is a sane site-wide default.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      // Refetching on window focus is right for live scores and wrong for
      // everything else, so it is opt-in per hook rather than global.
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Service worker registration.
 *
 * `autoUpdate` means a new deployment takes effect on the next navigation instead
 * of stranding an open tab on a stale build — the usual cause of "the score is not
 * updating" reports during a match.
 */
registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[pwa] ready to work offline');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </StrictMode>,
);
