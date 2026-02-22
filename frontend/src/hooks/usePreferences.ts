import { useState, useCallback, useEffect } from 'react';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types/preferences';

const PREFERENCES_STORAGE_KEY = 'secan-preferences';

/**
 * Hook for managing user preferences with localStorage persistence
 *
 * Provides:
 * - Type-safe access to user preferences
 * - Automatic persistence to localStorage
 * - Graceful handling of corrupted data
 * - Reset functionality to restore defaults
 *
 * Preferences include:
 * - Theme (light, dark, system)
 * - Refresh interval for auto-updating data
 * - Last selected cluster for quick navigation
 * - REST console history
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { preferences, updatePreference, resetPreferences } = usePreferences();
 *
 *   return (
 *     <div>
 *       <p>Refresh interval: {preferences.refreshInterval}ms</p>
 *       <button onClick={() => updatePreference('refreshInterval', 60000)}>
 *         Set to 60s
 *       </button>
 *       <button onClick={resetPreferences}>Reset to defaults</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePreferences() {
  // Load preferences from localStorage or use defaults
  const loadPreferences = useCallback((): UserPreferences => {
    try {
      const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);

      if (!stored) {
        return { ...DEFAULT_PREFERENCES };
      }

      const parsed = JSON.parse(stored);

      // Validate that parsed data has the expected structure
      // If any required fields are missing or invalid, use defaults
      const preferences: UserPreferences = {
        theme:
          parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
            ? parsed.theme
            : DEFAULT_PREFERENCES.theme,

        refreshInterval:
          typeof parsed.refreshInterval === 'number' && parsed.refreshInterval > 0
            ? parsed.refreshInterval
            : DEFAULT_PREFERENCES.refreshInterval,

        lastSelectedCluster:
          typeof parsed.lastSelectedCluster === 'string' ? parsed.lastSelectedCluster : undefined,

        restConsoleHistory: Array.isArray(parsed.restConsoleHistory)
          ? parsed.restConsoleHistory
          : DEFAULT_PREFERENCES.restConsoleHistory,
      };

      return preferences;
    } catch (error) {
      console.error('Failed to load preferences from localStorage:', error);
      console.warn('Using default preferences due to corrupted data');
      return { ...DEFAULT_PREFERENCES };
    }
  }, []);

  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  }, [preferences]);

  /**
   * Update a single preference value
   *
   * @param key - The preference key to update
   * @param value - The new value for the preference
   *
   * @example
   * ```tsx
   * updatePreference('theme', 'dark');
   * updatePreference('refreshInterval', 60000);
   * updatePreference('lastSelectedCluster', 'prod-main');
   * ```
   */
  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  /**
   * Reset all preferences to default values
   *
   * This clears all stored preferences and restores the application
   * to its default state. The default preferences will be saved to
   * localStorage automatically.
   *
   * @example
   * ```tsx
   * <button onClick={resetPreferences}>Reset to defaults</button>
   * ```
   */
  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFERENCES });
  }, []);

  return {
    preferences,
    updatePreference,
    resetPreferences,
  };
}
