import api from "../config/axios.js";

/** Match API. */
export const matchService = {
  /**
   * @param {{ season?: string, status?: string, stage?: string, team?: string, limit?: number }} params
   */
  list: async (params = {}) => {
    const { data } = await api.get("/matches", { params });
    return data.data;
  },

  /**
   * The match being played, or `null`.
   *
   * Returns null rather than throwing when nothing is live — "no match right now"
   * is the normal state for most of the year and must not surface as an error.
   */
  live: async ({ season } = {}) => {
    const { data } = await api.get("/matches/live", { params: { season } });
    return data.data ?? null;
  },

  get: async (id) => {
    const { data } = await api.get(`/matches/${id}`);
    return data.data;
  },

  scorecard: async (id) => {
    const { data } = await api.get(`/matches/${id}/scorecard`);
    return data.data;
  },

  /**
   * Ball-by-ball feed, newest first.
   * @param {string} id
   * @param {{ innings?: number, limit?: number, before?: number }} [options]
   */
  balls: async (id, { innings, limit = 30, before } = {}) => {
    const { data } = await api.get(`/matches/${id}/balls`, {
      params: { innings, limit, before },
    });
    return data.data;
  },
};

export default matchService;
