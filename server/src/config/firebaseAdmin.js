import admin from "firebase-admin";
import env from "./env.js";
import logger from "../utils/logger.js";

/**
 * Firebase Admin SDK — the ONLY place the server trusts for identity.
 *
 * The client logs in with the Firebase JS SDK and sends the resulting ID token as
 * `Authorization: Bearer <token>`. This module verifies that token, so no client
 * can claim a role; roles live in Firebase custom claims and are mirrored into
 * the User collection for display.
 */
let initialized = false;

export function initFirebaseAdmin() {
  if (initialized) return admin;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.firebasePrivateKey,
    }),
  });

  initialized = true;
  logger.info("[firebase] admin sdk initialised");
  return admin;
}

/**
 * Verify a Firebase ID token. Throws when the token is missing, expired or forged.
 */
export async function verifyIdToken(idToken) {
  return admin.auth().verifyIdToken(idToken, true);
}

/**
 * Set a user's role as a Firebase custom claim. The client must refresh its
 * ID token afterwards for the new claim to apply.
 */
export async function setRoleClaim(firebaseUid, role) {
  await admin.auth().setCustomUserClaims(firebaseUid, { role });
}

export { admin };
export default initFirebaseAdmin;
