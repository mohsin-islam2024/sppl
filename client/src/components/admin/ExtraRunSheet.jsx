import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Extra-run sheet for a wide, a no-ball or a bye.
 *
 * All three carry runs on top of — or instead of — a base value, and the three behave
 * differently under the Laws:
 *
 *   - A WIDE is not a ball the batter can score off, so extra runs are *byes*: they go
 *     to the team's extras and never to the batter.
 *   - A NO-BALL is a ball the batter can score off, so runs struck go to the batter.
 *   - A BYE adds only the runs actually run, and no base value at all.
 *
 * The sheet asks one question and translates the answer into the right shape, rather
 * than making the scorer know which field to fill.
 */
export default function ExtraRunSheet({ open, kind, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [runs, setRuns] = useState(0);

  // The next extra deserves a fresh answer, not the last one.
  useEffect(() => {
    if (open) setRuns(0);
  }, [open, kind]);

  if (!open || !kind) return null;

  const isWide = kind === 'WIDE';
  const isNoBall = kind === 'NO_BALL';
  const isBye = kind === 'BYE' || kind === 'LEG_BYE';

  // Only a wide and a no-ball carry a base value; a bye is worth exactly what was run.
  const baseValue = isBye ? 0 : 1;

  const payload = isWide
    ? { extraType: 'WIDE', runsBat: 0, runsBye: runs }
    : isNoBall
      ? { extraType: 'NO_BALL', runsBat: runs, runsBye: 0 }
      : { extraType: kind, runsBat: 0, runsBye: runs };

  const total = baseValue + runs;

  // A wide tops out at 5 (base plus four byes) and a no-ball at 7 (base plus a six).
  // A bye can be run up to six.
  const choices = isWide ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 6];

  const title = isWide
    ? t('scoring.wide')
    : isNoBall
      ? t('scoring.noBall')
      : t('scoring.bye');

  const prompt = isWide
    ? t('scoring.wideExtraPrompt')
    : isNoBall
      ? t('scoring.noBallExtraPrompt')
      : t('scoring.byeExtraPrompt');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="extra-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-navy-950/70 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-raised p-5 sm:rounded-card">
        <div className="flex items-center justify-between">
          <h2 id="extra-title" className="font-display text-base font-bold text-content-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition hover:bg-surface-sunken"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-content-secondary">{prompt}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {choices.map((value) => {
            const isChosen = runs === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRuns(value)}
                aria-pressed={isChosen}
                className={`tabular h-14 min-w-[64px] flex-1 rounded-xl border font-display text-xl font-extrabold transition ${
                  isChosen
                    ? 'border-brand bg-brand/10 text-brand-light'
                    : 'border-surface-border bg-surface-raised text-content-primary hover:bg-surface-sunken'
                }`}
              >
                {toBengaliDigits(value)}
              </button>
            );
          })}
        </div>

        <p className="mt-4 rounded-lg border border-surface-border bg-surface-sunken px-3.5 py-3 text-sm text-content-secondary">
          {t('scoring.extraTotal', {
            total: toBengaliDigits(total),
            base: toBengaliDigits(baseValue),
            extra: toBengaliDigits(runs),
          })}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isBye && runs === 0}
            onClick={() => onConfirm(payload)}
            className="flex-1 rounded-pill bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-40"
          >
            {t('scoring.recordDelivery')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill border border-surface-border px-5 py-3 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
