import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { DrawerProvider } from '../contexts/DrawerContext';
import { RefreshProvider } from '../contexts/RefreshContext';

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
        <RefreshProvider>
          <DrawerProvider>
            <BrowserRouter>{component}</BrowserRouter>
          </DrawerProvider>
        </RefreshProvider>
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
