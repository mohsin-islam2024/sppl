/**
 * Socket.IO event names, shared between the server and the client.
 *
 * Keeping them in one file prevents the classic live-score bug where the server
 * emits `match:ball` and the client listens for `ball:update`, and neither side
 * notices until a real match is running.
 */

/** Client -> server */
export const CLIENT_EVENTS = Object.freeze({
  JOIN_MATCH: "join:match",
  LEAVE_MATCH: "leave:match",
  JOIN_SEASON: "join:season",
  LEAVE_SEASON: "leave:season",
  REQUEST_STATE: "request:state",
});

/** Server -> client */
export const SERVER_EVENTS = Object.freeze({
  MATCH_BALL: "match:ball",
  MATCH_SCORE: "match:score",
  MATCH_COMMENTARY: "match:commentary",
  MATCH_STATUS: "match:status",
  MATCH_UNDO: "match:undo",
  INNINGS_END: "innings:end",
  MATCH_COMPLETED: "match:completed",
  POINTS_UPDATE: "points:update",
  ANNOUNCEMENT_NEW: "announcement:new",
  SEASON_UPDATE: "season:update",
  SOCKET_ERROR: "socket:error",
});

/**
 * Room names. Every socket joins a room per match and per season, so a broadcast
 * only reaches viewers who care about it.
 */
export const rooms = Object.freeze({
  match: (matchId) => `match:${String(matchId)}`,
  season: (seasonId) => `season:${String(seasonId)}`,
  admins: "admins",
});

export default { CLIENT_EVENTS, SERVER_EVENTS, rooms };
