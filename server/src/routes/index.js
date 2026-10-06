import { Router } from "express";

import seasonRoutes from "./season.routes.js";
import teamRoutes from "./team.routes.js";
import playerRoutes from "./player.routes.js";
import matchRoutes from "./match.routes.js";
import pointsRoutes from "./points.routes.js";
import contentRoutes from "./content.routes.js";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";
import uploadRoutes from "./upload.routes.js";
import scoringRoutes from "./scoring.routes.js";
import env from "../config/env.js";

const router = Router();

/** Health probe. */
router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "sppl-api",
      version: "v1",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});

/* Public read surface */
router.use("/", seasonRoutes);
router.use("/teams", teamRoutes);
router.use("/players", playerRoutes);
router.use("/matches", matchRoutes);
router.use("/points-table", pointsRoutes);
router.use("/", contentRoutes);
router.use("/scoring", scoringRoutes);


/* Authenticated surface */
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/upload", uploadRoutes);


export default router;
