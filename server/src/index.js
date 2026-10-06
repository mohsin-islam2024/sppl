import http from "node:http";
import { Server as SocketServer } from "socket.io";

import createApp from "./app.js";
import env from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { initFirebaseAdmin } from "./config/firebaseAdmin.js";
import { registerSocketHandlers } from "./socket/index.js";
import { initCloudinary } from "./config/cloudinary.js";
import logger from "./utils/logger.js";

/**
 * Boot sequence: validate config -> connect services -> open the port.
 *
 * If MongoDB or Firebase cannot be reached the process exits, because a server that
 * accepts traffic it cannot serve is worse than one that is visibly down.
 */
async function bootstrap() {
  initFirebaseAdmin();
  initCloudinary();
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: {
      origin: env.CORS_ORIGINS,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Live scoring tolerates a brief mobile network drop without tearing the
    // match room down, which is the common case on a village connection.
    pingTimeout: 25000,
    pingInterval: 20000,
  });

  registerSocketHandlers(io);

  // Expose io to route handlers without threading it through every call.
  app.set("io", io);

  server.listen(env.PORT, () => {
    logger.info(
      `[server] SPPL API listening on port ${env.PORT} (${env.NODE_ENV})`,
    );
  });

  /**
   * Graceful shutdown. Render sends SIGTERM before replacing an instance; closing
   * the socket server first lets live clients reconnect cleanly.
   */
  const shutdown = async (signal) => {
    logger.warn(`[server] ${signal} received, shutting down`);
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Hard stop if something refuses to close.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("[process] unhandled rejection", reason);
  });
  process.on("uncaughtException", (error) => {
    logger.error("[process] uncaught exception", error);
    process.exit(1);
  });

  return server;
}

bootstrap().catch((error) => {
  logger.error("[server] failed to start", error);
  process.exit(1);
});
