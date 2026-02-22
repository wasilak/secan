import { lazy } from 'react';
import { createBrowserRouter, Navigate, useParams, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LazyRoute } from './components/LazyRoute';
import { useAuth } from './contexts/AuthContext';

// Protected route component - redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login with the current path as redirect_to
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect_to=${redirectPath}`} replace />;
  }

  return <>{children}</>;
}

// Redirect component for index edit URLs
function IndexEditRedirect() {
  const { id, indexName } = useParams<{ id: string; indexName: string }>();
  const searchParams = new URLSearchParams();
  searchParams.set('tab', 'indices');
  if (indexName) {
    searchParams.set('index', indexName);
  }
  return <Navigate to={`/cluster/${id}?${searchParams.toString()}`} replace />;
}

// Redirect component for node detail URLs
function NodeDetailRedirect() {
  const { id, nodeId } = useParams<{ id: string; nodeId: string }>();
  const searchParams = new URLSearchParams();
  searchParams.set('tab', 'nodes');
  if (nodeId) {
    searchParams.set('node', nodeId);
  }
  return <Navigate to={`/cluster/${id}?${searchParams.toString()}`} replace />;
}

// Lazy-load page components for better performance
// Requirements: 31.4 - Lazy-load components to reduce initial bundle size
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ClusterView = lazy(() => import('./pages/ClusterView').then(m => ({ default: m.ClusterView })));
const RestConsole = lazy(() => import('./pages/RestConsole').then(m => ({ default: m.RestConsole })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const AccessDenied = lazy(() => import('./pages/AccessDenied').then(m => ({ default: m.AccessDenied })));
const IndexCreate = lazy(() => import('./pages/IndexCreate').then(m => ({ default: m.IndexCreate })));
const Aliases = lazy(() => import('./pages/Aliases').then(m => ({ default: m.Aliases })));
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })));
const ClusterSettingsPage = lazy(() => import('./pages/ClusterSettings').then(m => ({ default: m.ClusterSettingsPage })));
const ShardManagement = lazy(() => import('./pages/ShardManagement').then(m => ({ default: m.ShardManagement })));
const TextAnalysisPage = lazy(() => import('./pages/TextAnalysis').then(m => ({ default: m.TextAnalysisPage })));
const IndexAnalyzersPage = lazy(() => import('./pages/IndexAnalyzers').then(m => ({ default: m.IndexAnalyzersPage })));
const Repositories = lazy(() => import('./pages/Repositories').then(m => ({ default: m.Repositories })));
const Snapshots = lazy(() => import('./pages/Snapshots').then(m => ({ default: m.Snapshots })));
const CatApiPage = lazy(() => import('./pages/CatApi').then(m => ({ default: m.CatApiPage })));
const IndexStatistics = lazy(() => import('./pages/IndexStatistics').then(m => ({ default: m.IndexStatistics })));

/**
 * Main application router configuration
 * 
 * Routes:
 * - / - Dashboard (multi-cluster overview)
 * - /login - Login page
 * - /cluster/:id - Cluster detail view
 * - /cluster/:id/nodes/:nodeId - Node detail view with statistics
 * - /cluster/:id/rest - REST console
 * - /cluster/:id/indices/create - Create new index
 * - /cluster/:id/indices/:indexName/edit - Edit index (settings and mappings)
 * - /cluster/:id/indices/:indexName/analyzers - View index analyzers and fields
 * - /cluster/:id/indices/:indexName/stats - View index statistics
 * - /cluster/:id/aliases - Manage index aliases
 * - /cluster/:id/templates - Manage index templates
 * - /cluster/:id/settings - Manage cluster settings
 * - /cluster/:id/shards - Manage shard allocation
 * - /cluster/:id/analysis - Text analysis tools
 * - /cluster/:id/repositories - Manage snapshot repositories
 * - /cluster/:id/snapshots/:repository - Manage snapshots in a repository
 * - /cluster/:id/cat - Cat API access
 * 
 * Authentication redirects will be implemented when auth is integrated.
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <LazyRoute>
        <Login />
      </LazyRoute>
    ),
  },
  {
    path: '/access-denied',
    element: (
      <LazyRoute>
        <AccessDenied />
      </LazyRoute>
    ),
  },
  {
    path: '/access-denied/:clusterName',
    element: (
      <LazyRoute>
        <AccessDenied />
      </LazyRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <LazyRoute>
            <Dashboard />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id',
        element: (
          <LazyRoute>
            <ClusterView />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/nodes/:nodeId',
        element: <NodeDetailRedirect />,
      },
      {
        path: 'cluster/:id/rest',
        element: (
          <LazyRoute>
            <RestConsole />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/console',
        element: (
          <LazyRoute>
            <RestConsole />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/indices/create',
        element: (
          <LazyRoute>
            <IndexCreate />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/indices/:indexName/edit',
        element: <IndexEditRedirect />,
      },
      {
        path: 'cluster/:id/indices/:indexName/settings',
        element: <Navigate to="../edit?tab=settings" replace />,
      },
      {
        path: 'cluster/:id/indices/:indexName/mappings',
        element: <Navigate to="../edit?tab=mappings" replace />,
      },
      {
        path: 'cluster/:id/indices/:indexName/stats',
        element: (
          <LazyRoute>
            <IndexStatistics />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/aliases',
        element: (
          <LazyRoute>
            <Aliases />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/templates',
        element: (
          <LazyRoute>
            <Templates />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/settings',
        element: (
          <LazyRoute>
            <ClusterSettingsPage />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/shards',
        element: (
          <LazyRoute>
            <ShardManagement />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/analysis',
        element: (
          <LazyRoute>
            <TextAnalysisPage />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/indices/:indexName/analyzers',
        element: (
          <LazyRoute>
            <IndexAnalyzersPage />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/repositories',
        element: (
          <LazyRoute>
            <Repositories />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/snapshots/:repository',
        element: (
          <LazyRoute>
            <Snapshots />
          </LazyRoute>
        ),
      },
      {
        path: 'cluster/:id/cat',
        element: (
          <LazyRoute>
            <CatApiPage />
          </LazyRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
