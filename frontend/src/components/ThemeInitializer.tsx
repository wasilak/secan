import { useTheme } from '../hooks/useTheme';

/**
 * ThemeInitializer component ensures theme listener is active at app root
 * This guarantees system theme changes are detected even when theme selector isn't visible
 */
export function ThemeInitializer() {
  // Call the hook to ensure listeners are set up
  useTheme();

  // This component doesn't render anything - it's just for side effects
  return null;
}
