import { useEffect, useState } from 'react';
import { useMantineColorScheme } from '@mantine/core';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const THEME_STORAGE_KEY = 'secan-theme';

const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'system';
};

/**
 * Hook for managing application theme (light, dark, system).
 *
 * - 'system' maps to Mantine's 'auto' color scheme so the browser's OS
 *   preference is followed natively — no manual media query listener needed.
 * - Theme label state is kept in React state so the UI always reflects the
 *   selected option even when the resolved color doesn't change (e.g. switching
 *   from 'light' to 'system' while the OS is also light).
 * - ThemeInitializer handles the initial application of the stored preference
 *   at app start; this hook does not duplicate that work.
 */
export function useTheme(): ThemeContextValue {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  // resolvedTheme comes from Mantine's own resolved value — correct even in
  // 'auto' mode where colorScheme is always 'light' or 'dark'.
  const resolvedTheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light';

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      setThemeState(newTheme);
      // 'system' → Mantine 'auto': lets the browser follow OS preference natively
      setColorScheme(newTheme === 'system' ? 'auto' : newTheme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  };

  return { theme, setTheme, resolvedTheme };
}
