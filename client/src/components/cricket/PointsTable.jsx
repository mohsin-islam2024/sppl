import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * The points table.
 *
 * Sorting and positions come from the server. This component only renders the order
 * it is given — with a four-team league the points tiebreak decides who reaches the
 * final, and a second implementation of that rule in the client would eventually
 * disagree with the scorer's.
 *
 * Rendered as a real `<table>` rather than a grid of divs so a screen reader can
 * announce "row 2, Points, 4" instead of reading a flat list of numbers.
 */
export default function PointsTable({ table = [], compact = false, highlightTop = 0 }) {
  const { t } = useTranslation();

  if (!table.length) {
    return (
      <div className="card p-6 text-center text-sm text-content-muted">{t('table.noTeamsYet')}</div>
    );
  }

  /** Highlight the qualifying places — top two go to the final in this format. */
  const isQualifying = (position) => highlightTop > 0 && position <= highlightTop;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">{t('table.caption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10 text-center">
                #
              </th>
              <th scope="col">{t('table.team')}</th>
              <th scope="col" className="text-center">
                {t('team.matches')}
              </th>
              {!compact && (
                <>
                  <th scope="col" className="text-center">
                    {t('team.won')}
                  </th>
                  <th scope="col" className="text-center">
                    {t('team.lost')}
                  </th>
                  <th scope="col" className="text-center">
                    {t('team.tied')}
                  </th>
                </>
              )}
              <th scope="col" className="text-center font-bold">
                {t('team.points')}
              </th>
              <th scope="col" className="text-right">
                {t('team.nrr')}
              </th>
              {!compact && (
                <th scope="col" className="text-center">
                  {t('team.form')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr
                key={row.teamId}
                className={isQualifying(row.position) ? 'bg-gold/[0.06]' : undefined}
              >
                <td className="text-center">
                  <span
                    className={
                      isQualifying(row.position)
                        ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-2xs font-bold text-gold-dark'
                        : 'text-xs font-semibold text-content-muted'
                    }
                  >
                    {toBengaliDigits(row.position)}
                  </span>
                </td>

                <td>
                  <div className="flex items-center gap-2.5">
                    {row.team?.logoUrl ? (
                      <img
                        src={row.team.logoUrl}
                        alt=""
                        width={24}
                        height={24}
                        loading="lazy"
                        className="h-6 w-6 shrink-0 rounded object-contain"
                      />
                    ) : (
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-2xs font-bold text-white"
                        style={{ backgroundColor: row.team?.themeColor || '#1e6fd9' }}
                        aria-hidden="true"
                      >
                        {row.team?.shortName?.slice(0, 3) ?? '—'}
                      </span>
                    )}
                    <Link
                      to={`/teams/${row.team?.slug ?? ''}`}
                      className="truncate font-medium text-content-primary hover:text-brand-light"
                    >
                      {row.team?.name ?? t('table.unknownTeam')}
                    </Link>
                  </div>
                </td>

                <td className="tabular text-center">{toBengaliDigits(row.played)}</td>

                {!compact && (
                  <>
                    <td className="tabular text-center">{toBengaliDigits(row.won)}</td>
                    <td className="tabular text-center">{toBengaliDigits(row.lost)}</td>
                    <td className="tabular text-center">{toBengaliDigits(row.tied)}</td>
                  </>
                )}

                <td className="tabular text-center font-bold text-content-primary">
                  {toBengaliDigits(row.points)}
                </td>

                <td className="tabular text-right">
                  <NrrValue value={row.nrr} />
                </td>

                {!compact && (
                  <td>
                    <FormStrip form={row.recentForm} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {highlightTop > 0 && (
        <p className="border-t border-surface-border px-4 py-2.5 text-2xs text-content-muted">
          {t('table.qualifyingNote', { count: toBengaliDigits(highlightTop) })}
        </p>
      )}
    </div>
  );
}

/** NRR with its sign, coloured only when it is meaningfully different from zero. */
function NrrValue({ value }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return <span className="text-content-muted">—</span>;

  const fixed = numeric.toFixed(3);
  const signed = numeric > 0 ? `+${fixed}` : fixed;

  const tone = numeric > 0.001 ? 'text-win' : numeric < -0.001 ? 'text-live' : 'text-content-muted';

  return <span className={tone}>{toBengaliDigits(signed)}</span>;
}

/**
 * Recent results as coloured chips: W, L, T, NR.
 *
 * Oldest first so the strip reads left to right like a timeline. The letters are
 * spelled out for a screen reader, because "W L W" read as letters is gibberish.
 */
function FormStrip({ form = [] }) {
  const { t } = useTranslation();

  if (!form.length) return <span className="text-xs text-content-muted">—</span>;

  const config = {
    W: { className: 'bg-win/20 text-win', label: t('table.formWin') },
    L: { className: 'bg-live/20 text-live', label: t('table.formLoss') },
    T: { className: 'bg-brand/20 text-brand-light', label: t('table.formTie') },
    NR: { className: 'bg-content-muted/20 text-content-muted', label: t('table.formNoResult') },
  };

  return (
    <div className="flex justify-center gap-1">
      {form.map((entry, index) => {
        const style = config[entry] ?? config.NR;
        return (
          <span
            key={`${entry}-${index}`}
            className={`inline-flex h-5 w-5 items-center justify-center rounded text-2xs font-bold ${style.className}`}
          >
            <span aria-hidden="true">{entry}</span>
            <span className="sr-only">{style.label}</span>
          </span>
        );
      })}
    </div>
  );
}
