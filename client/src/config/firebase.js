import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";

/**
 * Firebase client initialisation.
 *
 * Only the AUTH product is imported. Firestore, Storage and Hosting are deliberately
 * absent — SPPL keeps data in MongoDB Atlas behind the Express API, and media in
 * Cloudinary. Pulling in the other Firebase SDKs would ship tens of kilobytes of
 * code for nothing and, worse, suggest a data path that does not exist here.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Fail loudly during development. In production this surfaces as a console error
  // rather than a blank screen, and the login form shows its own message.
  console.error(
    "[firebase] Missing configuration. Copy client/.env.example to client/.env and fill in the Firebase web values.",
  );
}

/** Reuse the existing app across HMR reloads instead of initialising twice. */
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/** Ask Google for the account chooser so shared devices do not silently reuse a login. */
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Persistence controls "remember me".
 *
 * @param {boolean} remember true → survive browser restarts (localStorage);
 *                           false → end when the tab closes (sessionStorage).
 */
export async function applyAuthPersistence(remember) {
  return setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
}

export default app;
