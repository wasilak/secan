/**
 * Hook for managing user preferences with localStorage persistence.
 *
 * Delegates to PreferencesContext so all consumers share a single state instance —
 * this is the fix for console history not persisting across components.
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
export { usePreferencesContext as usePreferences } from '../contexts/PreferencesContext';
