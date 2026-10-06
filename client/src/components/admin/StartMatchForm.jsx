import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Choose the two playing nines and who bats first.
 *
 * This is the gate before any ball can be recorded, and it is the one screen where a
 * mistake is expensive to undo: once deliveries exist the playing squads are frozen.
 *
 * The rule sheet says nine players take the field, so exactly nine are required. The
 * wider squad is shown too, because the organizer's jersey sheet lists more names
 * than nine and the scorer needs to see who is available without leaving the page.
 */
export default function StartMatchForm({ match, onStart, onDone }) {
  const { t } = useTranslation();

  const teams = useMemo(() => {
    const list = [];
    if (match.teamAId) list.push(match.teamAId);
    if (match.teamBId) list.push(match.teamBId);
    return list;
  }, [match]);

  const [battingTeamId, setBattingTeamId] = useState(teams[0]?.id ?? teams[0]?._id ?? '');
  const [squads, setSquads] = useState({});
  const [error, setError] = useState(null);

  /**
   * Prefer the squad already stored on the match — an admin may have set it from the
   * fixture screen — and fall back to the team's full roster so the form opens with
   * something usable rather than empty.
   */
  const rosterFor = (teamId) => {
    const team = teams.find((entry) => String(entry.id ?? entry._id) === String(teamId));
    return team?.players ?? [];
  };

  const selectedFor = (teamId) => squads[teamId] ?? [];

  const togglePlayer = (teamId, playerId) => {
    setError(null);
    setSquads((previous) => {
      const current = previous[teamId] ?? [];
      const exists = current.includes(playerId);
      const next = exists ? current.filter((id) => id !== playerId) : [...current, playerId];
      return { ...previous, [teamId]: next };
    });
  };

  const submit = async () => {
    setError(null);

    const payload = teams.map((team) => ({
      teamId: team.id ?? team._id,
      playerIds: selectedFor(team.id ?? team._id),
    }));

    const short = payload.find((squad) => squad.playerIds.length !== 9);
    if (short) {
      setError(t('scoring.needNinePerSide'));
      return;
    }

    try {
      await onStart.mutateAsync({ playingSquads: payload, battingTeamId });
      onDone?.();
    } catch (err) {
      setError(err?.message ?? t('common.error'));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-5">
        <h1 className="font-display text-lg font-bold text-content-primary">
          {t('scoring.startMatchTitle')}
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          {match.teamAId?.name} vs {match.teamBId?.name}
        </p>

        {/* Who bats first */}
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-content-secondary">
            {t('scoring.whoBatsFirst')}
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {teams.map((team) => {
              const id = team.id ?? team._id;
              const isChosen = String(battingTeamId) === String(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBattingTeamId(id)}
                  aria-pressed={isChosen}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    isChosen
                      ? 'border-brand bg-brand/10 text-brand-light'
                      : 'border-surface-border bg-surface-raised text-content-secondary hover:bg-surface-sunken'
                  }`}
                >
                  {team.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-live/30 bg-live/10 px-3.5 py-3 text-sm text-live-light"
          >
            {error}
          </div>
        )}

        {/* Squads */}
        <div className="mt-6 space-y-6">
          {teams.map((team) => {
            const id = team.id ?? team._id;
            const roster = rosterFor(id);
            const chosen = selectedFor(id);

            return (
              <section key={id}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-content-primary">{team.name}</h2>
                  <span
                    className={`tabular text-xs font-semibold ${
                      chosen.length === 9 ? 'text-win' : 'text-gold-dark'
                    }`}
                  >
                    {t('scoring.selectedCount', {
                      count: toBengaliDigits(chosen.length),
                    })}
                  </span>
                </div>

                {roster.length === 0 ? (
                  <p className="mt-2 text-sm text-content-muted">
                    {t('scoring.noRoster')}
                  </p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {roster.map((player) => {
                      const playerId = player.id ?? player._id;
                      const isChosen = chosen.includes(playerId);
                      return (
                        <button
                          key={playerId}
                          type="button"
                          onClick={() => togglePlayer(id, playerId)}
                          aria-pressed={isChosen}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                            isChosen
                              ? 'border-brand bg-brand/10'
                              : 'border-surface-border bg-surface-raised hover:bg-surface-sunken'
                          }`}
                        >
                          <span
                            className={`tabular flex h-7 w-7 shrink-0 items-center justify-center rounded text-2xs font-bold ${
                              isChosen ? 'bg-brand text-white' : 'bg-surface-sunken text-content-muted'
                            }`}
                          >
                            {toBengaliDigits(player.jerseyNo)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">
                            {player.jerseyName || player.fullName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={onStart.isPending}
            className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {onStart.isPending ? t('common.loading') : t('scoring.startMatch')}
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-content-muted">
        {t('scoring.startMatchNote')}
      </p>
    </div>
  );
}
