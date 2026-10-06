import api from "../config/axios.js";

/**
 * Season API.
 *
 * Every other read is scoped to a season, so this module owns the idea of "which
 * season am I looking at". `identifier` is always a slug or a Mongo id — the client
 * passes the slug it has in the URL, and the server resolves either.
 */
export const seasonService = {
  /** All seasons, newest first, with `isCurrent` on the one to default to. */
  list: async () => {
    const { data } = await api.get("/seasons");
    return data.data;
  },

  /** The season a first-time visitor should land on. */
  current: async () => {
    const { data } = await api.get("/seasons/current");
    return data.data;
  },

  get: async (identifier) => {
    const { data } = await api.get(`/seasons/${identifier}`);
    return data.data;
  },

  /** Static text: match rules and points system. Safe to cache for a long time. */
  rules: async (identifier) => {
    const { data } = await api.get(`/seasons/${identifier}/rules`);
    return data.data;
  },

  /** Home page payload — counts, live match, next fixture, latest result, table. */
  summary: async (identifier) => {
    const { data } = await api.get(`/seasons/${identifier}/summary`);
    return data.data;
  },

  teams: async (identifier) => {
    const { data } = await api.get(`/seasons/${identifier}/teams`);
    return data.data;
  },

  fixtures: async (identifier, { status, stage, limit } = {}) => {
    const { data } = await api.get(`/seasons/${identifier}/fixtures`, {
      params: { status, stage, limit },
    });
    return data.data;
  },
};

export default seasonService;
