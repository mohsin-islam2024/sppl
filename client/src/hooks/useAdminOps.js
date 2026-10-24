import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import adminOpsService from "../services/adminOpsService.js";
import { pointsKeys } from "./usePointsTable.js";

/** Account list for the Users page. Search and role are applied by the server. */
export function useAdminUsers({ page, search, role }) {
  return useQuery({
    queryKey: ["admin", "users", { page, search, role }],
    queryFn: () => adminOpsService.users.list({ page, search, role }),
    // Keep the previous page on screen while the next loads, so paging and typing
    // in the search box do not flash the table empty on every keystroke.
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const setRole = useMutation({
    mutationFn: ({ id, role }) => adminOpsService.users.setRole(id, role),
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }) => adminOpsService.users.setActive(id, active),
    onSuccess: refresh,
  });

  return { setRole, setActive };
}

/** Record the super over of a tied match, then refresh everything the result touches. */
export function useRecordSuperOver(matchId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => adminOpsService.scoring.recordSuperOver(matchId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: pointsKeys.all });
      queryClient.invalidateQueries({ queryKey: ["awards"] });
    },
  });
}

/** Create the final from the top two teams of the finished league. */
export function useGenerateFinal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminOpsService.points.generateFinal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useRecalculatePoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminOpsService.points.recalculate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pointsKeys.all }),
  });
}
