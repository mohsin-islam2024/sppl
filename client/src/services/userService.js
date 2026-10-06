import api from "../config/axios.js";

/**
 * Admin user management. Every endpoint here requires ADMIN or SUPER_ADMIN on the
 * server, so this module is never reachable from a public page.
 */
export const userService = {
  list: async ({ page = 1, limit = 20, role, search } = {}) => {
    const { data } = await api.get("/users", {
      params: { page, limit, role, search },
    });
    return { items: data.data, meta: data.meta };
  },

  get: async (id) => {
    const { data } = await api.get(`/users/${id}`);
    return data.data;
  },

  updateRole: async (id, role) => {
    const { data } = await api.patch(`/users/${id}/role`, { role });
    return data.data;
  },

  updateOwnProfile: async (payload) => {
    const { data } = await api.patch("/users/me", payload);
    return data.data;
  },

  deactivate: async (id) => {
    const { data } = await api.delete(`/users/${id}`);
    return data.data;
  },
};

export default userService;
