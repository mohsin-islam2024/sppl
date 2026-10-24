import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScoringSquad, useSubstitutePlayer } from '../../hooks/useScoring.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Replace a player who cannot continue (injured or unwell) with another player of
 * the same team, in the middle of a match.
 *
 * Three short steps, each a single tap, because the scorer is doing this at the
 * ground with the match waiting: which team, who is leaving, who comes in. A final
 * line spells out what will happen before anything is sent.
 *
 * The rules are enforced on the server. This sheet only offers choices that can work:
 * the team's playing squad for the player leaving, and the team's other registered
 * players, minus anyone already replaced, for the player coming in.
 */

const idOf = (player) => String(player?.id ?? player?._id ?? '');
const nameOf = (player) => player?.jerseyName || player?.fullName || '';

function PlayerRow({ player, note, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-3 py-3 text-left transition hover:bg-surface-sunken"
      >
        <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-sunken text-xs font-bold text-content-muted">
          {toBengaliDigits(player.jerseyNo)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary">
          {nameOf(player)}
        </span>
        {note && <span className="shrink-0 text-2xs font-semibold text-gold-dark">{note}</span>}
      </button>
    </li>
  );
}

export default function ReplacePlayerSheet({
  open,
  onClose,
  matchId,
  match,
  strikerId,
  nonStrikerId,
  bowlerId,
  substitutions = [],
  onDone,
}) {
  const { t } = useTranslation();
  const substitute = useSubstitutePlayer(matchId);

  const [teamId, setTeamId] = useState('');
  const [outPlayer, setOutPlayer] = useState(null);
  const [inPlayer, setInPlayer] = useState(null);
  const [error, setError] = useState('');

  // Every time the sheet opens it starts from the first step, so a half-finished
  // attempt from earlier is not waiting for the next person to open it.
  useEffect(() => {
    if (open) {
      setTeamId('');
      setOutPlayer(null);
      setInPlayer(null);
      setError('');
    }
  }, [open]);

  const bench = useScoringSquad(matchId, teamId);

  if (!open) return null;

  const teams = [
    { id: String(match?.teamAId?._id ?? match?.teamAId?.id ?? match?.teamAId ?? ''), team: match?.teamAId ?? match?.teamA },
    { id: String(match?.teamBId?._id ?? match?.teamBId?.id ?? match?.teamBId ?? ''), team: match?.teamBId ?? match?.teamB },
  ].filter((entry) => entry.id);

  const squad =
    match?.playingSquads?.find((entry) => String(entry.teamId) === String(teamId))?.playerIds ?? [];

  const playingIds = new Set(
    (match?.playingSquads ?? []).flatMap((entry) => entry.playerIds.map(idOf)),
  );
  const replacedIds = new Set(substitutions.map((entry) => idOf(entry.out)));
  const candidates = (bench.data?.players ?? []).filter(
    (player) => !playingIds.has(idOf(player)) && !replacedIds.has(idOf(player)),
  );

  const statusNote = (player) => {
    const id = idOf(player);
    if (id === String(strikerId) || id === String(nonStrikerId)) return t('scoring.replaceAtCrease');
    if (id === String(bowlerId)) return t('scoring.replaceBowling');
    return '';
  };

  const step = !teamId ? 1 : !outPlayer ? 2 : !inPlayer ? 3 : 4;

  const submit = async () => {
    setError('');
    try {
      const result = await substitute.mutateAsync({
        teamId,
        outPlayerId: idOf(outPlayer),
        inPlayerId: idOf(inPlayer),
      });
      onDone?.({
        ...result,
        wasStriker: idOf(outPlayer) === String(strikerId),
      });
    } catch (err) {
      setError(err?.message ?? t('scoring.replaceFailed'));
    }
  };

  const back = () => {
    setError('');
    if (inPlayer) setInPlayer(null);
    else if (outPlayer) setOutPlayer(null);
    else setTeamId('');
  };

  const title =
    step === 1
      ? t('scoring.replaceChooseTeam')
      : step === 2
        ? t('scoring.replaceChoosePlayer')
        : step === 3
          ? t('scoring.replaceChooseIn')
          : t('scoring.replacePlayer');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('scoring.replacePlayer')}
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/70 sm:items-center"
    >
      <button type="button" aria-label={t('common.close')} onClick={onClose} className="absolute inset-0" />

      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-raised p-4 sm:rounded-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-content-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition hover:bg-surface-sunken"
          >
            ✕
          </button>
        </div>

        {step === 1 && <p className="mt-1 text-xs text-content-muted">{t('scoring.replacePlayerHelp')}</p>}

        {step === 1 && (
          <ul className="mt-4 space-y-1.5">
            {teams.map(({ id, team }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTeamId(id)}
                  className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-3 text-left text-sm font-semibold text-content-primary transition hover:bg-surface-sunken"
                >
                  {team?.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {step === 2 && (
          <ul className="mt-4 space-y-1.5">
            {squad.map((player) => (
              <PlayerRow
                key={idOf(player)}
                player={player}
                note={statusNote(player)}
                onClick={() => setOutPlayer(player)}
              />
            ))}
          </ul>
        )}

        {step === 3 &&
          (bench.isLoading ? (
            <p className="mt-4 text-sm text-content-muted">{t('common.loading')}</p>
          ) : candidates.length === 0 ? (
            <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-3 text-sm text-content-secondary">
              {t('scoring.replaceNoBench')}
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {candidates.map((player) => (
                <PlayerRow key={idOf(player)} player={player} onClick={() => setInPlayer(player)} />
              ))}
            </ul>
          ))}

        {step === 4 && (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg bg-brand/10 px-3.5 py-3 text-sm font-semibold text-brand-light">
              {t('scoring.replaceConfirm', { out: nameOf(outPlayer), in: nameOf(inPlayer) })}
            </p>
            {statusNote(outPlayer) && (
              <p className="text-xs text-content-muted">
                {statusNote(outPlayer) === t('scoring.replaceAtCrease')
                  ? t('scoring.replaceAtCreaseHelp')
                  : t('scoring.replaceBowlingHelp')}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={substitute.isPending}
              className="w-full rounded-pill bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {substitute.isPending ? t('common.loading') : t('scoring.replaceSubmit')}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-live/10 px-3 py-2 text-xs font-semibold text-live-light">
            {error}
          </p>
        )}

        {step > 1 && (
          <button
            type="button"
            onClick={back}
            className="mt-4 text-xs font-semibold text-brand-light hover:underline"
          >
            ← {t('scoring.replaceBack')}
          </button>
        )}
      </div>
    </div>
  );
}
