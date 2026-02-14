import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ThemeSelector } from './ThemeSelector';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
const createMatchMediaMock = (matches: boolean) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    window.matchMedia = createMatchMediaMock(false);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MantineProvider>{children}</MantineProvider>
  );

  it('should render theme toggle button', () => {
    render(<ThemeSelector />, { wrapper });
    
    const button = screen.getByRole('button', { name: 'Toggle theme' });
    expect(button).toBeInTheDocument();
  });

  it('should have correct title attribute', () => {
    render(<ThemeSelector />, { wrapper });
    
    const button = screen.getByRole('button', { name: 'Toggle theme' });
    expect(button).toHaveAttribute('title', 'Change theme');
  });

  it('should render with system theme icon by default', () => {
    render(<ThemeSelector />, { wrapper });
    
    const button = screen.getByRole('button', { name: 'Toggle theme' });
    // Check that the button contains an SVG (icon)
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
