import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme context.
 *
 * Three modes: 'light', 'dark' and 'system'. The chosen mode is persisted, while
 * 'system' follows `prefers-color-scheme` live — if the user's OS switches at
 * sunset, the site follows without a reload.
 */
const ThemeContext = createContext(null);
const STORAGE_KEY = 'sppl:theme';

const getSystemTheme = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const readStoredMode = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    // Private browsing can throw on localStorage access.
    return 'system';
  }
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);
  const [systemTheme, setSystemTheme] = useState(() =>
    typeof window === 'undefined' ? 'dark' : getSystemTheme(),
  );

  // Follow OS changes while in 'system' mode.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = mode === 'system' ? systemTheme : mode;

  // Apply to <html> so Tailwind's `dark:` variants and the CSS variables both react.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;

    // Keep the mobile browser chrome in step with the theme.
    const themeColor = resolvedTheme === 'dark' ? '#0a1020' : '#f8fafc';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is a convenience; the in-memory value still works this session.
    }
  }, []);

  /** Cycle light → dark, which is what a single header button should do. */
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ mode, resolvedTheme, isDark: resolvedTheme === 'dark', setTheme, toggleTheme }),
    [mode, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeContext must be used inside <ThemeProvider>');
  return context;
}

export default ThemeContext;
