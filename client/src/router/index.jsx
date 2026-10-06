import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

import PublicLayout from '../components/layout/PublicLayout.jsx';
import AdminLayout from '../components/layout/AdminLayout.jsx';
import ProtectedRoute, { RoleRoute } from './ProtectedRoute.jsx';
import PageLoader from '../components/common/PageLoader.jsx';
import ErrorBoundary from '../components/common/ErrorBoundary.jsx';
import { ROLES } from '@sppl/shared/constants/roles.js';

/**
 * Route table.
 *
 * Every page is lazy-loaded so a visitor landing on the home page does not download
 * the admin panel, the scoring console and the player-comparison screen.
 *
 * The admin area is nested by permission level rather than by feature: a scorer sees
 * only the scoring console, an admin sees the management screens, and a super admin
 * additionally sees Users. The nesting mirrors what the API enforces — the client
 * hides a route it cannot use, and the server rejects the request regardless.
 */
const Home = lazy(() => import('../pages/public/Home.jsx'));
const Fixtures = lazy(() => import('../pages/public/Fixtures.jsx'));
const Results = lazy(() => import('../pages/public/Results.jsx'));
const PointsTablePage = lazy(() => import('../pages/public/PointsTablePage.jsx'));
const Teams = lazy(() => import('../pages/public/Teams.jsx'));
const TeamDetail = lazy(() => import('../pages/public/TeamDetail.jsx'));
const Players = lazy(() => import('../pages/public/Players.jsx'));
const PlayerDetail = lazy(() => import('../pages/public/PlayerDetail.jsx'));
const ComparePlayers = lazy(() => import('../pages/public/ComparePlayers.jsx'));
const Stats = lazy(() => import('../pages/public/Stats.jsx'));
const Gallery = lazy(() => import('../pages/public/Gallery.jsx'));
const Rules = lazy(() => import('../pages/public/Rules.jsx'));
const Awards = lazy(() => import('../pages/public/Awards.jsx'));
const NotFound = lazy(() => import('../pages/public/NotFound.jsx'));
const Forbidden = lazy(() => import('../pages/public/Forbidden.jsx'));

const Login = lazy(() => import('../pages/auth/Login.jsx'));
const Register = lazy(() => import('../pages/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword.jsx'));

const AdminDashboard = lazy(() => import('../pages/admin/Dashboard.jsx'));
const SeasonManager = lazy(() => import('../pages/admin/SeasonManager.jsx'));
const TeamManager = lazy(() => import('../pages/admin/TeamManager.jsx'));
const PlayerManager = lazy(() => import('../pages/admin/PlayerManager.jsx'));
const MatchManager = lazy(() => import('../pages/admin/MatchManager.jsx'));
const LiveScoring = lazy(() => import('../pages/admin/LiveScoring.jsx'));
const LiveScoringMatch = lazy(() => import('../pages/admin/LiveScoringMatch.jsx'));

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public site */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="fixtures" element={<Fixtures />} />
            <Route path="results" element={<Results />} />
            <Route path="points-table" element={<PointsTablePage />} />
            <Route path="teams" element={<Teams />} />
            <Route path="teams/:slug" element={<TeamDetail />} />
            <Route path="players" element={<Players />} />
            <Route path="players/:id" element={<PlayerDetail />} />
            <Route path="compare" element={<ComparePlayers />} />
            <Route path="stats" element={<Stats />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="rules" element={<Rules />} />
            <Route path="awards" element={<Awards />} />

            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />

            <Route path="403" element={<Forbidden />} />
            {/* Catch-all stays last inside the public layout. */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Authenticated area */}
          <Route element={<ProtectedRoute />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />

              {/* Scorer and above — the scoring console */}
              <Route
                element={<RoleRoute anyOf={[ROLES.SCORER, ROLES.ADMIN, ROLES.SUPER_ADMIN]} />}
              >
                <Route path="live-scoring" element={<LiveScoring />} />
                <Route path="live-scoring/:matchId" element={<LiveScoringMatch />} />
              </Route>

              {/* Admin and above — management screens */}
              <Route element={<RoleRoute minimum={ROLES.ADMIN} />}>
                <Route path="seasons" element={<SeasonManager />} />
                <Route path="teams" element={<TeamManager />} />
                <Route path="players" element={<PlayerManager />} />
                <Route path="matches" element={<MatchManager />} />
                <Route path="points" element={<AdminDashboard />} />
                <Route path="news" element={<AdminDashboard />} />
                <Route path="gallery" element={<AdminDashboard />} />
                <Route path="sponsors" element={<AdminDashboard />} />
                <Route path="awards" element={<AdminDashboard />} />
                <Route path="announcements" element={<AdminDashboard />} />
              </Route>

              {/* Super admin only */}
              <Route element={<RoleRoute minimum={ROLES.SUPER_ADMIN} />}>
                <Route path="users" element={<AdminDashboard />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
