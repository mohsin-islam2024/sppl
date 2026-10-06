#!/usr/bin/env node
/**
 * Grant a role to a Firebase user, and mirror it into MongoDB.
 *
 * Why this script exists at all: Firebase has no console UI for setting custom
 * claims. The role lives on the token, and the only supported way to write it is
 * the Admin SDK. So this is the bootstrap path — without it there is no way to
 * create the first admin.
 *
 * Usage:
 *   npm run set-role --workspace=server -- <email> <ROLE>
 *
 * Examples:
 *   npm run set-role --workspace=server -- mohsin@example.com SUPER_ADMIN
 *   npm run set-role --workspace=server -- scorer@example.com SCORER
 *
 * Requires FIREBASE_* and MONGODB_URI in server/.env.
 *
 * IMPORTANT: the user must sign out and sign back in for the new claim to take
 * effect. The client refreshes its token on a timer, but a stale token still reads
 * the old claim until then.
 */

import "dotenv/config";
import mongoose from "mongoose";
import admin from "firebase-admin";

import { initFirebaseAdmin } from "../config/firebaseAdmin.js";
import env from "../config/env.js";
import { User } from "../models/User.js";
import { ROLES, ROLE_HIERARCHY } from "@sppl/shared/constants/roles.js";

const log = (...args) => console.log("[set-role]", ...args);

/** Fail with a readable message rather than a stack trace. */
function usage(message) {
  if (message) console.error(`\n[set-role] ${message}\n`);
  console.log("Usage:  npm run set-role --workspace=server -- <email> <ROLE>");
  console.log(`Roles:  ${Object.values(ROLES).join(", ")}`);
  process.exit(1);
}

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !role) usage("Both an email and a role are required.");

  const normalisedRole = String(role).toUpperCase();
  if (!ROLES[normalisedRole] || normalisedRole === ROLES.GUEST) {
    usage(
      `"${role}" is not an assignable role. GUEST is not a real account role.`,
    );
  }

  if (!env.MONGODB_URI) usage("MONGODB_URI is not set in server/.env");

  initFirebaseAdmin();

  // 1. Find the account in Firebase.
  let firebaseUser;
  try {
    firebaseUser = await admin
      .auth()
      .getUserByEmail(String(email).trim().toLowerCase());
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      usage(
        `No Firebase account for "${email}". Register on the site first, then run this again.`,
      );
    }
    throw error;
  }

  log(`found Firebase account: ${firebaseUser.uid}`);

  // 2. Write the custom claim. This is what the API actually trusts.
  await admin
    .auth()
    .setCustomUserClaims(firebaseUser.uid, { role: normalisedRole });
  log(`custom claim set: { role: "${normalisedRole}" }`);

  // 3. Mirror it into MongoDB so the admin list shows the right role before the
  //    user's next token refresh.
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const existing = await User.findOne({ firebaseUid: firebaseUser.uid });

  if (existing) {
    const previous = existing.role;
    existing.role = normalisedRole;
    if (firebaseUser.displayName && !existing.name)
      existing.name = firebaseUser.displayName;
    if (firebaseUser.email && !existing.email)
      existing.email = firebaseUser.email;
    await existing.save();
    log(`user document updated: ${previous} → ${normalisedRole}`);
  } else {
    await User.create({
      firebaseUid: firebaseUser.uid,
      name: firebaseUser.displayName ?? "",
      email: firebaseUser.email ?? "",
      photoUrl: firebaseUser.photoURL ?? "",
      role: normalisedRole,
      emailVerified: Boolean(firebaseUser.emailVerified),
      createdBy: "set-role-script",
    });
    log("user document created (the account had never signed in to the site)");
  }

  console.log("");
  log("----------------------------------------");
  log(`  ${firebaseUser.email}`);
  log(`  role: ${normalisedRole}`);
  log(`  access level: ${ROLE_HIERARCHY[normalisedRole]}`);
  log("----------------------------------------");
  log(
    "Done. The user must sign out and sign back in for the new role to apply.",
  );
  log(
    "If they stay signed in, the claim reaches them on the next token refresh.",
  );

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error("\n[set-role] failed:", error.message);
  if (
    error.code === "app/invalid-credential" ||
    error.code === "auth/invalid-credential"
  ) {
    console.error(
      "[set-role] Firebase credentials look wrong. Check FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in server/.env.",
    );
  }
  try {
    await mongoose.connection.close();
  } catch {
    // Nothing to close.
  }
  process.exit(1);
});
