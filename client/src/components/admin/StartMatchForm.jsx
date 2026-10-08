import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import adminService from '../../services/adminService.js';
import { toBengaliDigits } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

/**
 * Choose the two playing nines, who bats first, and who opens.
 *
 * The roster comes from a separate query rather than from `match.teamAId.players`,
 * because a populated team carries only its name, crest and colour — not its squad.
 * Reading `team.players` returned undefined and the form told the scorer no players
 * existed, which is why a match could not be started at all.
 *
 * The opening pair and first bowler are chosen HERE rather than on the scoring
 * screen, because until they are set there is nothing to score.
 */
export default function StartMatchForm({ match, onStart, onDone }) {
  const { t } = useTranslation();

  const teams = useMemo(() => {
    const list = [];
    if (match.teamAId) list.push(match.teamAId);
    if (match.teamBId) list.push(match.teamBId);
    return list;
  }, [match]);

  /**
   * The season's teams and players in one call.
   *
   * `selectors` is the admin endpoint built for exactly this — every team and every
   * player of a season, keyed by team, ready for a form.
   */
  const selectorsQuery = useQuery({
    queryKey: ['admin', 'selectors', match.seasonId?.slug ?? match.seasonId],
    queryFn: () =>
      adminService.listSelectors({ season: match.seasonId?.slug ?? match.seasonId }),
    enabled: Boolean(match.seasonId),
    staleTime: 2 * 60 * 1000,
  });

  const rosterByTeam = useMemo(() => {
    const map = new Map();
    for (const player of selectorsQuery.data?.players ?? []) {
      const teamId = String(player.teamId?._id ?? player.teamId);
      if (!map.has(teamId)) map.set(teamId, []);
      map.get(teamId).push(player);
    }
    return map;
  }, [selectorsQuery.data]);

  const teamIdOf = (team) => team.id ?? team._id;

  const [battingTeamId, setBattingTeamId] = useState(teams[0]?.id ?? teams[0]?._id ?? '');
  const [squads, setSquads] = useState({});
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [error, setError] = useState(null);

  const rosterFor = (teamId) => rosterByTeam.get(String(teamId)) ?? [];
  const selectedFor = (teamId) => squads[teamId] ?? [];

  const togglePlayer = (teamId, playerId) => {
    setError(null);
    setSquads((previous) => {
      const current = previous[teamId] ?? [];
      const exists = current.includes(playerId);
      const next = exists ? current.filter((id) => id !== playerId) : [...current, playerId];
      return { ...previous, [teamId]: next };
    });

    // Leaving the nine can orphan a chosen opening player — clear it.
    if (strikerId === playerId) setStrikerId('');
    if (nonStrikerId === playerId) setNonStrikerId('');
    if (bowlerId === playerId) setBowlerId('');
  };

  const bowlingTeam = teams.find((team) => String(teamIdOf(team)) !== String(battingTeamId));
  const bowlingTeamKey = bowlingTeam ? teamIdOf(bowlingTeam) : '';

  /** The chosen nine of the batting side — the only players who may open. */
  const battingNine = rosterFor(battingTeamId).filter((player) =>
    selectedFor(battingTeamId).includes(player.id ?? player._id),
  );

  /** The chosen nine of the bowling side. */
  const bowlingNine = bowlingTeam
    ? rosterFor(bowlingTeamKey).filter((player) =>
        selectedFor(bowlingTeamKey).includes(player.id ?? player._id),
      )
    : [];

  const submit = async () => {
    setError(null);

    const payload = teams.map((team) => ({
      teamId: teamIdOf(team),
      playerIds: selectedFor(teamIdOf(team)),
    }));

    const short = payload.find((squad) => squad.playerIds.length !== 9);
    if (short) {
      setError(t('scoring.needNinePerSide'));
      return;
    }

    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError(t('scoring.needOpeningPlayers'));
      return;
    }

    try {
      await onStart.mutateAsync({
        playingSquads: payload,
        battingTeamId,
        strikerId,
        nonStrikerId,
        bowlerId,
      });
      onDone?.();
    } catch (err) {
      setError(err?.message ?? t('common.error'));
    }
  };

  const playerLabel = (player) => `#${player.jerseyNo} ${player.jerseyName || player.fullName}`;

  if (selectorsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card p-8 text-center text-sm text-content-muted">{t('common.loading')}</div>
      </div>
    );
  }

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
              const id = teamIdOf(team);
              const isChosen = String(battingTeamId) === String(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setBattingTeamId(id);
                    setStrikerId('');
                    setNonStrikerId('');
                    setBowlerId('');
                  }}
                  aria-pressed={isChosen}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm font-semibold transition',
                    isChosen
                      ? 'border-brand bg-brand/10 text-brand-light'
                      : 'border-surface-border bg-surface-raised text-content-secondary hover:bg-surface-sunken',
                  )}
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
            const id = teamIdOf(team);
            const roster = rosterFor(id);
            const chosen = selectedFor(id);

            return (
              <section key={id}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-content-primary">{team.name}</h2>
                  <span
                    className={cn(
                      'tabular text-xs font-semibold',
                      chosen.length === 9 ? 'text-win' : 'text-gold-dark',
                    )}
                  >
                    {t('scoring.selectedCount', { count: toBengaliDigits(chosen.length) })}
                  </span>
                </div>

                {roster.length === 0 ? (
                  <p className="mt-2 text-sm text-content-muted">{t('scoring.noRoster')}</p>
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
                          className={cn(
                            'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                            isChosen
                              ? 'border-brand bg-brand/10'
                              : 'border-surface-border bg-surface-raised hover:bg-surface-sunken',
                          )}
                        >
                          <span
                            className={cn(
                              'tabular flex h-7 w-7 shrink-0 items-center justify-center rounded text-2xs font-bold',
                              isChosen
                                ? 'bg-brand text-white'
                                : 'bg-surface-sunken text-content-muted',
                            )}
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

        {/* Opening pair and first bowler */}
        <fieldset className="mt-6 rounded-lg border border-surface-border p-4">
          <legend className="px-2 text-sm font-semibold text-content-secondary">
            {t('scoring.openingPlayers')}
          </legend>
          <p className="mt-1 text-2xs text-content-muted">{t('scoring.openingPlayersHint')}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-content-secondary">
                {t('scoring.striker')}
              </span>
              <select
                value={strikerId}
                onChange={(event) => setStrikerId(event.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">{t('admin.noneSelected')}</option>
                {battingNine.map((player) => {
                  const id = player.id ?? player._id;
                  if (String(id) === String(nonStrikerId)) return null;
                  return (
                    <option key={id} value={id}>
                      {playerLabel(player)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-content-secondary">
                {t('scoring.nonStriker')}
              </span>
              <select
                value={nonStrikerId}
                onChange={(event) => setNonStrikerId(event.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">{t('admin.noneSelected')}</option>
                {battingNine.map((player) => {
                  const id = player.id ?? player._id;
                  if (String(id) === String(strikerId)) return null;
                  return (
                    <option key={id} value={id}>
                      {playerLabel(player)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-content-secondary">
                {t('scoring.bowler')}
              </span>
              <select
                value={bowlerId}
                onChange={(event) => setBowlerId(event.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">{t('admin.noneSelected')}</option>
                {bowlingNine.map((player) => {
                  const id = player.id ?? player._id;
                  return (
                    <option key={id} value={id}>
                      {playerLabel(player)}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </fieldset>

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

      <p className="mt-4 text-center text-xs text-content-muted">{t('scoring.startMatchNote')}</p>
    </div>
  );
}
