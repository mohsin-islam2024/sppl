import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { GridSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useGallery } from '../../hooks/useContent.js';

/**
 * Gallery.
 *
 * A CSS-columns masonry rather than a fixed grid: match photographs arrive in
 * portrait and landscape, and forcing them into equal boxes either crops faces or
 * leaves dead space. Columns let each image keep its own proportions.
 *
 * The lightbox is a plain overlay with Escape and arrow-key handling. Focus moves
 * into it on open, so a keyboard user is not left behind at the top of the page.
 */
export default function Gallery() {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(null);
  const lang = document.documentElement.lang === 'bn' ? 'bn' : 'en';

  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const { data, isLoading, isError, error, refetch } = useGallery({ season: identifier, limit: 60 });

  const items = data?.items ?? [];

  /** Caption in the reader's language, falling back to whichever exists. */
  const captionOf = (item) =>
    lang === 'bn' ? item.captionBn || item.captionEn : item.captionEn || item.captionBn;

  const close = () => setActiveIndex(null);

  const step = (delta) => {
    setActiveIndex((current) => {
      if (current === null) return current;
      const next = current + delta;
      if (next < 0) return items.length - 1;
      if (next >= items.length) return 0;
      return next;
    });
  };

  return (
    <>
      <SEO title={t('nav.gallery')} description={t('gallery.seoDescription')} path="/gallery" />

      <PageHeader
        title={t('nav.gallery')}
        subtitle={
          season
            ? t('gallery.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
      />

      <div className="container-page py-8">
        {isLoading || seasonLoading ? (
          <GridSkeleton count={9} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : items.length ? (
          <>
            <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="group block w-full break-inside-avoid overflow-hidden rounded-card border border-surface-border bg-surface-raised text-left transition hover:border-brand/40"
                >
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={captionOf(item) || t('gallery.imageAlt')}
                    loading="lazy"
                    className="w-full object-cover transition group-hover:scale-[1.02]"
                  />
                  {captionOf(item) && (
                    <span className="block px-3 py-2 text-2xs text-content-muted">
                      {captionOf(item)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeIndex !== null && items[activeIndex] && (
              <Lightbox
                item={items[activeIndex]}
                caption={captionOf(items[activeIndex])}
                onClose={close}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                position={activeIndex + 1}
                total={items.length}
              />
            )}
          </>
        ) : (
          <EmptyState
            variant={isArchived ? 'noResults' : 'default'}
            title={t('gallery.emptyTitle')}
            description={t('gallery.emptyBody')}
          />
        )}
      </div>
    </>
  );
}

/** Full-screen viewer. */
function Lightbox({ item, caption, onClose, onPrev, onNext, position, total }) {
  const { t } = useTranslation();

  // Keyboard handling is attached to the overlay, which is focused on mount, rather
  // than to the document — a global listener would keep firing after the lightbox
  // closed if a cleanup were ever missed.
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'ArrowLeft') onPrev();
    if (event.key === 'ArrowRight') onNext();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.lightboxLabel')}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      ref={(node) => node?.focus()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/95 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
      >
        ✕
      </button>

      <button
        type="button"
        onClick={onPrev}
        aria-label={t('gallery.previous')}
        className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={onNext}
        aria-label={t('gallery.next')}
        className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
      >
        ›
      </button>

      <figure className="max-h-full max-w-5xl">
        <img
          src={item.url}
          alt={caption || t('gallery.imageAlt')}
          className="max-h-[80vh] w-auto rounded-lg object-contain"
        />
        <figcaption className="mt-3 text-center text-sm text-white/80">
          {caption}
          <span className="ml-3 text-white/50">
            {t('gallery.position', { current: position, total })}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
