import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import MatchStatusBadge from '../../components/cricket/MatchStatusBadge.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import StartMatchForm from '../../components/admin/StartMatchForm.jsx';
import WicketSheet from '../../components/admin/WicketSheet.jsx';
import PlayerPickerSheet from '../../components/admin/PlayerPickerSheet.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import {
  useScoringContext,
  useRecordBall,
  useUndoBall,
  useStartMatch,
  useSetPlayers,
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
 *   - the striker / non-striker / bowler cards are TAPPABLE. Those three slots change
 *     many times in an innings — a batter comes in after every wicket and a bowler
 *     changes every over — and routing each change through a menu would cost the
 *     scorer more taps than any other control on the page.
 *   - nothing is optimistic. The score shown is always the score the server confirmed.
 *
 * A wicket opens a second step: the dismissal sheet, then the incoming batter. The
 * batting side cannot continue with an empty crease, and leaving it empty is how the
 * very first version of this screen dead-ended.
 */
export default function LiveScoringMatch() {
  const { t } = useTranslation();
  const { matchId } = useParams();

  const [banner, setBanner] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [picker, setPicker] = useState(null);

  const contextQuery = useScoringContext(matchId);
  const recordBall = useRecordBall(matchId);
  const undoBall = useUndoBall(matchId);
  const startMatch = useStartMatch(matchId);
  const setPlayers = useSetPlayers(matchId);
  const endInnings = useEndInnings(matchId);

  const context = contextQuery.data;
  const match = context?.match;
  const innings = context?.currentInnings ?? null;

  /** Every player in both playing squads, keyed by id, so names resolve quickly. */
  const playerById = useMemo(() => {
    const map = new Map();
    for (const squad of match?.playingSquads ?? []) {
      for (const player of squad.playerIds ?? []) {
        map.set(String(player._id ?? player.id), player);
      }
    }
    return map;
  }, [match]);

  const strikerLine = innings?.batting?.find((line) => line.isStriker) ?? null;
  const nonStrikerLine =
    innings?.batting?.find((line) => line.hasBatted && !line.isOut && !line.isStriker) ?? null;
  const bowlerLine = innings?.bowling?.find((line) => line.isBowling) ?? null;

  /** Candidates for each slot, as settled by the innings state. */
  const battingSquadIds = useMemo(() => {
    const squad = match?.playingSquads?.find(
      (entry) => String(entry.teamId) === String(innings?.battingTeamId),
    );
    return (squad?.playerIds ?? []).map((player) => player._id ?? player.id);
  }, [match, innings]);

  const bowlingSquadIds = useMemo(() => {
    const squad = match?.playingSquads?.find(
      (entry) => String(entry.teamId) === String(innings?.bowlingTeamId),
    );
    return (squad?.playerIds ?? []).map((player) => player._id ?? player.id);
  }, [match, innings]);

  /** Batters still able to bat: not out, and not already at the crease. */
  const availableBatters = useMemo(() => {
    return (innings?.batting ?? [])
      .filter((line) => !line.isOut)
      .map((line) => playerById.get(String(line.playerId)))
      .filter(Boolean);
  }, [innings, playerById]);

  const availableBowlers = useMemo(
    () => bowlingSquadIds.map((id) => playerById.get(String(id))).filter(Boolean),
    [bowlingSquadIds, playerById],
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

  // Not started yet: the two nines, who bats first, and the opening pair.
  if (match.status === 'UPCOMING' || match.status === 'TOSS') {
    return (
      <>
        <SEO title={t('admin.liveScoring')} noIndex />
        <StartMatchForm match={match} onStart={startMatch} onDone={() => contextQuery.refetch()} />
      </>
    );
  }

  const canScore = match.status === 'LIVE';

  const sendBall = async (spec) => {
    if (!strikerLine || !bowlerLine) {
      setBanner({ tone: 'error', text: t('scoring.selectPlayersFirst') });
      return;
    }

    setBanner(null);

    try {
        const result = await recordBall.mutateAsync({
        // The API's validation middleware runs on the request BODY, and the schema
        // requires matchId even though the route already carries it in the URL.
        // Omitting it made every delivery fail with "Validation failed".
        matchId,
        innings: match.currentInnings,
        batterId: strikerLine.playerId,
        nonStrikerId: nonStrikerLine?.playerId ?? strikerLine.playerId,
        bowlerId: bowlerLine.playerId,
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

  const applyPlayers = async (payload) => {
    setBanner(null);
    try {
      await setPlayers.mutateAsync(payload);
      setPicker(null);
    } catch (error) {
      setBanner({ tone: 'error', text: error?.message ?? t('common.error') });
      setPicker(null);
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

  const runsNeeded =
    match.currentInnings === 1 && innings?.target
      ? Math.max(0, innings.target - (innings.runs ?? 0))
      : null;

  /**
   * The next batter to bring in.
   *
   * The crease is empty after a wicket and the innings cannot continue without a
   * striker, so this prompt is not optional — but it is a prompt rather than an
   * automatic substitution, because the batting order is the scorer's call.
   */
  const strikerMissing = canScore && !strikerLine;
  const bowlerMissing = canScore && !bowlerLine;

  return (
    <>
      <SEO title={t('admin.liveScoring')} noIndex />

      <div className="mx-auto max-w-3xl pb-52">
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
        </header>

        {/* Who is in — each card opens a picker */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PlayerSlot
            label={t('scoring.striker')}
            name={strikerLine?.player?.jerseyName || strikerLine?.player?.fullName}
            tone="brand"
            detail={
              strikerLine
                ? `${toBengaliDigits(strikerLine.runs ?? 0)} (${toBengaliDigits(strikerLine.balls ?? 0)})`
                : null
            }
            onClick={canScore ? () => setPicker('striker') : undefined}
            actionLabel={t('scoring.change')}
          />
          <PlayerSlot
            label={t('scoring.nonStriker')}
            name={nonStrikerLine?.player?.jerseyName || nonStrikerLine?.player?.fullName}
            tone="muted"
            detail={
              nonStrikerLine
                ? `${toBengaliDigits(nonStrikerLine.runs ?? 0)} (${toBengaliDigits(nonStrikerLine.balls ?? 0)})`
                : null
            }
            onClick={canScore ? () => setPicker('nonStriker') : undefined}
            actionLabel={t('scoring.change')}
          />
        </div>

        <div className="mt-3">
          <PlayerSlot
            label={t('scoring.bowler')}
            name={bowlerLine?.player?.jerseyName || bowlerLine?.player?.fullName}
            tone="gold"
            detail={
              bowlerLine
                ? t('scoring.bowlerFigures', {
                    overs: toBengaliDigits(formatOvers(bowlerLine.balls ?? 0)),
                    runs: toBengaliDigits(bowlerLine.runs ?? 0),
                    wickets: toBengaliDigits(bowlerLine.wickets ?? 0),
                  })
                : null
            }
            onClick={canScore ? () => setPicker('bowler') : undefined}
            actionLabel={t('scoring.change')}
          />
        </div>

        {/* Something has to be chosen before the next ball can be scored */}
        {(strikerMissing || bowlerMissing) && (
          <div className="mt-4 rounded-lg border border-live/30 bg-live/10 px-3.5 py-3 text-sm text-live-light">
            {strikerMissing && bowlerMissing
              ? t('scoring.needStrikerAndBowler')
              : strikerMissing
                ? t('scoring.needStriker')
                : t('scoring.needBowler')}
          </div>
        )}

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

        {/* Recent balls */}
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
                    runs !== 4 &&
                      runs !== 6 &&
                      'bg-surface-raised text-content-primary hover:bg-surface-sunken',
                  )}
                >
                  {toBengaliDigits(runs)}
                </button>
              ))}
            </div>

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

      {/* Wicket: dismiss, then bring the next batter in */}
      <WicketSheet
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        battingSquad={formSquadFor(match, innings?.battingTeamId)}
        bowlingSquad={formSquadFor(match, innings?.bowlingTeamId)}
        onConfirm={async (spec) => {
          setWicketOpen(false);
          await sendBall(spec);
          // The crease is empty now; ask for the incoming batter straight away.
          setPicker('striker');
        }}
      />

      {/* Player pickers */}
      <PlayerPickerSheet
        open={picker === 'striker'}
        title={t('scoring.chooseStriker')}
        players={availableBatters}
        unavailable={[
          nonStrikerLine?.playerId,
          strikerLine?.playerId,
        ]}
        selectedId={strikerLine?.playerId}
        onPick={(id) => {
          const other = nonStrikerLine?.playerId;
          if (String(id) === String(other)) {
            setBanner({ tone: 'error', text: t('scoring.sameBatterTwice') });
            return;
          }
          applyPlayers({ strikerId: id, nonStrikerId: other });
        }}
        onClose={() => setPicker(null)}
      />

      <PlayerPickerSheet
        open={picker === 'nonStriker'}
        title={t('scoring.chooseNonStriker')}
        players={availableBatters}
        unavailable={[
          strikerLine?.playerId,
          nonStrikerLine?.playerId,
        ]}
        selectedId={nonStrikerLine?.playerId}
        onPick={(id) => {
          const striker = strikerLine?.playerId;
          if (String(id) === String(striker)) {
            setBanner({ tone: 'error', text: t('scoring.sameBatterTwice') });
            return;
          }
          applyPlayers({ strikerId: striker, nonStrikerId: id });
        }}
        onClose={() => setPicker(null)}
      />

      <PlayerPickerSheet
        open={picker === 'bowler'}
        title={t('scoring.chooseBowler')}
        players={availableBowlers}
        unavailable={[bowlerLine?.playerId]}
        selectedId={bowlerLine?.playerId}
        onPick={(id) => applyPlayers({ bowlerId: id })}
        onClose={() => setPicker(null)}
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

/** Reshape a playing squad into what WicketSheet expects. */
function formSquadFor(match, teamId) {
  const squad = match?.playingSquads?.find((entry) => String(entry.teamId) === String(teamId));
  return { playerIds: squad?.playerIds ?? [] };
}

/** One labelled slot: striker, non-striker or bowler. Tap to change. */
function PlayerSlot({ label, name, tone, detail, onClick, actionLabel }) {
  const toneClass =
    tone === 'brand'
      ? 'border-brand/40 bg-brand/5'
      : tone === 'gold'
        ? 'border-gold/40 bg-gold/5'
        : 'border-surface-border bg-surface-raised';

  const content = (
    <>
      <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-content-primary">{name || '—'}</p>
      {detail && <p className="tabular mt-0.5 text-xs text-content-secondary">{detail}</p>}
      {onClick && (
        <p className="mt-1 text-2xs font-semibold text-brand-light">
          {name ? `${actionLabel} ▾` : `+ ${actionLabel}`}
        </p>
      )}
    </>
  );

  if (!onClick) {
    return <div className={cn('rounded-xl border p-3', toneClass)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-xl border p-3 text-left transition hover:brightness-110', toneClass)}
    >
      {content}
    </button>
  );
}
