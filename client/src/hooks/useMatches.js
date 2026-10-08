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
 */
export function useMatchRealtime(matchId) {
  const queryClient = useQueryClient();
  const { socket, connected } = useMatchSocket(matchId);

  useEffect(() => {
    if (!socket || !matchId) return undefined;

    const onBall = (payload) => {
      queryClient.setQueriesData(
        { queryKey: ["matches", "balls", matchId] },
        (previous) => {
          if (!previous?.items) return previous;
          const entry = payload.commentary
            ? { ...payload.commentary, sequence: payload.ball?.sequence }
            : null;
          if (!entry) return previous;
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

/**
 * Subscribe the PUBLIC site to the season's live match.
 *
 * The socket server broadcasts each delivery to a MATCH room, not a season room. A
 * page that only joins the season room therefore receives points-table updates and
 * nothing else — which is why the score on the home page sat still until a reload.
 *
 * This joins the match room for whichever match is being played and invalidates the
 * caches the score appears in: the home summary, the fixture list and the match
 * itself.
 *
 * @param {string|null|undefined} liveMatchId the match currently being played
 */
export function usePublicLiveScore(liveMatchId) {
  const queryClient = useQueryClient();
  const { socket, connected } = useMatchSocket(liveMatchId);

  useEffect(() => {
    if (!socket || !liveMatchId) return undefined;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["matches", "live"] });
      queryClient.invalidateQueries({ queryKey: ["matches", "list"] });
      queryClient.invalidateQueries({
        queryKey: ["matches", "detail", liveMatchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["matches", "scorecard", liveMatchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["matches", "balls", liveMatchId],
      });
      queryClient.invalidateQueries({ queryKey: ["seasons", "summary"] });
    };

    const onCompleted = () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["points-table"] });
    };

    socket.on(SERVER_EVENTS.MATCH_BALL, refresh);
    socket.on(SERVER_EVENTS.MATCH_SCORE, refresh);
    socket.on(SERVER_EVENTS.MATCH_STATUS, refresh);
    socket.on(SERVER_EVENTS.MATCH_UNDO, refresh);
    socket.on(SERVER_EVENTS.MATCH_COMPLETED, onCompleted);

    return () => {
      socket.off(SERVER_EVENTS.MATCH_BALL, refresh);
      socket.off(SERVER_EVENTS.MATCH_SCORE, refresh);
      socket.off(SERVER_EVENTS.MATCH_STATUS, refresh);
      socket.off(SERVER_EVENTS.MATCH_UNDO, refresh);
      socket.off(SERVER_EVENTS.MATCH_COMPLETED, onCompleted);
    };
  }, [socket, liveMatchId, queryClient]);

  return { connected };
}

export default useMatches;
