import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ROLE_HIERARCHY, ROLES } from '@sppl/shared/constants/roles.js';
import PageLoader from '../components/common/PageLoader.jsx';

/**
 * Gate a route behind authentication.
 *
 * While Firebase is still resolving the session we render a loader rather than
 * redirecting — redirecting first and asking later is how a signed-in user gets
 * bounced to /login on a hard refresh.
 */
export default function ProtectedRoute({ redirectTo = '/login' }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!isAuthenticated) {
    // Preserve where they were headed so login can return them there.
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

/**
 * Gate a route behind a minimum role level.
 *
 * This is convenience, not security: it hides an admin screen from a user who
 * cannot use it. Every protected endpoint re-checks the role server-side against
 * the verified token, so a forged role in the browser buys nothing.
 *
 * @param {object} props
 * @param {string} props.minimum minimum role, e.g. ROLES.ADMIN
 * @param {string[]} [props.anyOf] exact roles allowed, as an alternative to minimum
 */
export function RoleRoute({ minimum = ROLES.ADMIN, anyOf = null }) {
  const { role, loading } = useAuth();

  if (loading) return <PageLoader />;

  const allowed = anyOf
    ? anyOf.includes(role)
    : (ROLE_HIERARCHY[role] ?? -1) >= (ROLE_HIERARCHY[minimum] ?? Infinity);

  if (!allowed) return <Navigate to="/403" replace />;

  return <Outlet />;
}
