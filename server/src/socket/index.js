import mongoose from "mongoose";
import { CLIENT_EVENTS, SERVER_EVENTS, rooms } from "./events.js";
import logger from "../utils/logger.js";

/**
 * Socket handlers.
 *
 * Sockets are intentionally READ-ONLY for scoring. Every ball is submitted over
 * authenticated REST (`POST /matches/:id/ball`), which the scoring limiter protects
 * and which validates the session against the database. The socket then broadcasts
 * the result. Accepting deliveries over the socket would mean trusting an
 * unauthenticated long-lived connection with the match record — not worth it.
 */
export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    logger.debug(`[socket] connected ${socket.id}`);

    const safeJoin = (room) => {
      socket.join(room);
      logger.debug(`[socket] ${socket.id} joined ${room}`);
    };

    socket.on(CLIENT_EVENTS.JOIN_MATCH, (payload = {}) => {
      const { matchId } = payload;
      if (!matchId || !mongoose.isValidObjectId(matchId)) {
        return socket.emit(SERVER_EVENTS.SOCKET_ERROR, {
          message: "Invalid matchId",
        });
      }
      safeJoin(rooms.match(matchId));
      socket.emit(SERVER_EVENTS.MATCH_STATUS, { matchId, joined: true });
    });

    socket.on(CLIENT_EVENTS.LEAVE_MATCH, (payload = {}) => {
      if (payload.matchId) socket.leave(rooms.match(payload.matchId));
    });

    socket.on(CLIENT_EVENTS.JOIN_SEASON, (payload = {}) => {
      const { seasonId } = payload;
      if (!seasonId || !mongoose.isValidObjectId(seasonId)) {
        return socket.emit(SERVER_EVENTS.SOCKET_ERROR, {
          message: "Invalid seasonId",
        });
      }
      safeJoin(rooms.season(seasonId));
    });

    socket.on(CLIENT_EVENTS.LEAVE_SEASON, (payload = {}) => {
      if (payload.seasonId) socket.leave(rooms.season(payload.seasonId));
    });

    socket.on("disconnect", (reason) => {
      logger.debug(`[socket] disconnected ${socket.id} (${reason})`);
    });
  });

  logger.info("[socket] handlers registered");
  return io;
}

/* ------------------------------------------------------------------ *
 * Broadcast helpers — called by controllers after a successful write.
 * ------------------------------------------------------------------ */

/**
 * Announce a recorded delivery to everyone watching the match.
 */
export function emitBall(io, payload) {
  io.to(rooms.match(payload.matchId)).emit(SERVER_EVENTS.MATCH_BALL, payload);
  io.to(rooms.match(payload.matchId)).emit(
    SERVER_EVENTS.MATCH_SCORE,
    payload.score,
  );
  if (payload.commentary) {
    io.to(rooms.match(payload.matchId)).emit(
      SERVER_EVENTS.MATCH_COMMENTARY,
      payload.commentary,
    );
  }
}

/** Announce an undo, which makes clients replace rather than append state. */
export function emitUndo(io, payload) {
  io.to(rooms.match(payload.matchId)).emit(SERVER_EVENTS.MATCH_UNDO, payload);
}

/** Announce a status change (toss done, innings break, abandoned). */
export function emitMatchStatus(io, payload) {
  io.to(rooms.match(payload.matchId)).emit(SERVER_EVENTS.MATCH_STATUS, payload);
}

/** Announce a finished match and its result. */
export function emitMatchCompleted(io, payload) {
  io.to(rooms.match(payload.matchId)).emit(
    SERVER_EVENTS.MATCH_COMPLETED,
    payload,
  );
}

/** Push the recalculated points table to the whole season room. */
export function emitPointsUpdate(io, payload) {
  io.to(rooms.season(payload.seasonId)).emit(
    SERVER_EVENTS.POINTS_UPDATE,
    payload,
  );
}

/** Push a new announcement to a season and to admin dashboards. */
export function emitAnnouncement(io, payload) {
  io.to(rooms.season(payload.seasonId)).emit(
    SERVER_EVENTS.ANNOUNCEMENT_NEW,
    payload,
  );
}

export default registerSocketHandlers;
