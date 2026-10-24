import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../config/axios.js";

/**
 * Scoring hooks.
 *
 * Built directly on axios rather than a service module, because the scoring console
 * is the only consumer of these endpoints.
 *
 * The ball mutation does NOT diff the response into the cache by hand — it refetches
 * the context. The console reads a lot of derived state (who is at the crease, who is
 * bowling, the over count) and recomputing that on the client would duplicate the
 * scoring engine.
 */

export const scoringKeys = {
  matches: (season) => ["scoring", "matches", season ?? "all"],
  context: (matchId) => ["scoring", "context", matchId],
  squad: (matchId, teamId) => ["scoring", "squad", matchId, teamId],
};

/** Matches that can still be scored — upcoming, live or at the innings break. */
export function useScorableMatches(seasonId) {
  return useQuery({
    queryKey: scoringKeys.matches(seasonId),
    queryFn: async () => {
      const { data } = await api.get("/scoring/matches", {
        params: { season: seasonId },
      });
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Everything the console needs: the match, both squads, and who is at the crease.
 *
 * Polled every 45 seconds as a safety net — the scorer is the writer, but an admin
 * watching from a second device would otherwise see a stale score.
 */
export function useScoringContext(matchId) {
  return useQuery({
    queryKey: scoringKeys.context(matchId),
    queryFn: async () => {
      const { data } = await api.get(`/scoring/${matchId}`);
      return data.data;
    },
    enabled: Boolean(matchId),
    staleTime: 10 * 1000,
    refetchInterval: 45 * 1000,
  });
}

/** A team's full squad, so the console can offer substitutes. */
export function useScoringSquad(matchId, teamId) {
  return useQuery({
    queryKey: scoringKeys.squad(matchId, teamId),
    queryFn: async () => {
      const { data } = await api.get(`/scoring/${matchId}/squad/${teamId}`);
      return data.data;
    },
    enabled: Boolean(matchId && teamId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Record one delivery.
 *
 * `retry: false` on purpose: a retried ball that actually succeeded would be recorded
 * twice, and the duplicate-sequence guard would reject it with a confusing error.
 */
export function useRecordBall(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (delivery) => {
      const { data } = await api.post(`/scoring/${matchId}/ball`, delivery);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scoringKeys.context(matchId) });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    retry: false,
  });
}

/**
 * Set or change who is batting and bowling.
 *
 * Called three times over a match: when it starts, after a wicket to bring the next
 * batter in, and between overs for the next bowler. Any field may be omitted.
 */
export function useSetPlayers(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ strikerId, nonStrikerId, bowlerId }) => {
      const { data } = await api.post(`/scoring/${matchId}/players`, {
        strikerId,
        nonStrikerId,
        bowlerId,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scoringKeys.context(matchId) });
    },
    retry: false,
  });
}

/**
 * Replace a player who cannot continue with another player of the same team.
 *
 * `retry: false` for the same reason as a ball: a retried substitution that had
 * already gone through would be rejected ("already in a playing squad"), which reads
 * as a failure when the swap actually happened.
 *
 * onSuccess returns the refetch promise, so the mutation only resolves once the
 * console has the new squad. The caller opens the batter picker straight afterwards,
 * and that picker must already contain the player who just came in.
 */
export function useSubstitutePlayer(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change) => {
      const { data } = await api.post(`/scoring/${matchId}/substitute`, change);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      return queryClient.invalidateQueries({ queryKey: scoringKeys.context(matchId) });
    },
    retry: false,
  });
}

/** Remove the last delivery and rebuild the innings. */
export function useUndoBall(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    // The console passes { innings }, an older caller passed the bare number. Wrapping
    // an object a second time sent { innings: { innings: 0 } }, which the server could
    // not read as an innings: the "Invalid value for innings" the scorer saw.
    mutationFn: async (argument) => {
      const innings =
        argument !== null && typeof argument === 'object' ? argument.innings : argument;
      const { data } = await api.post(`/scoring/${matchId}/undo`, { innings });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scoringKeys.context(matchId) });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["points-table"] });
    },
    retry: false,
  });
}

/** Start the match: choose the two squads, who bats first, and the opening pair. */
export function useStartMatch(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playingSquads,
      battingTeamId,
      strikerId,
      nonStrikerId,
      bowlerId,
    }) => {
      const { data } = await api.post(`/scoring/${matchId}/start`, {
        playingSquads,
        battingTeamId,
        strikerId,
        nonStrikerId,
        bowlerId,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scoringKeys.context(matchId) });
      queryClient.invalidateQueries({ queryKey: ["scoring"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    retry: false,
  });
}

/** Declare the innings over early. */
export function useEndInnings(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason) => {
      const { data } = await api.post(`/scoring/${matchId}/end-innings`, {
        reason,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scoringKeys.context(matchId) });
    },
    retry: false,
  });
}

/** Correct the result by hand — an abandoned match, or a super over decided on the field. */
export function useSetResult(matchId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.patch(`/scoring/${matchId}/result`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoring"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["points-table"] });
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
    },
    retry: false,
  });
}
