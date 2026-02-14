import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';

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
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
};

describe('AppShell', () => {
  it('renders the app title', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByText('Cerebro')).toBeInTheDocument();
  });

  it('renders burger menu button', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('renders user menu', () => {
    renderWithProviders(<AppShell />);
    // User avatar should be present
    expect(screen.getByLabelText('User menu')).toBeInTheDocument();
  });

  it('renders theme selector', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts button', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByLabelText('View keyboard shortcuts')).toBeInTheDocument();
  });
});
