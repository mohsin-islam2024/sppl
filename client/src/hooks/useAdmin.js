import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useEffect from "react";
import adminService from "../services/adminService.js";
import { seasonKeys } from "./useSeason.js";
import { pointsKeys } from "./usePointsTable.js";
import { matchKeys } from "./useMatches.js";

/**
 * Admin data hooks.
 *
 * Every write invalidates the public caches it could have changed. That is the whole
 * reason these live in one file: forgetting an invalidation is how an admin saves a
 * fixture and the public fixture list keeps showing the old one, and nobody notices
 * until someone complains.
 */

export const adminKeys = {
  all: ["admin"],
  seasons: () => ["admin", "seasons"],
  teams: (season) => ["admin", "teams", season],
  players: (season, team) => ["admin", "players", season, team ?? "all"],
  matches: (season) => ["admin", "matches", season],
  selectors: (season) => ["admin", "selectors", season],
};

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export function useAdminSeasons() {
  return useQuery({
    queryKey: adminKeys.seasons(),
    queryFn: () => adminService.listSeasons(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminTeams(season) {
  return useQuery({
    queryKey: adminKeys.teams(season),
    queryFn: () => adminService.listTeams({ season }),
    enabled: Boolean(season),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminPlayers({ season, team } = {}) {
  return useQuery({
    queryKey: adminKeys.players(season, team),
    queryFn: () => adminService.listPlayers({ season, team }),
    enabled: Boolean(season),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminMatches(season) {
  return useQuery({
    queryKey: adminKeys.matches(season),
    queryFn: () => adminService.listMatches({ season }),
    enabled: Boolean(season),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminSelectors(season) {
  return useQuery({
    queryKey: adminKeys.selectors(season),
    queryFn: () => adminService.listSelectors({ season }),
    enabled: Boolean(season),
    staleTime: 2 * 60 * 1000,
  });
}

/* ------------------------------------------------------------------ *
 * Write helper
 * ------------------------------------------------------------------ */

/**
 * Invalidate every cache a structural change could have touched.
 *
 * Deliberately broad: teams, players, matches and standings all feed the season
 * summary, the fixture lists and the points table, and working out the exact minimal
 * set per operation is a maintenance trap. An admin save is rare; a stale public
 * page is what people actually notice.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: seasonKeys.all });
    queryClient.invalidateQueries({ queryKey: matchKeys.all });
    queryClient.invalidateQueries({ queryKey: pointsKeys.all });
    queryClient.invalidateQueries({ queryKey: ["players"] });
    queryClient.invalidateQueries({ queryKey: ["team"] });
    queryClient.invalidateQueries({ queryKey: ["player"] });
  };
}

/* ------------------------------------------------------------------ *
 * Season
 * ------------------------------------------------------------------ */

export function useCreateSeason() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.createSeason,
    onSuccess: invalidate,
  });
}

export function useUpdateSeason() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }) => adminService.updateSeason(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteSeason() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.deleteSeason,
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------------ *
 * Team
 * ------------------------------------------------------------------ */

export function useCreateTeam() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.createTeam,
    onSuccess: invalidate,
  });
}

export function useUpdateTeam() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }) => adminService.updateTeam(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteTeam() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.deleteTeam,
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */

export function useCreatePlayer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.createPlayer,
    onSuccess: invalidate,
  });
}

export function useUpdatePlayer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }) => adminService.updatePlayer(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeletePlayer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.deletePlayer,
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------------ *
 * Match
 * ------------------------------------------------------------------ */

export function useCreateMatch() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.createMatch,
    onSuccess: invalidate,
  });
}

export function useUpdateMatch() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }) => adminService.updateMatch(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteMatch() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: adminService.deleteMatch,
    onSuccess: invalidate,
  });
}

export default useAdminSeasons;
