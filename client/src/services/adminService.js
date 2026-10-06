import api from "../config/axios.js";

/**
 * Admin API.
 *
 * Every call here hits `/admin/*`, which is guarded server-side by
 * `requireRole(ADMIN, SUPER_ADMIN)`. The client never decides whether a request is
 * permitted — it only decides whether to show the button.
 *
 * `season` is passed as a slug or id; the server resolves either.
 */
export const adminService = {
  /* ------------------------------------------------------------------ *
   * Reads
   * ------------------------------------------------------------------ */

  /** Every season, including ones with no teams — the admin list is unfiltered. */
  listSeasons: async () => {
    const { data } = await api.get("/admin/seasons");
    return data.data;
  },

  listTeams: async ({ season }) => {
    const { data } = await api.get("/admin/teams", { params: { season } });
    return data.data;
  },

  listPlayers: async ({ season, team } = {}) => {
    const { data } = await api.get("/admin/players", {
      params: { season, team },
    });
    return data.data;
  },

  listMatches: async ({ season }) => {
    const { data } = await api.get("/admin/matches", { params: { season } });
    return data.data;
  },

  /**
   * The minimal team and player lists the admin forms need for their dropdowns.
   * One call instead of two, because every form needs both.
   */
  listSelectors: async ({ season }) => {
    const { data } = await api.get("/admin/selectors", { params: { season } });
    return data.data;
  },

  /* ------------------------------------------------------------------ *
   * Season
   * ------------------------------------------------------------------ */

  createSeason: async (payload) => {
    const { data } = await api.post("/admin/seasons", payload);
    return data.data;
  },

  updateSeason: async (id, payload) => {
    const { data } = await api.patch(`/admin/seasons/${id}`, payload);
    return data.data;
  },

  /** Deletes the season AND everything inside it. The UI confirms first. */
  deleteSeason: async (id) => {
    const { data } = await api.delete(`/admin/seasons/${id}`);
    return data.data;
  },

  /* ------------------------------------------------------------------ *
   * Team
   * ------------------------------------------------------------------ */

  createTeam: async (payload) => {
    const { data } = await api.post("/admin/teams", payload);
    return data.data;
  },

  updateTeam: async (id, payload) => {
    const { data } = await api.patch(`/admin/teams/${id}`, payload);
    return data.data;
  },

  /** Refuses when the team appears in a match — the error carries the count. */
  deleteTeam: async (id) => {
    const { data } = await api.delete(`/admin/teams/${id}`);
    return data.data;
  },

  /* ------------------------------------------------------------------ *
   * Player
   * ------------------------------------------------------------------ */

  createPlayer: async (payload) => {
    const { data } = await api.post("/admin/players", payload);
    return data.data;
  },

  updatePlayer: async (id, payload) => {
    const { data } = await api.patch(`/admin/players/${id}`, payload);
    return data.data;
  },

  deletePlayer: async (id) => {
    const { data } = await api.delete(`/admin/players/${id}`);
    return data.data;
  },

  /* ------------------------------------------------------------------ *
   * Match
   * ------------------------------------------------------------------ */

  createMatch: async (payload) => {
    const { data } = await api.post("/admin/matches", payload);
    return data.data;
  },

  updateMatch: async (id, payload) => {
    const { data } = await api.patch(`/admin/matches/${id}`, payload);
    return data.data;
  },

  deleteMatch: async (id) => {
    const { data } = await api.delete(`/admin/matches/${id}`);
    return data.data;
  },

  /* ------------------------------------------------------------------ *
   * Uploads
   * ------------------------------------------------------------------ */

  /** Ask for a signature, then upload straight to Cloudinary from the browser. */
  signUpload: async ({ folder, resourceType = "image" }) => {
    const { data } = await api.post("/upload/sign", { folder, resourceType });
    return data.data;
  },

  registerAsset: async (payload) => {
    const { data } = await api.post("/upload/register", payload);
    return data.data;
  },

  deleteAsset: async (publicId) => {
    const { data } = await api.delete(
      `/upload/${encodeURIComponent(publicId)}`,
    );
    return data.data;
  },
};

export default adminService;
