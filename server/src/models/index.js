/**
 * Central model registry.
 *
 * Importing every model in one place guarantees Mongoose registers them before any
 * `populate()` runs — a populate against an unregistered model throws at runtime,
 * and the failure is easy to miss because it only shows up in one code path.
 */
export { User } from "./User.js";
export { Season } from "./Season.js";
export { Team } from "./Team.js";
export { Player } from "./Player.js";
export { Match } from "./Match.js";
export { Ball } from "./Ball.js";
export { PointsTable } from "./PointsTable.js";
export { PlayerStat } from "./PlayerStat.js";
export { News } from "./News.js";
export { Gallery } from "./Gallery.js";
export { Video } from "./Video.js";
export { Sponsor } from "./Sponsor.js";
export { Award } from "./Award.js";
export { Announcement } from "./Announcement.js";
export { Media } from "./Media.js";
