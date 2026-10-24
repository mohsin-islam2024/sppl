import api from "../config/axios.js";

/** Player API. */
export const playerService = {
  /**
   * @param {{ season?: string, team?: string, role?: string, search?: string, page?: number, limit?: number }} params
   */
  list: async (params = {}) => {
    const { data } = await api.get("/players", { params });
    return { items: data.data, meta: data.meta };
  },

  /**
   * @param {string} id
   * @param {{ season?: string }} params  a season slug: show this person's record from that season
   */
  get: async (id, params = {}) => {
    const { data } = await api.get(`/players/${id}`, { params });
    return data.data;
  },

  stats: async (id) => {
    const { data } = await api.get(`/players/${id}/stats`);
    return data.data;
  },

  /** Two to four players, in the order supplied. */
  compare: async (ids) => {
    const { data } = await api.get("/players/compare", {
      params: { ids: ids.join(",") },
    });
    return data.data;
  },
};

export default playerService;
