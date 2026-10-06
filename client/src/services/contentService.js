import api from "../config/axios.js";

/**
 * Content API: news, gallery, videos, sponsors, awards, announcements and the
 * season leaderboards.
 */
export const contentService = {
  /* News */
  news: async ({ season, page = 1, limit = 12 } = {}) => {
    const { data } = await api.get("/news", {
      params: { season, page, limit },
    });
    return { items: data.data, meta: data.meta };
  },

  article: async (slug) => {
    const { data } = await api.get(`/news/${slug}`);
    return data.data;
  },

  /* Gallery */
  gallery: async ({ season, matchId, type, page = 1, limit = 24 } = {}) => {
    const { data } = await api.get("/gallery", {
      params: { season, matchId, type, page, limit },
    });
    return { items: data.data, meta: data.meta };
  },

  /* Videos */
  videos: async ({ season, page = 1, limit = 12 } = {}) => {
    const { data } = await api.get("/videos", {
      params: { season, page, limit },
    });
    return { items: data.data, meta: data.meta };
  },

  /* Sponsors — grouped by tier, ordered server-side */
  sponsors: async ({ season } = {}) => {
    const { data } = await api.get("/sponsors", { params: { season } });
    return data.data;
  },

  /* Awards — ordered champion first */
  awards: async ({ season, matchId } = {}) => {
    const { data } = await api.get("/awards", { params: { season, matchId } });
    return data.data;
  },

  /* Announcements — live notices only */
  announcements: async ({ season, includeArchive } = {}) => {
    const { data } = await api.get("/announcements", {
      params: { season, includeArchive: includeArchive ? "true" : undefined },
    });
    return data.data;
  },

  /* Season leaderboards */
  stats: async ({ season } = {}) => {
    const { data } = await api.get("/stats", { params: { season } });
    return data.data;
  },
};

export default contentService;
