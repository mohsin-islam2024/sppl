export const ROLES = Object.freeze({
  GUEST: "GUEST",
  USER: "USER",
  PLAYER: "PLAYER",
  SCORER: "SCORER",
  UMPIRE: "UMPIRE",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
});

export const ROLE_HIERARCHY = Object.freeze({
  [ROLES.GUEST]: 0,
  [ROLES.USER]: 1,
  [ROLES.PLAYER]: 2,
  [ROLES.UMPIRE]: 3,
  [ROLES.SCORER]: 3,
  [ROLES.ADMIN]: 4,
  [ROLES.SUPER_ADMIN]: 5,
});

export const SCORING_ROLES = Object.freeze([
  ROLES.SCORER,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
]);

export const hasRole = (userRole, allowed = []) => {
  if (!userRole) return false;
  if (allowed.length === 0) return true;
  return allowed.includes(userRole);
};

export const hasMinimumRole = (userRole, minimum) => {
  const current = ROLE_HIERARCHY[userRole];
  const required = ROLE_HIERARCHY[minimum];
  if (current === undefined || required === undefined) return false;
  return current >= required;
};
