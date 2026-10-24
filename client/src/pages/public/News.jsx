import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { GridSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useNews } from '../../hooks/useContent.js';
import { formatDate, toBengaliDigits } from '../../utils/format.js';

/**
 * News list.
 *
 * Only published articles reach this page; drafts stay in the admin panel. The list
 * endpoint deliberately leaves out each article's full text, so opening a page of
 * twelve cards downloads twelve summaries, not twelve complete articles.
 */
export default function News() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useNews({ season: identifier, page });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const pick = (item, field) =>
    lang === 'bn' ? item[`${field}Bn`] || item[`${field}En`] : item[`${field}En`] || item[`${field}Bn`];

  return (
    <>
      <SEO title={t('nav.news')} description={t('news.seoDescription')} path="/news" />

      <PageHeader
        title={t('nav.news')}
        subtitle={
          season ? t('news.subtitle', { season: `${season.shortName} ${toBengaliDigits(season.seasonNo)}` }) : undefined
        }
      />

      <div className="container-page py-8">
        {isLoading || seasonLoading ? (
          <GridSkeleton count={6} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : items.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link
                  key={item._id ?? item.id}
                  to={`/news/${item.slug}`}
                  className="card group flex flex-col overflow-hidden transition hover:border-brand/40"
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex aspect-video w-full items-center justify-center bg-surface-sunken text-3xl"
                      aria-hidden="true"
                    >
                      🏏
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    {item.publishedAt && (
                      <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                        {formatDate(item.publishedAt, lang)}
                      </p>
                    )}
                    <h2 className="mt-1.5 font-display text-base font-bold text-content-primary group-hover:text-brand-light">
                      {pick(item, 'title')}
                    </h2>
                    {pick(item, 'excerpt') && (
                      <p className="mt-2 line-clamp-3 text-sm text-content-secondary">{pick(item, 'excerpt')}</p>
                    )}
                    <span className="mt-3 text-sm font-semibold text-brand-light">{t('news.readMore')} →</span>
                  </div>
                </Link>
              ))}
            </div>

            {meta && meta.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
                <button
                  type="button"
                  disabled={!meta.hasPrev}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-pill border border-surface-border px-4 py-2 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
                >
                  ← {t('news.newer')}
                </button>
                <span className="tabular text-sm text-content-muted">
                  {meta.page} / {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={!meta.hasNext}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-pill border border-surface-border px-4 py-2 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
                >
                  {t('news.older')} →
                </button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            variant="default"
            title={t('news.emptyTitle')}
            description={isArchived ? t('empty.archivedBody') : t('news.emptyBody')}
            icon="📰"
          />
        )}
      </div>
    </>
  );
}
