import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import pointsService from "../services/pointsService.js";
import { useSeasonSocket } from "../config/socket.js";
import { SERVER_EVENTS } from "@sppl/shared/constants/socket.js";

/** Standings query key. */
export const pointsKeys = {
  all: ["points-table"],
  table: (season) => ["points-table", season ?? "current"],
};

/**
 * The points table for a season.
 *
 * The server returns it already sorted with positions assigned, and the client does
 * not re-sort it. With a four-team league the tiebreak decides who plays the final,
 * so there must be exactly one implementation of that rule.
 */
export function usePointsTable({ season, seasonId } = {}) {
  const queryClient = useQueryClient();
  const { socket } = useSeasonSocket(seasonId);

  const query = useQuery({
    queryKey: pointsKeys.table(season),
    queryFn: () => pointsService.get({ season }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!socket) return undefined;

    const onUpdate = (payload) => {
      // If the server pushed the recalculated rows for this season, use them
      // directly — it already computed them, and refetching would just ask again.
      if (
        payload?.seasonId &&
        seasonId &&
        String(payload.seasonId) !== String(seasonId)
      )
        return;

      if (Array.isArray(payload?.table) && payload.table.length) {
        queryClient.setQueryData(pointsKeys.table(season), (previous) => {
          if (!previous) return previous;
          return { ...previous, table: payload.table };
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: pointsKeys.all });
    };

    socket.on(SERVER_EVENTS.POINTS_UPDATE, onUpdate);
    socket.on(SERVER_EVENTS.MATCH_COMPLETED, onUpdate);

    return () => {
      socket.off(SERVER_EVENTS.POINTS_UPDATE, onUpdate);
      socket.off(SERVER_EVENTS.MATCH_COMPLETED, onUpdate);
    };
  }, [socket, seasonId, season, queryClient]);

  return query;
}

export default usePointsTable;
