import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Wicket entry sheet.
 *
 * A wicket needs two extra facts a run button cannot supply: how the batter was out,
 * and who was involved in it. That is enough to warrant its own panel.
 *
 * The dismissal types are filtered by what the fielding side can actually do:
 *   - a run out credits no bowler, and the fielder is required
 *   - a bowled or lbw credits no fielder
 *   - a caught needs the fielder
 *   - a six-out in this tournament is the short-pitch rule: the batter is out and no
 *     runs are scored, and nobody is credited — no bowler, no fielder.
 * The sheet hides the fields that do not apply rather than letting the scorer pick
 * a combination the API will reject.
 */

const BOWLER_CREDITED = ['BOWLED', 'CAUGHT', 'LBW', 'STUMPED', 'HIT_WICKET'];
const NEEDS_FIELDER = ['CAUGHT', 'RUN_OUT', 'STUMPED'];

/** Dismissal options shown when a free hit is pending — only a run out is possible. */
const FREE_HIT_TYPES = ['RUN_OUT'];

/**
 * The full list, in the order a scorer reads it.
 *
 * `SIX_OUT` sits at the end because it is the tournament's own short-pitch rule rather
 * than one of the Laws' dismissals, and it sits beside its neighbours rather than in a
 * separate menu so the scorer does not have to remember where it lives.
 */
const ALL_TYPES = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'STUMPED',
  'HIT_WICKET',
  'RUN_OUT',
  'RETIRED',
  'SIX_OUT',
];

export default function WicketSheet({ open, onClose, battingSquad, bowlingSquad, onConfirm, freeHit = false }) {
  const { t } = useTranslation();

  const [wicketType, setWicketType] = useState('BOWLED');
  const [dismissedPlayerId, setDismissedPlayerId] = useState('');
  const [fielderId, setFielderId] = useState('');
  const [runsBat, setRunsBat] = useState(0);
  const [error, setError] = useState(null);

  // A sheet that keeps yesterday's selection is how the wrong player gets marked out.
  useEffect(() => {
    if (open) {
      setWicketType('BOWLED');
      setDismissedPlayerId('');
      setFielderId('');
      setRunsBat(0);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const battingPlayers = battingSquad?.playerIds ?? [];
  const bowlingPlayers = bowlingSquad?.playerIds ?? [];

  // On a free hit only the run out is offered, so the scorer cannot pick a dismissal
  // the server would reject.
  const types = freeHit ? FREE_HIT_TYPES : ALL_TYPES;

  const needsFielder = NEEDS_FIELDER.includes(wicketType);
  const creditedToBowler = BOWLER_CREDITED.includes(wicketType);

  // A six-out scores nothing and is a plain dismissal: the run question has no answer,
  // so it is hidden rather than left at 0 for the scorer to wonder about.
  const isSixOut = wicketType === 'SIX_OUT';

  const submit = () => {
    setError(null);

    if (!dismissedPlayerId) {
      setError(t('scoring.selectDismissedPlayer'));
      return;
    }
    if (needsFielder && !fielderId) {
      setError(t('scoring.selectFielder'));
      return;
    }

    onConfirm({
      // A six-out is never worth runs.
      runsBat: isSixOut ? 0 : runsBat,
      isWicket: true,
      wicketType,
      dismissedPlayerId,
      fielderId: needsFielder ? fielderId : null,
      bowlerCredited: creditedToBowler,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wicket-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-navy-950/70 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-raised p-5 sm:rounded-card">
        <div className="flex items-center justify-between">
          <h2 id="wicket-title" className="font-display text-base font-bold text-content-primary">
            {t('scoring.wicket')}
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

        {freeHit && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-xs font-semibold text-gold-dark">
            {t('scoring.freeHitRunOutOnly')}
          </p>
        )}

        {/* How out */}
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-content-secondary">
            {t('scoring.dismissalType')}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {types.map((type) => {
              const isChosen = wicketType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setWicketType(type);
                    if (!NEEDS_FIELDER.includes(type)) setFielderId('');
                    if (type === 'SIX_OUT') setRunsBat(0);
                  }}
                  aria-pressed={isChosen}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                    isChosen
                      ? 'border-live bg-live/10 text-live'
                      : 'border-surface-border bg-surface-raised text-content-secondary hover:bg-surface-sunken'
                  }`}
                >
                  {t(`scoring.wicketType.${type}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Who is out */}
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-semibold text-content-secondary">
            {t('scoring.dismissedBatter')}
          </span>
          <select
            value={dismissedPlayerId}
            onChange={(event) => setDismissedPlayerId(event.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">{t('admin.noneSelected')}</option>
            {battingPlayers.map((player) => {
              const id = player.id ?? player._id;
              return (
                <option key={id} value={id}>
                  #{player.jerseyNo} {player.jerseyName || player.fullName}
                </option>
              );
            })}
          </select>
        </label>

        {/* Fielder, only when it applies */}
        {needsFielder && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-content-secondary">
              {t('scoring.fielder')}
            </span>
            <select
              value={fielderId}
              onChange={(event) => setFielderId(event.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">{t('admin.noneSelected')}</option>
              {bowlingPlayers.map((player) => {
                const id = player.id ?? player._id;
                return (
                  <option key={id} value={id}>
                    #{player.jerseyNo} {player.jerseyName || player.fullName}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {/* Runs scored on the same ball — a run out can happen going for a second run */}
        {!isSixOut && (
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-content-secondary">
              {t('scoring.runsOnThisBall')}
            </legend>
            <div className="mt-2 flex gap-2">
              {[0, 1, 2, 3].map((runs) => (
                <button
                  key={runs}
                  type="button"
                  onClick={() => setRunsBat(runs)}
                  aria-pressed={runsBat === runs}
                  className={`tabular h-11 flex-1 rounded-lg border text-sm font-bold transition ${
                    runsBat === runs
                      ? 'border-brand bg-brand/10 text-brand-light'
                      : 'border-surface-border bg-surface-raised text-content-secondary hover:bg-surface-sunken'
                  }`}
                >
                  {toBengaliDigits(runs)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {isSixOut && (
          <p className="mt-5 rounded-lg border border-surface-border bg-surface-sunken px-3.5 py-3 text-xs text-content-secondary">
            {t('scoring.sixOutNote')}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-live/30 bg-live/10 px-3.5 py-3 text-sm text-live-light"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-pill bg-live px-5 py-3 text-sm font-bold text-white transition hover:bg-live-dark"
          >
            {t('scoring.confirmWicket')}
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
