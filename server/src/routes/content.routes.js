import { Router } from "express";
import {
  listNews,
  getNews,
  listGallery,
  listVideos,
  listSponsors,
  listAwards,
  listAnnouncements,
  getSeasonStats,
} from "../controllers/content.controller.js";
import { validate } from "../middleware/validate.js";
import { paginationSchema } from "@sppl/shared/validation/schemas.js";

const router = Router();

/** Public content reads — news, gallery, videos, sponsors, awards, stats. */
router.get("/news", validate({ query: paginationSchema }), listNews);
router.get("/news/:slug", getNews);
router.get("/gallery", validate({ query: paginationSchema }), listGallery);
router.get("/videos", validate({ query: paginationSchema }), listVideos);
router.get("/sponsors", listSponsors);
router.get("/awards", listAwards);
router.get("/announcements", listAnnouncements);
router.get("/stats", getSeasonStats);

export default router;
