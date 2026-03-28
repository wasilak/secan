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

export type RefreshInterval = (typeof REFRESH_INTERVALS)[keyof typeof REFRESH_INTERVALS];

// ---------------------------------------------------------------------------
// State context — holds values that change frequently (re-render sensitive)
// ---------------------------------------------------------------------------

interface RefreshStateContextValue {
  isRefreshing: boolean;
  lastRefreshTime: number | null;
}

const RefreshStateContext = createContext<RefreshStateContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Action context — holds stable callbacks and config (rarely re-renders)
// ---------------------------------------------------------------------------

interface RefreshActionContextValue {
  interval: RefreshInterval;
  setInterval: (interval: RefreshInterval) => void;
  refresh: (scope?: string | string[]) => void;
  pausePolling: (reason: 'drag') => void;
  resumePolling: (reason: 'drag') => void;
  paused: boolean;
  pausedByDrag: boolean;
}

const RefreshActionContext = createContext<RefreshActionContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Legacy combined context (kept for backward compatibility)
// ---------------------------------------------------------------------------

interface RefreshContextValue extends RefreshStateContextValue, RefreshActionContextValue {}

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
export function RefreshProvider({
  children,
  defaultInterval = REFRESH_INTERVALS['15s'],
}: RefreshProviderProps) {
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
  // --- New state for drag-aware pause ---
  const [pausedByDrag, setPausedByDrag] = useState(false);

  // Calculate optimal cache duration based on refresh interval
  const calculateCacheDuration = (refreshInterval: RefreshInterval): number => {
    if (refreshInterval === 0) {
      // Refresh is OFF: use 5 minutes
      return 5 * 60 * 1000;
    }
    // Cache should be 1.5x the refresh interval to ensure manual/auto refreshes hit cache
    // while background jobs update data (minimum 3 seconds)
    const cacheDuration = Math.ceil(refreshInterval * 1.5);
    return Math.max(cacheDuration, 3000);
  };

  // Update query client cache when refresh interval changes
  useEffect(() => {
    const cacheDuration = calculateCacheDuration(interval);
    queryClient.setDefaultOptions({
      queries: {
        staleTime: cacheDuration,
        refetchOnWindowFocus: false,
        retry: 1,
        refetchIntervalInBackground: false, // Pause polling when tab/window is not visible
      },
    });
  }, [queryClient, interval]);

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

  // ---- Polling pause/resume logic ----
  const pausePolling = useCallback((reason: 'drag') => {
    if (reason === 'drag') setPausedByDrag(true);
  }, []);
  const resumePolling = useCallback((reason: 'drag') => {
    if (reason === 'drag') setPausedByDrag(false);
  }, []);

  // Compute paused: only currently supporting 'drag' but may add more
  const paused = interval !== 0 && pausedByDrag;


  const refresh = useCallback(
    (scope?: string | string[]) => {
      setIsRefreshing(true);
      setLastRefreshTime(Date.now());

      // Invalidate queries based on scope
      if (scope) {
        const scopes = Array.isArray(scope) ? scope : [scope];
        scopes.forEach((s) => {
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
    },
    [queryClient]
  );

  const stateValue: RefreshStateContextValue = { isRefreshing, lastRefreshTime };
  const actionValue: RefreshActionContextValue = {
    interval,
    setInterval,
    refresh,
    pausePolling,
    resumePolling,
    paused,
    pausedByDrag
  };
  const combinedValue: RefreshContextValue = { ...stateValue, ...actionValue };

  return (
    <RefreshStateContext.Provider value={stateValue}>
      <RefreshActionContext.Provider value={actionValue}>
        <RefreshContext.Provider value={combinedValue}>
          {children}
        </RefreshContext.Provider>
      </RefreshActionContext.Provider>
    </RefreshStateContext.Provider>
  );
}

/**
 * Hook to access only the refresh state (isRefreshing, lastRefreshTime).
 * Components that only need state should use this to avoid re-rendering when
 * actions or config change.
 */
export function useRefreshState(): RefreshStateContextValue {
  const context = useContext(RefreshStateContext);
  if (!context) {
    throw new Error('useRefreshState must be used within RefreshProvider');
  }
  return context;
}

/**
 * Hook to access only refresh actions (interval, setInterval, refresh).
 * Components that only trigger refresh should use this to avoid re-rendering when
 * isRefreshing or lastRefreshTime change.
 */
export function useRefreshActions(): RefreshActionContextValue {
  const context = useContext(RefreshActionContext);
  if (!context) {
    throw new Error('useRefreshActions must be used within RefreshProvider');
  }
  return context;
}

/**
 * Returns only the paused state (true if polling is paused for any reason)
 */
export function useRefreshPaused() {
  const { paused } = useRefreshActions();
  return paused;
}

/**
 * Hook to access refresh context (all fields).
 * Prefer useRefreshState or useRefreshActions for better performance.
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
  const { interval, paused } = useRefreshActions();
  return interval === 0 || paused ? false : interval;
}
