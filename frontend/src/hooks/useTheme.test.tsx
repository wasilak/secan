import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { useTheme } from './useTheme';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
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
  return vi.fn().mockImplementation(() => ({
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('useTheme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should default to system theme', () => {
    window.matchMedia = createMatchMediaMock(false);
    
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    });
    
    expect(result.current.theme).toBe('system');
  });

  it('should set theme to light', () => {
    window.matchMedia = createMatchMediaMock(false);
    
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    });
    
    act(() => {
      result.current.setTheme('light');
    });
    
    expect(localStorageMock.getItem('secan-theme')).toBe('light');
  });

  it('should set theme to dark', () => {
    window.matchMedia = createMatchMediaMock(false);
    
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    });
    
    act(() => {
      result.current.setTheme('dark');
    });
    
    expect(localStorageMock.getItem('secan-theme')).toBe('dark');
  });

  it('should restore theme from localStorage', () => {
    localStorageMock.setItem('secan-theme', 'dark');
    window.matchMedia = createMatchMediaMock(false);
    
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    });
    
    expect(result.current.theme).toBe('dark');
  });

  it('should handle corrupted localStorage data', () => {
    localStorageMock.setItem('secan-theme', 'invalid-theme');
    window.matchMedia = createMatchMediaMock(false);
    
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    });
    
    expect(result.current.theme).toBe('system');
  });
});
