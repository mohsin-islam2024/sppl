import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";

/**
 * Connect to MongoDB Atlas. Mongoose buffers commands until the connection is
 * ready, so route handlers do not need to await this.
 */
export async function connectDatabase() {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    logger.info(`[db] connected to ${mongoose.connection.name}`);
  });

  mongoose.connection.on("error", (error) => {
    logger.error("[db] connection error", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("[db] disconnected");
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
  logger.info("[db] connection closed");
}

export default connectDatabase;
