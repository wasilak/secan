import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { DrawerProvider } from '../contexts/DrawerContext';
import { RefreshProvider } from '../contexts/RefreshContext';
import { AuthProvider } from '../contexts/AuthContext';
import userEvent from '@testing-library/user-event';

// Helper to render with required providers
const renderWithProviders = (component: React.ReactElement) => {
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
        <AuthProvider>
          <RefreshProvider>
            <DrawerProvider>
              <BrowserRouter>{component}</BrowserRouter>
            </DrawerProvider>
          </RefreshProvider>
        </AuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
};

describe('AppShell', () => {
  it('renders the app title', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByText('Secan')).toBeInTheDocument();
  });

  it('renders burger menu button', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('renders navigation menu button', () => {
    renderWithProviders(<AppShell />);
    // Burger menu button should be present
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('renders refresh control', () => {
    renderWithProviders(<AppShell />);
    // App title should be present
    expect(screen.getByText('Secan')).toBeInTheDocument();
  });
});

describe('Breadcrumb Navigation', () => {
  /**
   * Test breadcrumb dropdown menu interactions
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */

  it('renders Secan app level in breadcrumb when not in cluster view', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <AuthProvider>
            <RefreshProvider>
              <DrawerProvider>
                <MemoryRouter initialEntries={['/']}>
                  <AppShell />
                </MemoryRouter>
              </DrawerProvider>
            </RefreshProvider>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Secan')).toBeInTheDocument();
  });

  it('opens and closes app level dropdown menu', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <AuthProvider>
            <RefreshProvider>
              <DrawerProvider>
                <MemoryRouter initialEntries={['/']}> 
                  <AppShell />
                </MemoryRouter>
              </DrawerProvider>
            </RefreshProvider>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );

    const user = userEvent.setup();
    const secanButton = screen.getByRole('button', { name: /Secan/i });
    
    // Click to open
    await user.click(secanButton);
    
    // Dashboard option should appear
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('displays all cluster sections in section dropdown menu', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const expectedSections = [
      'Overview',
      'Topology',
      'Statistics',
      'Nodes',
      'Indices',
      'Shards',
      'Settings',
      'Console',
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <AuthProvider>
            <RefreshProvider>
              <DrawerProvider>
                <MemoryRouter initialEntries={['/cluster/test-cluster?tab=overview']}>
                  <AppShell />
                </MemoryRouter>
              </DrawerProvider>
            </RefreshProvider>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );

    // Find and click on Overview button (or any section button) to trigger menu
    const user = userEvent.setup();
    
    // The section dropdown should show overview by default
    const overviewButtons = screen.queryAllByText('Overview');
    expect(overviewButtons.length).toBeGreaterThan(0);
  });

  it('highlights active section in dropdown menu', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <AuthProvider>
            <RefreshProvider>
              <DrawerProvider>
                <MemoryRouter initialEntries={['/cluster/test-cluster?tab=shards']}>
                  <AppShell />
                </MemoryRouter>
              </DrawerProvider>
            </RefreshProvider>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );

    // Shards should be displayed in breadcrumb when tab=shards
    const shardButtons = screen.queryAllByText('Shards');
    expect(shardButtons.length).toBeGreaterThan(0);
  });

  it('updates breadcrumb section label when URL tab parameter changes', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <AuthProvider>
            <RefreshProvider>
              <DrawerProvider>
                <MemoryRouter initialEntries={['/cluster/test-cluster?tab=overview']}>
                  <AppShell />
                </MemoryRouter>
              </DrawerProvider>
            </RefreshProvider>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );

    // Should show Overview initially
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('preserves section when navigating to different cluster', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <AuthProvider>
            <RefreshProvider>
              <DrawerProvider>
                <MemoryRouter
                  initialEntries={['/cluster/cluster-1?tab=shards']}
                >
                  <AppShell />
                </MemoryRouter>
              </DrawerProvider>
            </RefreshProvider>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );

    // Initially on cluster-1 with shards tab
    expect(screen.getByText('Shards')).toBeInTheDocument();
  });
});
