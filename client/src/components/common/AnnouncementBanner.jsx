import { useTranslation } from 'react-i18next';
import { useAnnouncements } from '../../hooks/useContent.js';

/**
 * Live announcements, shown as notice cards at the top of a page.
 *
 * The API returns only active, unexpired notices, already ordered urgent first, so
 * this component only has to draw them. It renders nothing when there are none, so
 * a season without announcements shows no empty box.
 *
 * At most three are shown: a page that opens with a wall of notices pushes the
 * scores below the fold, which is the opposite of what a notice is for.
 */

const MAX_SHOWN = 3;

const TONE = {
  URGENT: 'border-live/40 bg-live/10',
  IMPORTANT: 'border-gold/40 bg-gold/10',
  NORMAL: 'border-brand/30 bg-brand/10',
};

const TITLE_TONE = {
  URGENT: 'text-live-light',
  IMPORTANT: 'text-gold',
  NORMAL: 'text-brand-light',
};

export default function AnnouncementBanner({ season }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const { data } = useAnnouncements({ season });
  const items = (Array.isArray(data) ? data : []).slice(0, MAX_SHOWN);

  if (items.length === 0) return null;

  // Prefer the reader's language, fall back to the other if it was left empty.
  const pick = (item, field) =>
    lang === 'bn' ? item[`${field}Bn`] || item[`${field}En`] : item[`${field}En`] || item[`${field}Bn`];

  return (
    <section aria-label={t('home.announcements')} className="border-b border-surface-border bg-surface-base">
      <div className="container-page space-y-2.5 py-4">
        {items.map((item) => {
          const priority = item.priority in TONE ? item.priority : 'NORMAL';
          return (
            <article
              key={item._id ?? item.id}
              role={priority === 'URGENT' ? 'alert' : undefined}
              className={`rounded-lg border px-4 py-3 ${TONE[priority]}`}
            >
              <h2 className={`text-sm font-bold ${TITLE_TONE[priority]}`}>{pick(item, 'title')}</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-content-secondary">{pick(item, 'body')}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
