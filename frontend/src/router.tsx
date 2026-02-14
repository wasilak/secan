import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ClusterView } from './pages/ClusterView';
import { RestConsole } from './pages/RestConsole';
import { Login } from './pages/Login';
import { IndexCreate } from './pages/IndexCreate';
import { IndexSettings } from './pages/IndexSettings';
import { IndexMappings } from './pages/IndexMappings';

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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
