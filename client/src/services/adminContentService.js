import api from "../config/axios.js";

/**
 * Admin content API: news, gallery, sponsors, awards, announcements.
 *
 * All five resources share one shape (list / create / update / remove), so they are
 * built from one factory. Every call hits `/admin/*`, which the server guards with
 * `requireRole(ADMIN, SUPER_ADMIN)`.
 */
const makeResource = (path) => ({
  list: async ({ season }) => {
    const { data } = await api.get(`/admin/${path}`, { params: { season } });
    return data.data;
  },
  create: async (payload) => {
    const { data } = await api.post(`/admin/${path}`, payload);
    return data.data;
  },
  update: async (id, payload) => {
    const { data } = await api.patch(`/admin/${path}/${id}`, payload);
    return data.data;
  },
  remove: async (id) => {
    const { data } = await api.delete(`/admin/${path}/${id}`);
    return data.data;
  },
});

export const adminContentService = {
  news: makeResource("news"),
  gallery: makeResource("gallery"),
  sponsors: makeResource("sponsors"),
  awards: makeResource("awards"),
  announcements: makeResource("announcements"),
  videos: makeResource("videos"),
};

export default adminContentService;
