import { Router } from "express";
import { getPointsTable } from "../controllers/points.controller.js";

const router = Router();

/** Public standings read. */
router.get("/", getPointsTable);

export default router;
