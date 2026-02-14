import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { AppShell } from './AppShell';

// Helper to render with required providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </MantineProvider>
  );
};

describe('AppShell', () => {
  it('renders the app title', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByText('Cerebro')).toBeInTheDocument();
  });

  it('renders navigation menu', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clusters')).toBeInTheDocument();
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

  it('renders version information', () => {
    renderWithProviders(<AppShell />);
    expect(screen.getByText(/Cerebro v/)).toBeInTheDocument();
  });
});
