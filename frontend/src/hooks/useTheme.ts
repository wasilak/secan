import { useEffect } from 'react';
import { useMantineColorScheme } from '@mantine/core';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const THEME_STORAGE_KEY = 'secan-theme';

/**
 * Hook for managing application theme (light, dark, system)
 *
 * Supports three modes:
 * - light: Always use light theme
 * - dark: Always use dark theme
 * - system: Follow OS preference (default)
 *
 * Theme preference is persisted to localStorage and restored on app load.
 */
export function useTheme(): ThemeContextValue {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  // Get stored theme preference or default to 'system'
  const getStoredTheme = (): Theme => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch (error) {
      console.error('Failed to read theme from localStorage:', error);
    }
    return 'system';
  };

  // Detect system theme preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Get current theme from localStorage
  const currentTheme = getStoredTheme();

  // Resolve the actual theme to apply
  const resolvedTheme: 'light' | 'dark' =
    currentTheme === 'system' ? getSystemTheme() : currentTheme;

  // Set theme and persist to localStorage
  const setTheme = (theme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);

      // Apply the resolved theme
      const themeToApply = theme === 'system' ? getSystemTheme() : theme;
      setColorScheme(themeToApply);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  };

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (currentTheme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? 'dark' : 'light');
    };

    // Set initial theme on mount
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [currentTheme, setColorScheme]);

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    const themeToApply = storedTheme === 'system' ? getSystemTheme() : storedTheme;

    // Only set if different from current
    if (colorScheme !== themeToApply) {
      setColorScheme(themeToApply);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return {
    theme: currentTheme,
    setTheme,
    resolvedTheme,
  };
}
