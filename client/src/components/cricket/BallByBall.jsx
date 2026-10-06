import { useTranslation } from 'react-i18next';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * One ball, as a chip.
 *
 * Five visual states, and they have to be distinguishable at a glance on a small
 * screen during a live match:
 *   wicket    red, with the dismissal types collapsed into one mark
 *   six       gold
 *   four      blue
 *   extras    muted (wides, no-balls, byes carry no batting credit)
 *   dot        plain, so a maiden over reads as a row of quiet chips
 */
export function BallChip({ ball }) {
  const { label, title, className } = describeBall(ball);

  return (
    <span
      title={title}
      className={`tabular inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * The recent-overs strip.
 *
 * Groups balls by over and marks the most recent ball, so the scorer and the
 * spectator can see where in the over the match is.
 */
export function OverTracker({ balls = [], maxOvers = 3 }) {
  const { t } = useTranslation();

  if (!balls.length) {
    return <p className="text-sm text-content-muted">{t('match.noBallsYet')}</p>;
  }

  // Balls arrive newest-first from the API; group them into overs without assuming
  // they are contiguous — a mid-over join still has to render something sensible.
  const overs = [];
  for (const ball of balls) {
    const key = ball.overIndex ?? Math.floor((ball.sequence ?? 1) - 1);
    const current = overs[overs.length - 1];
    if (current && current.overIndex === key) current.balls.push(ball);
    else overs.push({ overIndex: key, balls: [ball] });
  }

  return (
    <div className="space-y-2">
      {overs.slice(0, maxOvers).map((over, index) => (
        <div key={over.overIndex} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-2xs font-semibold uppercase tracking-wide text-content-muted">
            {t('match.overLabel', { number: toBengaliDigits(over.overIndex + 1) })}
          </span>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {over.balls.map((ball) => (
              <BallChip key={ball.sequence ?? ball.id} ball={ball} />
            ))}
          </div>
          {index === 0 && (
            <span className="ml-auto shrink-0 text-2xs text-content-muted">{t('match.thisOver')}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Ball-by-ball commentary list. */
export function BallByBall({ balls = [], showScore = true }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  if (!balls.length) {
    return <p className="text-sm text-content-muted">{t('match.noBallsYet')}</p>;
  }

  return (
    <ol className="divide-y divide-surface-border">
      {balls.map((ball) => {
        const { className } = describeBall(ball);
        const commentary = lang === 'bn' ? ball.commentaryBn : ball.commentaryEn;

        return (
          <li key={ball.sequence ?? ball.id} className="flex items-start gap-3 py-2.5">
            <span
              className={`tabular mt-0.5 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded text-2xs font-bold ${className}`}
            >
              {toBengaliDigits(ball.displayOver)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-content-primary">{commentary || t('match.ballFallback')}</p>
              {(ball.batterName || ball.bowlerName) && (
                <p className="mt-0.5 text-2xs text-content-muted">
                  {ball.batterName && <span>{ball.batterName}</span>}
                  {ball.batterName && ball.bowlerName && <span> · </span>}
                  {ball.bowlerName && <span>{ball.bowlerName}</span>}
                </p>
              )}
            </div>

            {showScore && ball.scoreAfter && (
              <span className="tabular shrink-0 text-xs font-semibold text-content-secondary">
                {toBengaliDigits(ball.scoreAfter.runs)}/{toBengaliDigits(ball.scoreAfter.wickets)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Compact last-six-balls row for a live score bar.
 * Oldest first here, because this strip is read as "what just happened".
 */
export function LastSixBalls({ balls = [] }) {
  const recent = [...balls].slice(0, 6).reverse();

  if (!recent.length) return null;

  return (
    <div className="flex items-center gap-1.5">
      {recent.map((ball) => (
        <BallChip key={ball.sequence ?? ball.id} ball={ball} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Presentation mapping
 * ------------------------------------------------------------------ */

/**
 * Turn a delivery into a chip label and style.
 *
 * Extras are handled before boundaries: a no-ball that the batter also hit for four
 * is recorded with both, and showing it as "4" would hide the extra that actually
 * matters to the score.
 */
function describeBall(ball) {
  if (!ball) return { label: '?', title: '', className: 'bg-surface-sunken text-content-muted' };

  if (ball.isWicket) {
    return { label: 'W', title: 'Wicket', className: 'bg-live text-white' };
  }

  if (ball.extraType === 'WIDE') {
    return { label: 'wd', title: 'Wide', className: 'bg-surface-sunken text-content-muted' };
  }

  if (ball.extraType === 'NO_BALL') {
    return { label: 'nb', title: 'No ball', className: 'bg-surface-sunken text-content-muted' };
  }

  if (ball.extraType === 'BYE') {
    return { label: 'b', title: 'Bye', className: 'bg-surface-sunken text-content-muted' };
  }

  if (ball.extraType === 'LEG_BYE') {
    return { label: 'lb', title: 'Leg bye', className: 'bg-surface-sunken text-content-muted' };
  }

  if (ball.isBoundarySix || ball.runsBat === 6) {
    return { label: '6', title: 'Six', className: 'bg-gold text-navy-900' };
  }

  if (ball.isBoundaryFour || ball.runsBat === 4) {
    return { label: '4', title: 'Four', className: 'bg-brand text-white' };
  }

  if ((ball.runsBat ?? 0) === 0) {
    return { label: '•', title: 'Dot ball', className: 'bg-surface-sunken text-content-muted' };
  }

  return {
    label: String(ball.runsBat),
    title: `${ball.runsBat} runs`,
    className: 'bg-surface-sunken text-content-primary',
  };
}

export default BallByBall;
