import { useAuthContext } from "../context/AuthContext.jsx";

/**
 * Public hook for auth state and permissions.
 *
 * Components should import this rather than reaching into the context directly, so
 * the provider's shape can change without touching every consumer.
 */
export function useAuth() {
  return useAuthContext();
}

export default useAuth;
