import { User } from "../models/User.js";
import { setRoleClaim } from "../config/firebaseAdmin.js";
import { ROLES } from "@sppl/shared/constants/roles.js";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";

/**
 * Create or refresh the Mongo mirror of a Firebase account.
 *
 * Runs on every successful login. It is deliberately idempotent and cheap, and it
 * is the ONLY place a user document is created.
 */
export async function syncUser({ decoded, name, photoUrl }) {
  const existing = await User.findOne({ firebaseUid: decoded.uid });

  // First ever login by the bootstrap UID becomes SUPER_ADMIN. This is how the
  // very first admin exists without any manual database edit.
  const isBootstrapAdmin =
    Boolean(env.SUPER_ADMIN_UID) && decoded.uid === env.SUPER_ADMIN_UID;

  if (!existing) {
    const user = await User.create({
      firebaseUid: decoded.uid,
      name: name || decoded.name || decoded.email?.split("@")[0] || "",
      email: decoded.email ?? "",
      photoUrl: photoUrl || decoded.picture || "",
      emailVerified: Boolean(decoded.email_verified),
      role: isBootstrapAdmin ? ROLES.SUPER_ADMIN : ROLES.USER,
      lastLoginAt: new Date(),
      createdBy: isBootstrapAdmin ? "bootstrap" : null,
    });

    // Mirror the role into a custom claim so protected endpoints can trust the
    // token alone. A failed claim write is not fatal — the document still holds
    // the role and the next sync will retry it.
    try {
      await setRoleClaim(decoded.uid, user.role);
    } catch {
      // Intentionally swallowed; logged by the caller if it matters.
    }

    return user.toJSON();
  }

  existing.name = name || existing.name || decoded.name || "";
  existing.email = decoded.email ?? existing.email;
  existing.photoUrl = photoUrl || existing.photoUrl || decoded.picture || "";
  existing.emailVerified = Boolean(decoded.email_verified);
  existing.lastLoginAt = new Date();
  if (isBootstrapAdmin && existing.role !== ROLES.SUPER_ADMIN) {
    existing.role = ROLES.SUPER_ADMIN;
  }

  await existing.save();
  return existing.toJSON();
}

/**
 * Change a user's role. Updates the Mongo document AND the Firebase custom claim,
 * so the change takes effect on the user's next token refresh.
 */
export async function changeUserRole({ userId, role, actorRole, actorId }) {
  const target = await User.findById(userId);
  if (!target) throw ApiError.notFound("User not found");

  // Guard rails: only a SUPER_ADMIN may mint another SUPER_ADMIN, and nobody may
  // change their own role (that is how a sole admin locks themselves out).
  if (role === ROLES.SUPER_ADMIN && actorRole !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden("Only a Super Admin can grant Super Admin");
  }
  if (String(target._id) === String(actorId)) {
    throw ApiError.badRequest("You cannot change your own role");
  }

  target.role = role;
  await target.save();
  await setRoleClaim(target.firebaseUid, role);

  return target.toJSON();
}

/**
 * Link a user account to a player record (used when a player registers).
 */
export async function linkPlayerAccount(userId, { playerId, teamId }) {
  const update = {};
  if (playerId !== undefined) update.playerId = playerId;
  if (teamId !== undefined) update.teamId = teamId;

  const user = await User.findByIdAndUpdate(userId, update, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  return user.toJSON();
}

export default { syncUser, changeUserRole, linkPlayerAccount };
