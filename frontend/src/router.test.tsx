import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ClusterView } from './pages/ClusterView';
import { RestConsole } from './pages/RestConsole';
import { Login } from './pages/Login';

// Helper to render with router and providers
const renderWithRouter = (initialEntries: string[]) => {
  const routes = [
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
      ],
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries,
  });

  return render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>
  );
};

describe('Router', () => {
  it('renders dashboard at root path', () => {
    renderWithRouter(['/']);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders login page at /login', () => {
    renderWithRouter(['/login']);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('renders cluster view at /cluster/:id', () => {
    renderWithRouter(['/cluster/test-cluster']);
    expect(screen.getByText(/Cluster: test-cluster/)).toBeInTheDocument();
  });

  it('renders REST console at /cluster/:id/rest', () => {
    renderWithRouter(['/cluster/test-cluster/rest']);
    expect(screen.getByText(/REST Console - Cluster: test-cluster/)).toBeInTheDocument();
  });

  it('includes AppShell for authenticated routes', () => {
    renderWithRouter(['/']);
    // AppShell should be present (check for navigation)
    expect(screen.getByText('Cerebro')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('login page does not include AppShell', () => {
    renderWithRouter(['/login']);
    // Should not have navigation menu
    expect(screen.queryByText('Clusters')).not.toBeInTheDocument();
  });
});
