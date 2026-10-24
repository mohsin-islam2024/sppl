import api from "../config/axios.js";

/**
 * Admin operations that are not plain create/edit/delete lists: user accounts and
 * the points table.
 */
export const adminOpsService = {
  users: {
    list: async ({ page = 1, limit = 20, search, role } = {}) => {
      const { data } = await api.get("/users", {
        params: { page, limit, search: search || undefined, role: role || undefined },
      });
      return { items: data.data, meta: data.meta };
    },
    setRole: async (id, role) => {
      const { data } = await api.patch(`/users/${id}/role`, { role });
      return data.data;
    },
    setActive: async (id, active) => {
      const { data } = await api.patch(`/users/${id}/active`, { active });
      return data.data;
    },
  },

  scoring: {
    recordSuperOver: async (matchId, payload) => {
      const { data } = await api.post(`/scoring/${matchId}/super-over`, payload);
      return data.data;
    },
  },

  points: {
    generateFinal: async (payload) => {
      const { data } = await api.post("/admin/matches/generate-final", payload);
      return data.data;
    },
    recalculate: async ({ season }) => {
      const { data } = await api.post("/admin/points/recalculate", null, {
        params: { season },
      });
      return data.data;
    },
  },
};

export default adminOpsService;
