import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import MatchStatusBadge from '../../components/cricket/MatchStatusBadge.jsx';
import { BallChip } from '../../components/cricket/BallByBall.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import StartMatchForm from '../../components/admin/StartMatchForm.jsx';
import WicketSheet from '../../components/admin/WicketSheet.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import {
  useScoringContext,
  useRecordBall,
  useUndoBall,
  useStartMatch,
  useEndInnings,
} from '../../hooks/useScoring.js';
import { formatOvers, toBengaliDigits } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

/**
 * The scoring console.
 *
 * Design notes, because this screen is used one-handed at the boundary in daylight:
 *
 *   - the run buttons are the biggest thing on the page and sit at the BOTTOM, where
 *     a thumb reaches. Everything read-only is above them.
 *   - the last ball is always visible beside the undo button, so a mis-tap is caught
 *     immediately rather than three overs later.
 *   - undo is a single tap, not a menu. It is the most-used correction by a wide
 *     margin and burying it costs the scorer more time than any other control.
 *   - nothing is optimistic. The score shown is always the score the server
 *     confirmed, because a score that flickers back is worse than one that lags.
 */
export default function LiveScoringMatch() {
  const { t } = useTranslation();
  const { matchId } = useParams();

  const [banner, setBanner] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [wicketOpen, setWicketOpen] = useState(false);

  const contextQuery = useScoringContext(matchId);
  const recordBall = useRecordBall(matchId);
  const undoBall = useUndoBall(matchId);
  const startMatch = useStartMatch(matchId);
  const endInnings = useEndInnings(matchId);

  const context = contextQuery.data;
  const match = context?.match;
  const innings = context?.currentInnings ?? null;

  /**
   * The batter on strike and the bowler, read from the innings state the API sent.
   *
   * `batting` and `bowling` lines hold only a player ID, so the display name is
   * looked up from `playingSquads`, which the context is populated with.
   */
  const playerById = useMemo(() => {
    const map = new Map();
    for (const squad of match?.playingSquads ?? []) {
      for (const player of squad.playerIds ?? []) {
        map.set(String(player.id ?? player._id), player);
      }
    }
    return map;
  }, [match]);

  const strikerLine = innings?.batting?.find((line) => line.isStriker) ?? null;
  const nonStrikerLine =
    innings?.batting?.find((line) => line.hasBatted && !line.isOut && !line.isStriker) ?? null;
  const bowlerLine = innings?.bowling?.find((line) => line.isBowling) ?? null;

  const striker = strikerLine ? playerById.get(String(strikerLine.playerId)) : null;
  const nonStriker = nonStrikerLine ? playerById.get(String(nonStrikerLine.playerId)) : null;
  const bowler = bowlerLine ? playerById.get(String(bowlerLine.playerId)) : null;

  const battingSquad = match?.playingSquads?.find(
    (squad) => String(squad.teamId) === String(innings?.battingTeamId),
  );
  const bowlingSquad = match?.playingSquads?.find(
    (squad) => String(squad.teamId) === String(innings?.bowlingTeamId),
  );

  if (contextQuery.isError) {
    return (
      <div className="container-page py-12">
        <ErrorState message={contextQuery.error?.message} onRetry={contextQuery.refetch} />
      </div>
    );
  }

  if (contextQuery.isLoading || !match) {
    return (
      <div className="container-page py-12">
        <div className="card p-8 text-center text-sm text-content-muted">{t('common.loading')}</div>
      </div>
    );
  }

  // Not started yet: the two nines and who bats first have to be chosen.
  if (match.status === 'UPCOMING' || match.status === 'TOSS') {
    return (
      <>
        <SEO title={t('admin.liveScoring')} noIndex />
        <StartMatchForm
          match={match}
          onStart={startMatch}
          onDone={() => contextQuery.refetch()}
        />
      </>
    );
  }

  const canScore = match.status === 'LIVE';

  const sendBall = async (spec) => {
    if (!striker || !bowler) {
      setBanner({ tone: 'error', text: t('scoring.selectPlayersFirst') });
      return;
    }

    setBanner(null);

    try {
      const result = await recordBall.mutateAsync({
        innings: match.currentInnings,
        batterId: striker.id ?? striker._id,
        nonStrikerId: (nonStriker ?? striker).id ?? (nonStriker ?? striker)._id,
        bowlerId: bowler.id ?? bowler._id,
        ...spec,
      });

      if (result.matchCompleted) {
        setBanner({ tone: 'success', text: t('scoring.matchCompleted') });
      } else if (result.inningsEnded) {
        setBanner({ tone: 'success', text: t('scoring.inningsEnded') });
      }
    } catch (error) {
      setBanner({ tone: 'error', text: error?.message ?? t('common.error') });
    }
  };

  const onUndo = async () => {
    try {
      await undoBall.mutateAsync(match.currentInnings);
      setBanner(null);
    } catch (error) {
      setBanner({ tone: 'error', text: error?.message ?? t('common.error') });
    }
  };

  const recentBalls = context.recentBalls ?? [];
  const lastBall = recentBalls[0] ?? null;

  /** Runs needed, only meaningful while chasing. */
  const runsNeeded =
    match.currentInnings === 1 && innings?.target
      ? Math.max(0, innings.target - (innings.runs ?? 0))
      : null;

  return (
    <>
      <SEO title={t('admin.liveScoring')} noIndex />

      <div className="mx-auto max-w-3xl pb-44">
        {/* Header: score, overs, target */}
        <header className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/admin/live-scoring"
              aria-label={t('common.back')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition hover:bg-surface-sunken"
            >
              ←
            </Link>

            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold text-content-primary">
                {match.teamAId?.name} vs {match.teamBId?.name}
              </p>
              <p className="text-2xs text-content-muted">
                {t('match.matchNo', { number: toBengaliDigits(match.matchNo) })}
              </p>
            </div>

            <MatchStatusBadge status={match.status} />
          </div>

          <div className="mt-4 flex items-end justify-center gap-3">
            <span className="tabular font-display text-4xl font-extrabold text-content-primary">
              {toBengaliDigits(innings?.runs ?? 0)}/{toBengaliDigits(innings?.wickets ?? 0)}
            </span>
            <span className="tabular pb-1 text-sm text-content-muted">
              ({toBengaliDigits(formatOvers(innings?.balls ?? 0))})
            </span>
          </div>

          {runsNeeded !== null && (
            <p className="mt-2 text-center text-sm font-semibold text-gold">
              {t('scoring.needRuns', { runs: toBengaliDigits(runsNeeded) })}
            </p>
          )}

          {context.freeHitPending && (
            <p className="mt-3 rounded-lg bg-gold/15 py-2 text-center text-sm font-bold text-gold-dark">
              {t('scoring.freeHit')}
            </p>
          )}

          {!canScore && (
            <p className="mt-3 rounded-lg bg-brand/10 py-2 text-center text-sm font-semibold text-brand-light">
              {t('scoring.notLive')}
            </p>
          )}
        </header>

        {/* Who is in */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PlayerSlot
            label={t('scoring.striker')}
            name={striker?.jerseyName || striker?.fullName}
            tone="brand"
            detail={`${toBengaliDigits(strikerLine?.runs ?? 0)} (${toBengaliDigits(strikerLine?.balls ?? 0)})`}
          />
          <PlayerSlot
            label={t('scoring.nonStriker')}
            name={nonStriker?.jerseyName || nonStriker?.fullName}
            tone="muted"
            detail={`${toBengaliDigits(nonStrikerLine?.runs ?? 0)} (${toBengaliDigits(nonStrikerLine?.balls ?? 0)})`}
          />
        </div>

        <div className="mt-3">
          <PlayerSlot
            label={t('scoring.bowler')}
            name={bowler?.jerseyName || bowler?.fullName}
            tone="gold"
            detail={t('scoring.bowlerFigures', {
              overs: toBengaliDigits(formatOvers(bowlerLine?.balls ?? 0)),
              runs: toBengaliDigits(bowlerLine?.runs ?? 0),
              wickets: toBengaliDigits(bowlerLine?.wickets ?? 0),
            })}
          />
        </div>

        {banner && (
          <div
            role="status"
            className={cn(
              'mt-4 rounded-lg border px-3.5 py-3 text-sm',
              banner.tone === 'error'
                ? 'border-live/30 bg-live/10 text-live-light'
                : 'border-win/30 bg-win/10 text-win',
            )}
          >
            {banner.text}
          </div>
        )}

        {/* Recent balls, newest first */}
        {recentBalls.length > 0 && (
          <section className="mt-4 card p-4">
            <h2 className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
              {t('match.ballByBall')}
            </h2>
            <div className="mt-3 space-y-1.5">
              {recentBalls.slice(0, 5).map((ball) => (
                <div key={ball.sequence} className="flex items-center gap-3 text-sm">
                  <span className="tabular w-10 shrink-0 text-2xs text-content-muted">
                    {toBengaliDigits(ball.displayOver)}
                  </span>
                  <BallChip ball={ball} />
                  <span className="min-w-0 flex-1 truncate text-xs text-content-secondary">
                    {ball.commentaryBn || ball.commentaryEn}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action bar, thumb-height, always visible */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface-base/95 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-3 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="tabular truncate text-2xs text-content-muted">
                {lastBall
                  ? `${toBengaliDigits(lastBall.displayOver)} — ${lastBall.commentaryBn || lastBall.commentaryEn}`
                  : t('scoring.noBallsYet')}
              </span>

              <button
                type="button"
                onClick={onUndo}
                disabled={undoBall.isPending || !canScore}
                className="shrink-0 rounded-pill border border-live/40 px-4 py-2 text-xs font-bold text-live transition hover:bg-live/10 disabled:opacity-40"
              >
                ↺ {t('scoring.undo')}
              </button>
            </div>

            {/* Runs. The four and the six are coloured because they are what a scorer
                checks for first when reading back a ball. */}
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 6].map((runs) => (
                <button
                  key={runs}
                  type="button"
                  disabled={!canScore || recordBall.isPending}
                  onClick={() => sendBall({ runsBat: runs })}
                  className={cn(
                    'rounded-xl py-4 font-display text-xl font-extrabold transition disabled:opacity-40',
                    runs === 4 && 'bg-brand text-white hover:bg-brand-dark',
                    runs === 6 && 'bg-gold text-navy-900 hover:bg-gold-light',
                    runs !== 4 && runs !== 6 && 'bg-surface-raised text-content-primary hover:bg-surface-sunken',
                  )}
                >
                  {toBengaliDigits(runs)}
                </button>
              ))}
            </div>

            {/* Extras and wicket */}
            <div className="mt-2 grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => sendBall({ extraType: 'WIDE' })}
                className="rounded-xl bg-surface-raised py-3 text-sm font-bold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
              >
                {t('scoring.wide')}
              </button>
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => sendBall({ extraType: 'NO_BALL' })}
                className="rounded-xl bg-surface-raised py-3 text-sm font-bold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
              >
                {t('scoring.noBall')}
              </button>
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => sendBall({ extraType: 'BYE' })}
                className="rounded-xl bg-surface-raised py-3 text-sm font-bold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
              >
                {t('scoring.bye')}
              </button>
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => setWicketOpen(true)}
                className="rounded-xl bg-live py-3 text-sm font-bold text-white transition hover:bg-live-dark disabled:opacity-40"
              >
                {t('scoring.wicket')}
              </button>
            </div>

            {canScore && (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="mt-2 w-full rounded-lg py-2 text-2xs font-semibold text-content-muted transition hover:bg-surface-sunken"
              >
                {t('scoring.endInnings')}
              </button>
            )}
          </div>
        </div>
      </div>

      <WicketSheet
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        battingSquad={battingSquad}
        bowlingSquad={bowlingSquad}
        onConfirm={(spec) => {
          setWicketOpen(false);
          sendBall(spec);
        }}
      />

      <ConfirmDialog
        open={confirmEnd}
        title={t('scoring.endInningsTitle')}
        message={t('scoring.endInningsBody')}
        confirmLabel={t('scoring.endInnings')}
        busy={endInnings.isPending}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={async () => {
          await endInnings.mutateAsync('DECLARED');
          setConfirmEnd(false);
          contextQuery.refetch();
        }}
      />
    </>
  );
}

/** One labelled slot: striker, non-striker or bowler. */
function PlayerSlot({ label, name, tone, detail }) {
  const toneClass =
    tone === 'brand'
      ? 'border-brand/40 bg-brand/5'
      : tone === 'gold'
        ? 'border-gold/40 bg-gold/5'
        : 'border-surface-border bg-surface-raised';

  return (
    <div className={cn('rounded-xl border p-3', toneClass)}>
      <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-content-primary">{name || '—'}</p>
      {detail && <p className="tabular mt-0.5 text-xs text-content-secondary">{detail}</p>}
    </div>
  );
}
