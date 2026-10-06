import api from "../config/axios.js";

/** Standings API. */
export const pointsService = {
  /**
   * Standings for a season, already sorted and numbered by the server.
   *
   * Never re-sort the result on the client: the points tiebreak decides who reaches
   * the final, and a second implementation of that rule would eventually disagree
   * with the scorer's.
   *
   * @param {{ season?: string }} [options]
   */
  get: async ({ season } = {}) => {
    const { data } = await api.get("/points-table", { params: { season } });
    return data.data;
  },
};

export default pointsService;
