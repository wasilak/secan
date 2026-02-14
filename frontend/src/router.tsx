import { createBrowserRouter } from 'react-router-dom';
import App from './App';

/**
 * Main application router configuration
 * 
 * Routes will be added as features are implemented:
 * - / - Dashboard (multi-cluster overview)
 * - /login - Login page
 * - /cluster/:id - Cluster detail view
 * - /cluster/:id/rest - REST console
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <div>Dashboard placeholder</div>,
      },
    ],
  },
]);
