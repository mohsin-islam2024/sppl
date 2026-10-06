import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import matchService from "../services/matchService.js";
import { useMatchSocket } from "../config/socket.js";
import { SERVER_EVENTS } from "@sppl/shared/constants/socket.js";

/** Match query keys. */
export const matchKeys = {
  all: ["matches"],
  list: (filters) => ["matches", "list", filters ?? {}],
  live: (season) => ["matches", "live", season ?? "current"],
  detail: (id) => ["matches", "detail", id],
  scorecard: (id) => ["matches", "scorecard", id],
  balls: (id, innings) => ["matches", "balls", id, innings ?? "current"],
};

export function useMatches(filters = {}) {
  return useQuery({
    queryKey: matchKeys.list(filters),
    queryFn: () => matchService.list(filters),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * The live match, or null.
 *
 * Polls every 30 seconds as a safety net. The socket is the primary channel, but a
 * phone that slept through a change misses the broadcast, and polling is what makes
 * the score correct again when it wakes up.
 */
export function useLiveMatch({ season, enabled = true } = {}) {
  return useQuery({
    queryKey: matchKeys.live(season),
    queryFn: () => matchService.live({ season }),
    enabled,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useMatch(id) {
  return useQuery({
    queryKey: matchKeys.detail(id),
    queryFn: () => matchService.get(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useScorecard(id) {
  return useQuery({
    queryKey: matchKeys.scorecard(id),
    queryFn: () => matchService.scorecard(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Ball-by-ball feed for one innings.
 */
export function useBallByBall(id, { innings, limit = 30 } = {}) {
  return useQuery({
    queryKey: matchKeys.balls(id, innings),
    queryFn: () => matchService.balls(id, { innings, limit }),
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });
}

/**
 * Subscribe a match page to live updates.
 *
 * Three things happen on a new delivery:
 *   - the commentary list is PREPENDED from the event payload, so a new ball
 *     appears instantly without a refetch
 *   - the match detail and scorecard are INVALIDATED, because recomputing a
 *     scorecard from one ball client-side would duplicate the scoring engine
 *   - the match list is invalidated so fixtures show the new status
 */
export function useMatchRealtime(matchId) {
  const queryClient = useQueryClient();
  const { socket, connected } = useMatchSocket(matchId);

  useEffect(() => {
    if (!socket || !matchId) return undefined;

    const onBall = (payload) => {
      // Insert the delivery into the cached feed rather than refetching it. Twenty
      // balls a minute during a scoring burst is a lot of round trips otherwise.
      queryClient.setQueriesData(
        { queryKey: ["matches", "balls", matchId] },
        (previous) => {
          if (!previous?.items) return previous;
          const entry = payload.commentary
            ? { ...payload.commentary, sequence: payload.ball?.sequence }
            : null;
          if (!entry) return previous;
          // Guard against a duplicate: a reconnect can replay the last delivery.
          if (previous.items.some((item) => item.sequence === entry.sequence))
            return previous;
          return { ...previous, items: [entry, ...previous.items] };
        },
      );

      queryClient.invalidateQueries({
        queryKey: ["matches", "detail", matchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["matches", "scorecard", matchId],
      });
      queryClient.invalidateQueries({ queryKey: ["matches", "list"] });
    };

    const onUndo = () => {
      // An undo changes the past, so the feed cannot be patched — refetch it.
      queryClient.invalidateQueries({
        queryKey: ["matches", "balls", matchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["matches", "detail", matchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["matches", "scorecard", matchId],
      });
    };

    const onStatus = () => {
      queryClient.invalidateQueries({
        queryKey: ["matches", "detail", matchId],
      });
      queryClient.invalidateQueries({ queryKey: ["matches", "live"] });
    };

    const onCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      queryClient.invalidateQueries({ queryKey: ["points-table"] });
    };

    socket.on(SERVER_EVENTS.MATCH_BALL, onBall);
    socket.on(SERVER_EVENTS.MATCH_UNDO, onUndo);
    socket.on(SERVER_EVENTS.MATCH_STATUS, onStatus);
    socket.on(SERVER_EVENTS.MATCH_COMPLETED, onCompleted);

    return () => {
      socket.off(SERVER_EVENTS.MATCH_BALL, onBall);
      socket.off(SERVER_EVENTS.MATCH_UNDO, onUndo);
      socket.off(SERVER_EVENTS.MATCH_STATUS, onStatus);
      socket.off(SERVER_EVENTS.MATCH_COMPLETED, onCompleted);
    };
  }, [socket, matchId, queryClient]);

  return { connected };
}

export default useMatches;
