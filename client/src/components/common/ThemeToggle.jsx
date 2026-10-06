import { useTranslation } from 'react-i18next';
import useTheme from '../../hooks/useTheme.js';

/**
 * Theme toggle.
 *
 * Cycles light ↔ dark with an explicit icon. The icon shows the ACTION, not the
 * current state — a sun means "switch to light", which is what people expect from
 * a button.
 */
export default function ThemeToggle({ className = '' }) {
  const { t } = useTranslation();
  const { isDark, toggleTheme, mode } = useTheme();

  const label = mode === 'system' ? t('theme.system') : isDark ? t('theme.dark') : t('theme.light');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={`${t('theme.dark')} / ${t('theme.light')}`}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-content-secondary transition hover:bg-surface-sunken hover:text-content-primary ${className}`}
    >
      {isDark ? (
        /* Sun — clicking switches to light */
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        /* Moon — clicking switches to dark */
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
