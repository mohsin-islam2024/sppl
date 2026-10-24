import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import adminContentService from "../services/adminContentService.js";

/**
 * Admin content hooks (news, gallery, sponsors, awards, announcements).
 *
 * Every write invalidates the admin list AND the public cache for the same
 * resource. The public hooks use the resource name as the first key segment
 * (["news", ...], ["gallery", ...]), so invalidating `[resource]` refreshes the
 * public pages as well — otherwise an admin saves an announcement and the ticker
 * keeps showing the old one until its refetch interval fires.
 */

export const adminContentKeys = {
  list: (resource, season) => ["admin", "content", resource, season ?? null],
};

export function useAdminContentList(resource, season) {
  return useQuery({
    queryKey: adminContentKeys.list(resource, season),
    queryFn: () => adminContentService[resource].list({ season }),
    enabled: Boolean(season),
    staleTime: 60 * 1000,
  });
}

export function useContentMutations(resource) {
  const queryClient = useQueryClient();
  const service = adminContentService[resource];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "content", resource] });
    queryClient.invalidateQueries({ queryKey: [resource] });
  };

  const create = useMutation({ mutationFn: service.create, onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, payload }) => service.update(id, payload),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: service.remove, onSuccess: refresh });

  return { create, update, remove };
}
