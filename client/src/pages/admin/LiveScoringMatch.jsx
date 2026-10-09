import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import MatchStatusBadge from '../../components/cricket/MatchStatusBadge.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import StartMatchForm from '../../components/admin/StartMatchForm.jsx';
import WicketSheet from '../../components/admin/WicketSheet.jsx';
import ExtraRunSheet from '../../components/admin/ExtraRunSheet.jsx';
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
 * A wicket opens a second step: the dismissal sheet, then the incoming batter.
 *
 * An extra opens its OWN dialog, because a wide and a no-ball each carry runs on top
 * of their base value, and the two differ: a wide's extras are byes and never reach
 * the batter, a no-ball's runs off the bat do.
 *
 * The delivery payload names the three players involved. The ball record is
 * append-only and has to stand on its own, so the crease slots — which this console
 * already knows — travel with every ball.
 */
export default function LiveScoringMatch() {
  const { t } = useTranslation();
  const { matchId } = useParams();

  const { data, isLoading, isError, error, refetch } = useScoringContext(matchId);

  const [wicketOpen, setWicketOpen] = useState(false);
  const [extraSheet, setExtraSheet] = useState(null);
  const [picker, setPicker] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [banner, setBanner] = useState(null);

  const recordBall = useRecordBall(matchId);
  const undoBall = useUndoBall(matchId);
  const startMatch = useStartMatch(matchId);
  const setPlayers = useSetPlayers(matchId);
  const endInnings = useEndInnings(matchId);

  const match = data?.match ?? null;
  const innings = data?.currentInnings ?? null;
  const strikerLine = data?.striker ?? null;
  const nonStrikerLine = data?.nonStriker ?? null;
  const bowlerLine = data?.bowler ?? null;

  const recentBalls = useMemo(
    () => match?.innings?.[match.currentInnings]?.recentBalls ?? [],
    [match],
  );

  const canScore =
    match?.status === 'LIVE' &&
    !innings?.isComplete &&
    Boolean(strikerLine) &&
    Boolean(bowlerLine);

  const availableBatters = useMemo(() => {
    const squad = match?.playingSquads?.find(
      (entry) => String(entry.teamId) === String(innings?.battingTeamId),
    );
    const lines = innings?.batting ?? [];
    return (squad?.playerIds ?? []).filter(
      (player) =>
        !lines.find(
          (line) => String(line.playerId) === String(player.id ?? player._id),
        )?.hasBatted,
    );
  }, [match, innings]);

  /**
   * Record one delivery.
   *
   * The three crease slots are filled in here rather than by each caller, so a run
   * button, the extra sheet and the wicket sheet all produce the same complete
   * payload without repeating themselves.
   */
  const sendBall = async (spec) => {
    setBanner(null);

    const batterId = strikerLine?.playerId;
    const nonStrikerId = nonStrikerLine?.playerId;
    const bowlerId = bowlerLine?.playerId;

    if (!batterId || !nonStrikerId || !bowlerId) {
      setBanner({ tone: 'error', text: t('scoring.creaseIncomplete') });
      return;
    }

    try {
      await recordBall.mutateAsync({
        matchId,
        innings: match?.currentInnings ?? 0,
        batterId,
        nonStrikerId,
        bowlerId,
        // The striker faces the ball, so the striker is who is out unless the sheet
        // named someone else — a run out can dismiss the non-striker.
        dismissedPlayerId: spec.dismissedPlayerId ?? batterId,
        ...spec,
      });
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? t('scoring.recordFailed') });
    }
  };

  const onUndo = async () => {
    setBanner(null);
    try {
      await undoBall.mutateAsync({ innings: match?.currentInnings });
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? t('scoring.undoFailed') });
    }
  };

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="card p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-surface-sunken" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-page py-16">
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container-page py-16">
        <ErrorState message={t('scoring.matchNotFound')} onRetry={refetch} />
      </div>
    );
  }

  // A match with no innings yet is one that has not started. A LIVE match with no
  // innings is a different problem — the state is inconsistent, and sending the
  // scorer back to the start form (which the server then rejects) would loop.
  if (!innings) {
    if (match.status === 'LIVE') {
      return (
        <div className="container-page py-10">
          <SEO title={t('scoring.title')} path={`/admin/live-scoring/${matchId}`} />
          <ErrorState
            message={t('scoring.inningsMissing')}
            onRetry={refetch}
          />
        </div>
      );
    }

    return (
      <div className="container-page py-10">
        <SEO title={t('scoring.title')} path={`/admin/live-scoring/${matchId}`} />

        {banner && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-live/10 px-3 py-2 text-xs font-semibold text-live-light"
          >
            {banner.text}
          </div>
        )}

        <StartMatchForm
          match={match}
          onStart={{
            isPending: startMatch.isPending,
            mutate: (payload, options) => {
              setBanner(null);
              return startMatch.mutate(payload, {
                ...options,
                onError: (err) => {
                  setBanner({
                    tone: 'error',
                    text: err?.message ?? t('scoring.startFailed'),
                  });
                  options?.onError?.(err);
                },
              });
            },
            mutateAsync: (payload, options) => {
              setBanner(null);
              return startMatch.mutateAsync(payload, options).catch((err) => {
                setBanner({
                  tone: 'error',
                  text: err?.message ?? t('scoring.startFailed'),
                });
                throw err;
              });
            },
          }}
        />
      </div>
    );
  }

  return (
    <>
      <SEO title={t('scoring.title')} path={`/admin/live-scoring/${matchId}`} />

      <div className="pb-56">
        {/* Header */}
        <header className="card mb-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-content-primary">
                {match.teamAId?.name ?? match.teamA?.name ?? '—'} {t('match.vs')}{' '}
                {match.teamBId?.name ?? match.teamB?.name ?? '—'}
              </p>
              <p className="mt-0.5 text-xs text-content-muted">{match.venue}</p>
            </div>
            <MatchStatusBadge status={match.status} />
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="tabular font-display text-3xl font-extrabold text-content-primary">
                {toBengaliDigits(innings.runs)}/{toBengaliDigits(innings.wickets)}
              </p>
              <p className="tabular mt-1 text-sm text-content-secondary">
                {formatOvers(innings.balls)} {t('scoring.overs')}
                {innings.target
                  ? ` · ${t('scoring.target')} ${toBengaliDigits(innings.target)}`
                  : ''}
              </p>
            </div>

            {match.freeHitPending && (
              <span className="badge bg-gold/20 text-gold-dark">{t('scoring.freeHit')}</span>
            )}
          </div>
        </header>

        {/* The three crease slots */}
        <div className="grid gap-3 sm:grid-cols-3">
          <CreaseCard
            label={t('scoring.striker')}
            name={strikerLine?.player?.jerseyName || strikerLine?.player?.fullName}
            detail={creaseDetail(strikerLine)}
            onClick={() => setPicker('striker')}
          />
          <CreaseCard
            label={t('scoring.nonStriker')}
            name={nonStrikerLine?.player?.jerseyName || nonStrikerLine?.player?.fullName}
            detail={creaseDetail(nonStrikerLine)}
            onClick={() => setPicker('nonStriker')}
          />
          <CreaseCard
            label={t('scoring.bowler')}
            name={bowlerLine?.player?.jerseyName || bowlerLine?.player?.fullName}
            detail={bowlerDetail(bowlerLine)}
            onClick={() => setPicker('bowler')}
          />
        </div>

        {/* Recent balls */}
        {recentBalls.length > 0 && (
          <section className="mt-4 card p-4">
            <h2 className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
              {t('match.ballByBall')}
            </h2>
            <div className="mt-3 space-y-1.5">
              {recentBalls
                .slice(-8)
                .reverse()
                .map((ball) => (
                  <div
                    key={ball.sequence}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="tabular shrink-0 font-semibold text-content-secondary">
                      {toBengaliDigits(ball.displayOver)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-content-secondary">
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
                {recentBalls.length
                  ? `${toBengaliDigits(recentBalls[recentBalls.length - 1].displayOver)} — ${
                      recentBalls[recentBalls.length - 1].commentaryBn ||
                      recentBalls[recentBalls.length - 1].commentaryEn
                    }`
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

            {/* Runs off the bat */}
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

            {/* Extras and the wicket */}
            <div className="mt-2 grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => setExtraSheet('WIDE')}
                className="rounded-xl bg-surface-raised py-3 text-sm font-bold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
              >
                {t('scoring.wide')}
              </button>
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => setExtraSheet('NO_BALL')}
                className="rounded-xl bg-surface-raised py-3 text-sm font-bold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
              >
                {t('scoring.noBall')}
              </button>
              <button
                type="button"
                disabled={!canScore || recordBall.isPending}
                onClick={() => setExtraSheet('BYE')}

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

            {banner && (
              <div
                role="alert"
                className={cn(
                  'mt-2 rounded-lg px-3 py-2 text-xs font-semibold',
                  banner.tone === 'error'
                    ? 'bg-live/10 text-live-light'
                    : 'bg-win/10 text-win',
                )}
              >
                {banner.text}
              </div>
            )}

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

      {/* Wicket */}
      <WicketSheet
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        freeHit={Boolean(match.freeHitPending)}
        battingSquad={formSquadFor(match, innings?.battingTeamId)}
        bowlingSquad={formSquadFor(match, innings?.bowlingTeamId)}
        onConfirm={async (spec) => {
          setWicketOpen(false);
          await sendBall(spec);
          setPicker('striker');
        }}
      />

      {/* Extra runs */}
      <ExtraRunSheet
        open={Boolean(extraSheet)}
        kind={extraSheet}
        onClose={() => setExtraSheet(null)}
        onConfirm={async ({ extraType, runsBat, runsBye }) => {
          setExtraSheet(null);
          await sendBall({ extraType, runsBat, runsBye });
        }}
      />

      {/* Player pickers */}
      <PlayerPickerSheet
        open={picker === 'striker'}
        title={t('scoring.chooseStriker')}
        players={availableBatters}
        unavailable={[nonStrikerLine?.playerId, strikerLine?.playerId]}
        selectedId={strikerLine?.playerId}
        onPick={(id) => {
          const other = nonStrikerLine?.playerId;
          if (String(id) === String(other)) {
            setBanner({ tone: 'error', text: t('scoring.sameBatterTwice') });
            return;
          }
          setPlayers.mutate({ strikerId: id });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      <PlayerPickerSheet
        open={picker === 'nonStriker'}
        title={t('scoring.chooseNonStriker')}
        players={availableBatters}
        unavailable={[strikerLine?.playerId, nonStrikerLine?.playerId]}
        selectedId={nonStrikerLine?.playerId}
        onPick={(id) => {
          if (String(id) === String(strikerLine?.playerId)) {
            setBanner({ tone: 'error', text: t('scoring.sameBatterTwice') });
            return;
          }
          setPlayers.mutate({ nonStrikerId: id });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      <PlayerPickerSheet
        open={picker === 'bowler'}
        title={t('scoring.chooseBowler')}
        players={formSquadFor(match, innings?.bowlingTeamId)?.playerIds ?? []}
        unavailable={[bowlerLine?.playerId]}
        selectedId={bowlerLine?.playerId}
        onPick={(id) => {
          setPlayers.mutate({ bowlerId: id });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      <ConfirmDialog
        open={confirmEnd}
        title={t('scoring.endInningsTitle')}
        message={t('scoring.endInningsConfirm')}
        confirmLabel={t('scoring.endInnings')}
        onConfirm={async () => {
          setConfirmEnd(false);
          try {
            await endInnings.mutateAsync({});
          } catch (err) {
            setBanner({ tone: 'error', text: err?.message ?? t('scoring.endInningsFailed') });
          }
        }}
        onClose={() => setConfirmEnd(false)}
      />
    </>
  );
}

/** Reshape a playing squad into what the pickers expect. */
function formSquadFor(match, teamId) {
  const squad = match?.playingSquads?.find(
    (entry) => String(entry.teamId) === String(teamId),
  );
  return { playerIds: squad?.playerIds ?? [] };
}

/** A batter's line at the crease: runs and balls faced. */
function creaseDetail(line) {
  if (!line) return '';
  return `${toBengaliDigits(line.runs ?? 0)} (${toBengaliDigits(line.balls ?? 0)})`;
}

/** A bowler's figure: overs-maidens-runs-wickets. */
function bowlerDetail(line) {
  if (!line) return '';
  return `${formatOvers(line.balls ?? 0)}-${toBengaliDigits(
    line.maidens ?? 0,
  )}-${toBengaliDigits(line.runs ?? 0)}-${toBengaliDigits(line.wickets ?? 0)}`;
}

/** One tappable crease slot. */
function CreaseCard({ label, name, detail, onClick }) {
  const content = (
    <>
      <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-content-primary">{name || '—'}</p>
      {detail && (
        <p className="tabular mt-0.5 text-xs text-content-secondary">{detail}</p>
      )}
      {onClick && (
        <span className="mt-1 inline-block text-2xs font-semibold text-brand-light">
          Change
        </span>
      )}
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="card p-4 text-left transition hover:border-brand/40"
    >
      {content}
    </button>
  ) : (
    <div className="card p-4">{content}</div>
  );
}
