import api from "../config/axios.js";

/** Team API. */
export const teamService = {
  /**
   * Teams in a season.
   * @param {object} [options]
   * @param {string} [options.season] season slug or id; omit for the current season
   * @param {boolean} [options.all]   span every season (archive views)
   */
  list: async ({ season, all } = {}) => {
    const { data } = await api.get("/teams", {
      params: { season, all: all ? "true" : undefined },
    });
    return data.data;
  },

  /** One team with its squad, standings row and match list. */
  get: async (slug, { season } = {}) => {
    const { data } = await api.get(`/teams/${slug}`, { params: { season } });
    return data.data;
  },

  players: async (slug, { page = 1, limit = 50 } = {}) => {
    const { data } = await api.get(`/teams/${slug}/players`, {
      params: { page, limit },
    });
    return { items: data.data, meta: data.meta };
  },
};

export default teamService;
