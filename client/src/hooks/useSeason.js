import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import seasonService from "../services/seasonService.js";
import { useSeasonSocket } from "../config/socket.js";
import { SERVER_EVENTS } from "@sppl/shared/constants/socket.js";

/**
 * Season data hooks.
 *
 * Query keys are centralised in one object so an invalidation can never target a
 * key that no query actually uses — the usual cause of "the points table did not
 * update" after a match.
 */
export const seasonKeys = {
  all: ["seasons"],
  list: () => ["seasons", "list"],
  current: () => ["seasons", "current"],
  detail: (identifier) => ["seasons", "detail", identifier],
  rules: (identifier) => ["seasons", "rules", identifier],
  summary: (identifier) => ["seasons", "summary", identifier],
  teams: (identifier) => ["seasons", "teams", identifier],
  fixtures: (identifier, filters) => [
    "seasons",
    "fixtures",
    identifier,
    filters ?? {},
  ],
};

/**
 * The active season for the whole app.
 *
 * `staleTime: Infinity` because which season is "current" only changes when an
 * admin changes it, and every page depends on this value.
 */
export function useCurrentSeason() {
  return useQuery({
    queryKey: seasonKeys.current(),
    queryFn: () => seasonService.current(),
    staleTime: Infinity,
    retry: 1,
  });
}

/** Every season, for the switcher. */
export function useSeasons() {
  return useQuery({
    queryKey: seasonKeys.list(),
    queryFn: () => seasonService.list(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSeason(identifier) {
  return useQuery({
    queryKey: seasonKeys.detail(identifier),
    queryFn: () => seasonService.get(identifier),
    enabled: Boolean(identifier),
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Rules and points system.
 *
 * Cached for a day: it is static text an admin edits once per season.
 */
export function useSeasonRules(identifier) {
  return useQuery({
    queryKey: seasonKeys.rules(identifier),
    queryFn: () => seasonService.rules(identifier),
    enabled: Boolean(identifier),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * The home page payload.
 */
export function useSeasonSummary(identifier) {
  return useQuery({
    queryKey: seasonKeys.summary(identifier),
    queryFn: () => seasonService.summary(identifier),
    enabled: Boolean(identifier),
    // Live scores are in the payload, so this is kept fresh rather than cached hard.
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Refetch season-scoped data when the server says something changed.
 *
 * @param {string|undefined} seasonId Mongo id of the season room to join
 */
export function useSeasonRealtime(seasonId) {
  const queryClient = useQueryClient();
  const { socket } = useSeasonSocket(seasonId);

  useEffect(() => {
    if (!socket) return undefined;

    const invalidateSeason = () => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.all });
    };

    socket.on(SERVER_EVENTS.POINTS_UPDATE, invalidateSeason);
    socket.on(SERVER_EVENTS.MATCH_COMPLETED, invalidateSeason);
    socket.on(SERVER_EVENTS.SEASON_UPDATE, invalidateSeason);

    return () => {
      socket.off(SERVER_EVENTS.POINTS_UPDATE, invalidateSeason);
      socket.off(SERVER_EVENTS.MATCH_COMPLETED, invalidateSeason);
      socket.off(SERVER_EVENTS.SEASON_UPDATE, invalidateSeason);
    };
  }, [socket, queryClient]);
}

export function useSeasonTeams(identifier) {
  return useQuery({
    queryKey: seasonKeys.teams(identifier),
    queryFn: () => seasonService.teams(identifier),
    enabled: Boolean(identifier),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fixtures, optionally filtered.
 */
export function useSeasonFixtures(identifier, filters = {}) {
  return useQuery({
    queryKey: seasonKeys.fixtures(identifier, filters),
    queryFn: () => seasonService.fixtures(identifier, filters),
    enabled: Boolean(identifier),
    staleTime: 2 * 60 * 1000,
  });
}

export default useCurrentSeason;
