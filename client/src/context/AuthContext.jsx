import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  reload,
} from 'firebase/auth';
import { auth, googleProvider, applyAuthPersistence } from '../config/firebase.js';
import authService from '../services/authService.js';
import { ROLES, hasMinimumRole } from '@sppl/shared/constants/roles.js';

/**
 * Authentication context.
 *
 * Ownership is split deliberately:
 *   - Firebase owns credentials. It is the only thing that can sign a user in.
 *   - Our API owns the role mirror. The client NEVER decides its own permissions;
 *     it reads `profile.role` from the server and uses it for UI only.
 *
 * The state machine is: `loading` while Firebase resolves the session, then either
 * an authenticated Firebase user (+ our mirrored profile) or null.
 */
const AuthContext = createContext(null);

/** Roles are minted as Firebase custom claims, so a refresh may be needed to see one. */
const CLAIM_REFRESH_INTERVAL = 10 * 60 * 1000;

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastClaimRefresh = useRef(0);

  /**
   * Mirror the Firebase account into MongoDB and load the role.
   * This is what turns "signed in to Firebase" into "known to SPPL".
   */
  const loadProfile = useCallback(async () => {
    try {
      const synced = await authService.sync();
      setProfile(synced);
      return synced;
    } catch (err) {
      // A sync failure usually means the API is unreachable rather than the user
      // being invalid. Signing them out here would be wrong, so record it and let
      // the UI show a degraded state.
      setError(err.message ?? 'Could not reach the SPPL server');
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);

      // Custom claims live on the token. After an admin changes a role, the change
      // only becomes visible once the token refreshes — so nudge it periodically
      // during a long session instead of waiting for a full page reload.
      const now = Date.now();
      if (now - lastClaimRefresh.current > CLAIM_REFRESH_INTERVAL) {
        try {
          await user.getIdToken(true);
        } catch {
          // Non-fatal: the existing token remains usable.
        }
        lastClaimRefresh.current = now;
      }

      await loadProfile();
      setLoading(false);
    });

    return unsubscribe;
  }, [loadProfile]);

  /** The session was rejected mid-use (expired token, deactivated account). */
  useEffect(() => {
    const handler = async () => {
      setProfile(null);
      await signOut(auth);
    };
    window.addEventListener('sppl:unauthorized', handler);
    return () => window.removeEventListener('sppl:unauthorized', handler);
  }, []);

  const signInEmail = useCallback(
    async ({ email, password, remember = true }) => {
      setError(null);
      await applyAuthPersistence(remember);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const synced = await loadProfile();
      return { user: credential.user, profile: synced };
    },
    [loadProfile],
  );

  const signInGoogle = useCallback(
    async ({ remember = true } = {}) => {
      setError(null);
      await applyAuthPersistence(remember);
      const credential = await signInWithPopup(auth, googleProvider);
      const synced = await loadProfile();
      return { user: credential.user, profile: synced };
    },
    [loadProfile],
  );

  const register = useCallback(
    async ({ name, email, password, remember = true }) => {
      setError(null);
      await applyAuthPersistence(remember);
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (name) await updateProfile(credential.user, { displayName: name });

      // Email verification is a courtesy step, not a gate: a village player may not
      // check mail promptly, and blocking login would make the site unusable for them.
      try {
        await sendEmailVerification(credential.user);
      } catch {
        // Rate limited or offline — the user can resend later from their profile.
      }

      const synced = await loadProfile();
      return { user: credential.user, profile: synced };
    },
    [loadProfile],
  );

  const resetPassword = useCallback(async (email) => {
    setError(null);
    await sendPasswordResetEmail(auth, email);
    return true;
  }, []);

  const resendVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    await sendEmailVerification(auth.currentUser);
    return true;
  }, []);

  /** Re-read the Firebase user so `emailVerified` reflects a freshly clicked link. */
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return null;
    await reload(auth.currentUser);
    setFirebaseUser({ ...auth.currentUser });
    return auth.currentUser;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setFirebaseUser(null);
  }, []);

  const role = profile?.role ?? ROLES.GUEST;
  const isAuthenticated = Boolean(firebaseUser);

  const value = useMemo(() => {
    return {
      // State
      firebaseUser,
      profile,
      role,
      loading,
      error,
      isAuthenticated,
      emailVerified: Boolean(firebaseUser?.emailVerified),

      // Derived permissions — UI gating ONLY. The server re-checks everything.
      isAdmin: hasMinimumRole(role, ROLES.ADMIN),
      isScorer: role === ROLES.SCORER || hasMinimumRole(role, ROLES.ADMIN),
      isSuperAdmin: role === ROLES.SUPER_ADMIN,

      // Actions
      signInEmail,
      signInGoogle,
      register,
      resetPassword,
      resendVerification,
      refreshUser,
      reloadProfile: loadProfile,
      logout,
    };
  }, [
    firebaseUser,
    profile,
    role,
    loading,
    error,
    isAuthenticated,
    signInEmail,
    signInGoogle,
    register,
    resetPassword,
    resendVerification,
    refreshUser,
    loadProfile,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Throws when used outside the provider — a wiring mistake worth failing loudly. */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return context;
}

export default AuthContext;
