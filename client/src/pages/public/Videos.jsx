import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { GridSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useVideos } from '../../hooks/useContent.js';
import { formatDate, toBengaliDigits } from '../../utils/format.js';

/**
 * Videos page.
 *
 * Nothing is loaded from YouTube until a visitor presses play. Each card shows the
 * still image; the player is created only on click. Twelve embedded players on one
 * page would each pull megabytes of scripts, which is painful on a village mobile
 * connection and slows the page for people who watch none of them.
 *
 * Only YouTube can be embedded with the id the server stored. Facebook and other
 * links open in a new tab instead of an iframe.
 */
export default function Videos() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState(null);

  const { data, isLoading, isError, error, refetch } = useVideos({ season: identifier, page });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const titleOf = (video) =>
    lang === 'bn' ? video.titleBn || video.titleEn : video.titleEn || video.titleBn;

  return (
    <>
      <SEO title={t('nav.videos')} description={t('videos.seoDescription')} path="/videos" />

      <PageHeader
        title={t('nav.videos')}
        subtitle={
          season ? t('videos.subtitle', { season: `${season.shortName} ${toBengaliDigits(season.seasonNo)}` }) : undefined
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
              {items.map((video) => {
                const id = video._id ?? video.id;
                const canEmbed = video.provider === 'YOUTUBE' && /^[A-Za-z0-9_-]{11}$/.test(video.embedId ?? '');
                const isPlaying = playing === id && canEmbed;

                return (
                  <article key={id} className="card overflow-hidden">
                    <div className="relative aspect-video w-full bg-surface-sunken">
                      {isPlaying ? (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${video.embedId}?autoplay=1&rel=0`}
                          title={titleOf(video)}
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          className="absolute inset-0 h-full w-full"
                        />
                      ) : canEmbed ? (
                        <button
                          type="button"
                          onClick={() => setPlaying(id)}
                          aria-label={`${t('videos.play')}: ${titleOf(video)}`}
                          className="group absolute inset-0"
                        >
                          {video.thumbnailUrl && (
                            <img src={video.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-xl text-black">
                              ▶
                            </span>
                          </span>
                        </button>
                      ) : (
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-content-secondary hover:text-brand-light"
                        >
                          <span className="text-3xl" aria-hidden="true">
                            🎬
                          </span>
                          <span className="text-sm font-semibold">{t('videos.openLink')} ↗</span>
                        </a>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="font-display text-base font-bold text-content-primary">{titleOf(video)}</h2>
                      {video.publishedAt && (
                        <p className="mt-1 text-2xs text-content-muted">{formatDate(video.publishedAt, lang)}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {meta && meta.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
                <button
                  type="button"
                  disabled={!meta.hasPrev}
                  onClick={() => {
                    setPlaying(null);
                    setPage((current) => Math.max(1, current - 1));
                  }}
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
                  onClick={() => {
                    setPlaying(null);
                    setPage((current) => current + 1);
                  }}
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
            title={t('videos.emptyTitle')}
            description={isArchived ? t('empty.archivedBody') : t('videos.emptyBody')}
            icon="🎬"
          />
        )}
      </div>
    </>
  );
}
