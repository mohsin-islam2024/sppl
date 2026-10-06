import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n/index.js';

/**
 * Language switcher.
 *
 * Two segmented buttons rather than a dropdown: there are only two languages, the
 * choice is visible at a glance, and it is one tap on a phone instead of two.
 * A single toggle button would be smaller but would hide which language is active.
 */
export default function LanguageToggle({ className = '' }) {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  return (
    <div
      className={`inline-flex items-center rounded-pill border border-surface-border bg-surface-raised p-0.5 ${className}`}
      role="group"
      aria-label={t('language.switch')}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = current === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => i18n.changeLanguage(lang.code)}
            aria-pressed={isActive}
            className={[
              'rounded-pill px-2.5 py-1 text-2xs font-bold uppercase tracking-wide transition',
              isActive ? 'bg-brand text-white' : 'text-content-muted hover:text-content-primary',
            ].join(' ')}
          >
            {lang.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
