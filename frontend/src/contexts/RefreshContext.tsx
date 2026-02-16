import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Refresh interval options in milliseconds
 */
export const REFRESH_INTERVALS = {
  OFF: 0,
  '5s': 5000,
  '10s': 10000,
  '15s': 15000,
  '30s': 30000,
  '1m': 60000,
  '2m': 120000,
  '5m': 300000,
} as const;

export type RefreshInterval = typeof REFRESH_INTERVALS[keyof typeof REFRESH_INTERVALS];

interface RefreshContextValue {
  interval: RefreshInterval;
  setInterval: (interval: RefreshInterval) => void;
  isRefreshing: boolean;
  refresh: (scope?: string | string[]) => void;
  lastRefreshTime: number | null;
}

const RefreshContext = createContext<RefreshContextValue | undefined>(undefined);

interface RefreshProviderProps {
  children: ReactNode;
  defaultInterval?: RefreshInterval;
}

/**
 * RefreshProvider manages global auto-refresh state
 * 
 * Features:
 * - Configurable refresh intervals (5s, 10s, 15s, 30s, 1m, 2m, 5m, or off)
 * - Manual refresh trigger
 * - Last refresh timestamp tracking
 * - Refresh state indicator
 * - Persists interval selection to localStorage
 * - Tracks automatic query refetches to update lastRefreshTime
 */
export function RefreshProvider({ children, defaultInterval = REFRESH_INTERVALS['15s'] }: RefreshProviderProps) {
  // Load interval from localStorage or use default
  const loadInterval = (): RefreshInterval => {
    try {
      const stored = localStorage.getItem('secan-refresh-interval');
      if (stored) {
        const parsed = Number(stored);
        // Validate that it's a valid interval
        if (Object.values(REFRESH_INTERVALS).includes(parsed as RefreshInterval)) {
          return parsed as RefreshInterval;
        }
      }
    } catch (error) {
      console.error('Failed to load refresh interval from localStorage:', error);
    }
    return defaultInterval;
  };

  const queryClient = useQueryClient();
  const [interval, setIntervalState] = useState<RefreshInterval>(loadInterval);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(Date.now());

  // Track automatic query refetches to update lastRefreshTime
  useEffect(() => {
    if (interval === 0) return;

    // Subscribe to query cache updates
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // When any query successfully fetches, update lastRefreshTime
      if (event?.type === 'updated' && event?.action?.type === 'success') {
        setLastRefreshTime(Date.now());
      }
    });

    return unsubscribe;
  }, [queryClient, interval]);

  const setInterval = useCallback((newInterval: RefreshInterval) => {
    setIntervalState(newInterval);
    // Save to localStorage for persistence
    localStorage.setItem('secan-refresh-interval', String(newInterval));
  }, []);

  const refresh = useCallback((scope?: string | string[]) => {
    setIsRefreshing(true);
    setLastRefreshTime(Date.now());
    
    // Invalidate queries based on scope
    if (scope) {
      const scopes = Array.isArray(scope) ? scope : [scope];
      scopes.forEach(s => {
        queryClient.invalidateQueries({ queryKey: [s] });
      });
    } else {
      // If no scope provided, invalidate all queries (backward compatibility)
      queryClient.invalidateQueries();
    }
    
    // Reset refreshing state after a short delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  }, [queryClient]);

  return (
    <RefreshContext.Provider
      value={{
        interval,
        setInterval,
        isRefreshing,
        refresh,
        lastRefreshTime,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

/**
 * Hook to access refresh context
 */
export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within RefreshProvider');
  }
  return context;
}

/**
 * Hook to get the current refresh interval for use with TanStack Query
 * Returns false when refresh is disabled
 */
export function useRefreshInterval(): number | false {
  const { interval } = useRefresh();
  return interval === 0 ? false : interval;
}
