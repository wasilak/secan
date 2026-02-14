import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ClusterView } from './pages/ClusterView';
import { RestConsole } from './pages/RestConsole';
import { Login } from './pages/Login';
import { IndexCreate } from './pages/IndexCreate';
import { IndexSettings } from './pages/IndexSettings';
import { IndexMappings } from './pages/IndexMappings';
import { Aliases } from './pages/Aliases';
import { Templates } from './pages/Templates';
import { ClusterSettingsPage } from './pages/ClusterSettings';
import { ShardManagement } from './pages/ShardManagement';

/**
 * Main application router configuration
 * 
 * Routes:
 * - / - Dashboard (multi-cluster overview)
 * - /login - Login page
 * - /cluster/:id - Cluster detail view
 * - /cluster/:id/rest - REST console
 * - /cluster/:id/indices/create - Create new index
 * - /cluster/:id/indices/:indexName/settings - View/edit index settings
 * - /cluster/:id/indices/:indexName/mappings - View/edit index mappings
 * - /cluster/:id/aliases - Manage index aliases
 * - /cluster/:id/templates - Manage index templates
 * - /cluster/:id/settings - Manage cluster settings
 * - /cluster/:id/shards - Manage shard allocation
 * 
 * Authentication redirects will be implemented when auth is integrated.
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'cluster/:id',
        element: <ClusterView />,
      },
      {
        path: 'cluster/:id/rest',
        element: <RestConsole />,
      },
      {
        path: 'cluster/:id/indices/create',
        element: <IndexCreate />,
      },
      {
        path: 'cluster/:id/indices/:indexName/settings',
        element: <IndexSettings />,
      },
      {
        path: 'cluster/:id/indices/:indexName/mappings',
        element: <IndexMappings />,
      },
      {
        path: 'cluster/:id/aliases',
        element: <Aliases />,
      },
      {
        path: 'cluster/:id/templates',
        element: <Templates />,
      },
      {
        path: 'cluster/:id/settings',
        element: <ClusterSettingsPage />,
      },
      {
        path: 'cluster/:id/shards',
        element: <ShardManagement />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
