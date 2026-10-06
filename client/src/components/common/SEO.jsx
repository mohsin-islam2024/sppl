import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

/**
 * Per-page SEO head.
 *
 * Sets title, description, canonical URL, Open Graph and Twitter Card tags, plus
 * an optional JSON-LD block. Passing structured data is left to the caller because
 * a match, a player and a news article need different schemas.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.image]      absolute or root-relative image URL
 * @param {string} [props.path]       canonical path, e.g. "/points-table"
 * @param {'website'|'article'|'profile'} [props.type]
 * @param {object} [props.structuredData]
 * @param {boolean} [props.noIndex]
 */
export default function SEO({
  title,
  description,
  image = '/logos/sppl-logo.png',
  path = '',
  type = 'website',
  structuredData = null,
  noIndex = false,
}) {
  const { i18n } = useTranslation();

  const siteName = 'SPPL';
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const siteUrl = window.location.origin;
  const canonical = `${siteUrl}${path}`;
  const absoluteImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
  const locale = i18n.language?.startsWith('bn') ? 'bn_BD' : 'en_US';

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <html lang={i18n.language?.startsWith('bn') ? 'bn' : 'en'} />

      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <link rel="canonical" href={canonical} />
      )}

      {/* Open Graph — the preview card when a fixture is shared in a messenger group */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={locale} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={absoluteImage} />

      {structuredData && (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      )}
    </Helmet>
  );
}

/**
 * Build SportsEvent structured data for a match.
 * Google uses this to show the fixture with a date and a location.
 *
 * @param {object} match
 * @param {object} teams  { [teamId]: { name, logoUrl } }
 */
export function buildMatchSchema(match, teams = {}) {
  if (!match) return null;

  const teamA = teams[match.teamAId];
  const teamB = teams[match.teamBId];

  return {
    '@context': '[schema.org](https://schema.org)',
    '@type': 'SportsEvent',
    name: `${teamA?.name ?? 'Team A'} vs ${teamB?.name ?? 'Team B'}`,
    startDate: match.startAt,
    eventStatus: '[schema.org](https://schema.org/EventScheduled)',
    location: {
      '@type': 'Place',
      name: match.venue || 'Sotahar Poshchim Para',
    },
    competitor: [
      teamA && { '@type': 'SportsTeam', name: teamA.name },
      teamB && { '@type': 'SportsTeam', name: teamB.name },
    ].filter(Boolean),
    sport: 'Cricket',
  };
}
