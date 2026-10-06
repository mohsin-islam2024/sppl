import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import env from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";

/**
 * Build the Express application.
 *
 * Kept separate from `index.js` so the app can be imported by tests without
 * opening a port or starting Socket.IO.
 */
export function createApp() {
  const app = express();

  // Render terminates TLS in front of the app, so the proxy must be trusted or
  // rate limiting would see every visitor as the same IP.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Security headers. The API serves JSON only, so the default CSP is relaxed
  // to nothing useful here — but helmet still adds HSTS, noSniff and friends.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(compression());

  const corsOptions = {
    origin(origin, callback) {
      // Same-origin / curl requests arrive without an Origin header.
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      logger.warn(`[cors] blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  if (env.isDevelopment) {
    app.use(morgan("dev"));
  } else {
    app.use(
      morgan(":method :url :status :res[content-length] - :response-time ms", {
        skip: (req) => req.path === "/api/v1/health",
      }),
    );
  }

  app.use(globalLimiter);
  app.use("/api/v1", apiRoutes);

  // Root pointer so hitting the bare Render URL is not a 404 that looks broken.
  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      data: { service: "SPPL API", docs: "/api/v1/health" },
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
