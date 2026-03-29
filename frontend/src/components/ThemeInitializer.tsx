import { useTheme } from '../hooks/useTheme';
import { useMantineColorScheme } from '@mantine/core';
import { useEffect } from 'react';

/**
 * ThemeInitializer component ensures theme listener is active at app root
 * This guarantees system theme changes are detected even when theme selector isn't visible
 */
export function ThemeInitializer() {
  // Call the hook to ensure listeners are set up
  useTheme();
  const { colorScheme } = useMantineColorScheme();

  // Mirror Mantine color scheme onto the documentElement so CSS can target it
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-secan-color-scheme', colorScheme ?? 'light');
    } catch (err) {
      // ignore in SSR or restricted environments
    }
  }, [colorScheme]);

  // This component doesn't render anything - it's just for side effects
  return null;
}
