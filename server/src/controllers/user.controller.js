import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import { User } from "../models/User.js";
import { changeUserRole } from "../services/userService.js";
import ApiError from "../utils/ApiError.js";
import { ROLES } from "@sppl/shared/constants/roles.js";

/**
 * GET /api/v1/users
 * Paginated account list for the admin panel.
 */
export const listUsers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const filter = {};

  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const term = String(req.query.search).trim();
    filter.$or = [
      { name: new RegExp(term, "i") },
      { email: new RegExp(term, "i") },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
});

/**
 * GET /api/v1/users/:id
 */
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound("User not found");
  res.status(200).json(ok(user));
});

/**
 * PATCH /api/v1/users/:id/role
 * SUPER_ADMIN only.
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await changeUserRole({
    userId: req.params.id,
    role: req.body.role,
    actorRole: req.user.role,
    actorId: req.user._id,
  });
  res.status(200).json(ok(user, "Role updated"));
});

/**
 * PATCH /api/v1/users/me
 * Self-service profile update.
 */
export const updateOwnProfile = asyncHandler(async (req, res) => {
  const allowed = ["name", "phone", "photoUrl"];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }

  const user = await User.findByIdAndUpdate(req.user._id, update, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound("User not found");

  res.status(200).json(ok(user.toJSON(), "Profile updated"));
});

/**
 * DELETE /api/v1/users/:id
 * SUPER_ADMIN only. Deactivates rather than removes, so authored content keeps a
 * valid author reference.
 */
export const deactivateUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true },
  );
  if (!user) throw ApiError.notFound("User not found");

  res.status(200).json(ok(user.toJSON(), "Account deactivated"));
});

export const ROLE_OPTIONS = Object.values(ROLES);
