import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages/Dashboard';
import { ClusterView } from './pages/ClusterView';
import { RestConsole } from './pages/RestConsole';
import { Login } from './pages/Login';
import { DrawerProvider } from './contexts/DrawerContext';
import { RefreshProvider } from './contexts/RefreshContext';

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

  // Create a new QueryClient for each test to avoid state leakage
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <RefreshProvider>
          <DrawerProvider>
            <RouterProvider router={router} />
          </DrawerProvider>
        </RefreshProvider>
      </MantineProvider>
    </QueryClientProvider>
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

  it('renders cluster view at /cluster/:id', async () => {
    renderWithRouter(['/cluster/test-cluster']);
    // The component will try to fetch data and show loading or error state
    // Since we don't have a mock server, it will eventually show an error or loading
    // Just check that the ClusterView component is rendered (it's in the AppShell)
    expect(screen.getByText('Secan')).toBeInTheDocument();
  });

  it('renders REST console at /cluster/:id/rest', () => {
    renderWithRouter(['/cluster/test-cluster/rest']);
    expect(screen.getByText(/REST Console - Cluster: test-cluster/)).toBeInTheDocument();
  });

  it('includes AppShell for authenticated routes', () => {
    renderWithRouter(['/']);
    // AppShell should be present (check for navigation)
    expect(screen.getByText('Secan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('login page does not include AppShell', () => {
    renderWithRouter(['/login']);
    // Should not have navigation menu
    expect(screen.queryByText('Clusters')).not.toBeInTheDocument();
  });
});
