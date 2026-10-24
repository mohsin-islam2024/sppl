import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { GridSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSponsors } from '../../hooks/useContent.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Sponsors page.
 *
 * Grouped by tier, title sponsor first. The tiers are ordered here instead of
 * trusting the server's sort: the API sorts by the tier's name, which is
 * alphabetical (GOLD, PARTNER, PLATINUM, TITLE) and would put the title sponsor
 * last. Within a tier the server's `order` then name sort is kept.
 */
const TIER_ORDER = ['TITLE', 'PLATINUM', 'GOLD', 'PARTNER'];

function SponsorCard({ sponsor, large, visitLabel }) {
  const body = (
    <>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-lg bg-white p-3 ${
          large ? 'h-32' : 'h-24'
        }`}
      >
        {sponsor.logoUrl && (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-content-primary">{sponsor.name}</p>
      {(sponsor.phone || sponsor.address) && (
        <p className="mt-1 text-center text-2xs text-content-muted">
          {[sponsor.phone, sponsor.address].filter(Boolean).join(' · ')}
        </p>
      )}
      {sponsor.website && (
        <p className="mt-1.5 text-center text-2xs font-semibold text-brand-light">{visitLabel} ↗</p>
      )}
    </>
  );

  const className = 'card block p-3 transition hover:border-brand/40';

  // A sponsor's website is typed by an admin; noopener keeps the linked site from
  // getting a handle on this page.
  return sponsor.website ? (
    <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default function Sponsors() {
  const { t } = useTranslation();
  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const { data, isLoading, isError, error, refetch } = useSponsors({ season: identifier });

  const sponsors = Array.isArray(data) ? data : [];

  const tierLabel = {
    TITLE: t('sponsors.tierTitle'),
    PLATINUM: t('sponsors.tierPlatinum'),
    GOLD: t('sponsors.tierGold'),
    PARTNER: t('sponsors.tierPartner'),
  };

  const groups = TIER_ORDER.map((tier) => ({
    tier,
    items: sponsors.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <SEO title={t('nav.sponsors')} description={t('sponsors.seoDescription')} path="/sponsors" />

      <PageHeader
        title={t('nav.sponsors')}
        subtitle={
          season ? t('sponsors.subtitle', { season: `${season.shortName} ${toBengaliDigits(season.seasonNo)}` }) : undefined
        }
      />

      <div className="container-page space-y-10 py-8">
        {isLoading || seasonLoading ? (
          <GridSkeleton count={6} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : groups.length ? (
          groups.map((group) => (
            <section key={group.tier}>
              <h2 className="mb-4 text-2xs font-bold uppercase tracking-[0.2em] text-gold">
                {tierLabel[group.tier]}
              </h2>
              <div
                className={`grid gap-4 ${
                  group.tier === 'TITLE'
                    ? 'sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                }`}
              >
                {group.items.map((sponsor) => (
                  <SponsorCard
                    key={sponsor._id ?? sponsor.id}
                    sponsor={sponsor}
                    large={group.tier === 'TITLE'}
                    visitLabel={t('sponsors.visit')}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            variant="default"
            title={t('sponsors.emptyTitle')}
            description={isArchived ? t('empty.archivedBody') : t('sponsors.emptyBody')}
            icon="🤝"
          />
        )}
      </div>
    </>
  );
}
