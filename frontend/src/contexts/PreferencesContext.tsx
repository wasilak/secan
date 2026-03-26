import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types/preferences';

const PREFERENCES_STORAGE_KEY = 'secan-preferences';

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };

    const parsed = JSON.parse(stored);
    return {
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
          ? parsed.theme
          : DEFAULT_PREFERENCES.theme,
      refreshInterval:
        typeof parsed.refreshInterval === 'number' && parsed.refreshInterval > 0
          ? parsed.refreshInterval
          : DEFAULT_PREFERENCES.refreshInterval,
      lastSelectedCluster:
        typeof parsed.lastSelectedCluster === 'string'
          ? parsed.lastSelectedCluster
          : undefined,
      restConsoleHistory: Array.isArray(parsed.restConsoleHistory)
        ? parsed.restConsoleHistory
        : DEFAULT_PREFERENCES.restConsoleHistory,
      defaultConsoleWidth:
        typeof parsed.defaultConsoleWidth === 'number' && parsed.defaultConsoleWidth > 0
          ? parsed.defaultConsoleWidth
          : DEFAULT_PREFERENCES.defaultConsoleWidth,
      clusterConsoleStates:
        typeof parsed.clusterConsoleStates === 'object' && parsed.clusterConsoleStates !== null
          ? parsed.clusterConsoleStates
          : DEFAULT_PREFERENCES.clusterConsoleStates,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * PreferencesProvider manages user preferences as a single shared React Context.
 *
 * This ensures all consumers (e.g. useConsoleHistory, ConsolePanelContext) share
 * the same preferences state, so writes from one location are immediately visible
 * everywhere else — fixing the console history not persisting across components.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  }, [preferences]);

  // Sync state if another tab/window updates localStorage
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCES_STORAGE_KEY && event.newValue) {
        try {
          setPreferences(JSON.parse(event.newValue));
        } catch {
          // ignore malformed data from other tabs
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFERENCES });
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

/**
 * Hook to access the shared preferences context.
 * Must be used inside PreferencesProvider.
 */
export function usePreferencesContext(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferencesContext must be used within PreferencesProvider');
  }
  return ctx;
}
