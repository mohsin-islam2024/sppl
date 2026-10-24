import { Router } from "express";
import * as content from "../controllers/adminContent.controller.js";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  adminCreateNewsSchema,
  adminUpdateNewsSchema,
  adminCreateGallerySchema,
  adminUpdateGallerySchema,
  adminCreateSponsorSchema,
  adminUpdateSponsorSchema,
  adminCreateAwardSchema,
  adminUpdateAwardSchema,
  adminCreateAnnouncementSchema,
  adminUpdateAnnouncementSchema,
  adminCreateVideoSchema,
  adminUpdateVideoSchema,
} from "@sppl/shared/validation/contentSchemas.js";

const router = Router();

/**
 * Content manager routes.
 *
 * Mounted from admin.routes.js AFTER its `requireAuth` and `requireRole(ADMIN,
 * SUPER_ADMIN)` gates, so every route here is already admin-only. Do not mount this
 * router anywhere else without repeating those two middlewares.
 */
function mount(path, crud, createSchema, updateSchema) {
  router.get(path, crud.list);
  router.post(
    path,
    writeLimiter,
    validate({ body: createSchema }),
    crud.create,
  );
  router.patch(
    `${path}/:id`,
    writeLimiter,
    validate({ body: updateSchema }),
    crud.update,
  );
  router.delete(`${path}/:id`, writeLimiter, crud.remove);
}

mount("/news", content.news, adminCreateNewsSchema, adminUpdateNewsSchema);
mount(
  "/gallery",
  content.gallery,
  adminCreateGallerySchema,
  adminUpdateGallerySchema,
);
mount(
  "/sponsors",
  content.sponsors,
  adminCreateSponsorSchema,
  adminUpdateSponsorSchema,
);
mount(
  "/awards",
  content.awards,
  adminCreateAwardSchema,
  adminUpdateAwardSchema,
);
mount(
  "/announcements",
  content.announcements,
  adminCreateAnnouncementSchema,
  adminUpdateAnnouncementSchema,
);
mount(
  "/videos",
  content.videos,
  adminCreateVideoSchema,
  adminUpdateVideoSchema,
);

export default router;
