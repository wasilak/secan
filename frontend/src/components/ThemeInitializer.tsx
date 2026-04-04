import { useMantineColorScheme } from '@mantine/core';
import { useEffect } from 'react';

const THEME_STORAGE_KEY = 'secan-theme';

/**
 * ThemeInitializer applies the stored theme preference once on app start
 * and mirrors Mantine's resolved color scheme onto the document element.
 *
 * Deliberately does NOT call useTheme() — multiple hook instances each carry
 * their own useState and their effects conflict with each other when
 * setColorScheme triggers a Mantine-wide re-render.
 */
export function ThemeInitializer() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  // Apply stored preference once on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setColorScheme(stored);
      } else {
        // 'system' or missing → let Mantine follow OS natively
        setColorScheme('auto');
      }
    } catch {
      // ignore in restricted environments
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror resolved color scheme onto documentElement for CSS targeting
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-secan-color-scheme', colorScheme ?? 'light');
    } catch {
      // ignore in SSR or restricted environments
    }
  }, [colorScheme]);

  return null;
}
