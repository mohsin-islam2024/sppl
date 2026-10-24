import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ManagerShell from '../../components/admin/ManagerShell.jsx';
import { TextField, SelectField, CheckboxField } from '../../components/admin/Field.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useAdminSelectors, useAdminMatches } from '../../hooks/useAdmin.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Awards: the champion, the runner-up and the individual honours.
 *
 * A winner is a team, a player, or both. Picking a team narrows the player list to
 * that team's squad. The match field only matters for "Man of the match".
 *
 * Winners and the match are sent as `null` when left empty, so editing an award can
 * clear a winner instead of silently keeping the old one.
 */

const AWARD_TYPES = [
  'CHAMPION',
  'RUNNER_UP',
  'MAN_OF_THE_TOURNAMENT',
  'BEST_BATTER',
  'BEST_BOWLER',
  'BEST_FIELDER',
  'MAN_OF_THE_MATCH',
  'PARTICIPATION_MEDAL',
];

const schema = z.object({
  type: z.enum(AWARD_TYPES),
  winnerTeamId: z.string().optional(),
  winnerPlayerId: z.string().optional(),
  matchId: z.string().optional(),
  statValue: z.string().trim().max(100).optional(),
  noteBn: z.string().trim().max(300).optional(),
  noteEn: z.string().trim().max(300).optional(),
  isSquadWide: z.boolean().catch(false),
});

const EMPTY = {
  type: 'CHAMPION',
  winnerTeamId: '',
  winnerPlayerId: '',
  matchId: '',
  statValue: '',
  noteBn: '',
  noteEn: '',
  isSquadWide: false,
};

/** A populated reference carries `_id`; an unpopulated one is the id itself. */
const idOf = (ref) => (ref && typeof ref === 'object' ? ref._id ?? ref.id : ref) ?? '';

export default function AwardManager() {
  const { t } = useTranslation();
  const { identifier } = useActiveSeason();

  const selectors = useAdminSelectors(identifier).data;
  const matches = useAdminMatches(identifier).data ?? [];
  const teams = selectors?.teams ?? [];
  const players = selectors?.players ?? [];

  const typeLabel = {
    CHAMPION: t('awards.champion'),
    RUNNER_UP: t('awards.runnerUp'),
    MAN_OF_THE_TOURNAMENT: t('awards.manOfTheTournament'),
    BEST_BATTER: t('awards.bestBatter'),
    BEST_BOWLER: t('awards.bestBowler'),
    BEST_FIELDER: t('awards.bestFielder'),
    MAN_OF_THE_MATCH: t('awards.manOfTheMatch'),
    PARTICIPATION_MEDAL: t('awards.participationMedal'),
  };

  const playerName = (player) => player?.jerseyName || player?.fullName || '';

  const columns = [
    {
      key: 'type',
      label: t('admin.awardType'),
      render: (row) => <span className="font-medium text-content-primary">{typeLabel[row.type] ?? row.type}</span>,
    },
    {
      key: 'winner',
      label: t('admin.winner'),
      render: (row) => {
        const team = row.winnerTeamId?.name;
        const player = playerName(row.winnerPlayerId);
        return team || player ? [team, player].filter(Boolean).join(' · ') : '—';
      },
    },
    { key: 'statValue', label: t('admin.statValue'), align: 'center', render: (row) => row.statValue || '—' },
  ];

  return (
    <ManagerShell
      resource="awards"
      title={t('admin.awards')}
      description={t('admin.awardsHelp')}
      newLabel={t('admin.newAward')}
      emptyText={t('admin.noAwards')}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      rowName={(row) => typeLabel[row.type] ?? row.type}
      toFormValues={(row) => ({
        type: row.type ?? 'CHAMPION',
        winnerTeamId: idOf(row.winnerTeamId),
        winnerPlayerId: idOf(row.winnerPlayerId),
        matchId: idOf(row.matchId),
        statValue: row.statValue ?? '',
        noteBn: row.noteBn ?? '',
        noteEn: row.noteEn ?? '',
        isSquadWide: Boolean(row.isSquadWide),
      })}
      toPayload={(values) => ({
        type: values.type,
        winnerTeamId: values.winnerTeamId || null,
        winnerPlayerId: values.winnerPlayerId || null,
        matchId: values.type === 'MAN_OF_THE_MATCH' ? values.matchId || null : null,
        statValue: values.statValue ?? '',
        noteBn: values.noteBn ?? '',
        noteEn: values.noteEn ?? '',
        isSquadWide: values.isSquadWide,
      })}
      renderFields={({ register, errors, watch }) => {
        const selectedTeam = watch('winnerTeamId');
        const playerOptions = players
          .filter((player) => !selectedTeam || String(player.teamId) === String(selectedTeam))
          .map((player) => ({
            value: player._id ?? player.id,
            label: `#${toBengaliDigits(player.jerseyNo)} ${playerName(player)}`,
          }));

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                id="type"
                label={t('admin.awardType')}
                options={AWARD_TYPES.map((value) => ({ value, label: typeLabel[value] }))}
                error={errors.type?.message}
                {...register('type')}
              />
              <SelectField
                id="winnerTeamId"
                label={t('admin.winnerTeam')}
                placeholder={t('admin.noneSelected')}
                options={teams.map((team) => ({ value: team.id ?? team._id, label: team.name }))}
                {...register('winnerTeamId')}
              />
              <SelectField
                id="winnerPlayerId"
                label={t('admin.winnerPlayer')}
                placeholder={t('admin.noneSelected')}
                options={playerOptions}
                {...register('winnerPlayerId')}
              />
            </div>

            {watch('type') === 'MAN_OF_THE_MATCH' && (
              <SelectField
                id="matchId"
                label={t('admin.forMatch')}
                placeholder={t('admin.noneSelected')}
                options={matches.map((match) => ({
                  value: match._id ?? match.id,
                  label: `#${toBengaliDigits(match.matchNo)} ${match.teamAId?.shortName ?? ''} – ${match.teamBId?.shortName ?? ''}`,
                }))}
                {...register('matchId')}
              />
            )}

            <TextField
              id="statValue"
              label={t('admin.statValue')}
              hint={t('admin.statValueHint')}
              error={errors.statValue?.message}
              {...register('statValue')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="noteBn" label={t('admin.noteBn')} error={errors.noteBn?.message} {...register('noteBn')} />
              <TextField id="noteEn" label={t('admin.noteEn')} error={errors.noteEn?.message} {...register('noteEn')} />
            </div>
            <CheckboxField id="isSquadWide" label={t('admin.squadWide')} {...register('isSquadWide')} />
          </>
        );
      }}
    />
  );
}
