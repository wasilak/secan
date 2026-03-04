import { useMemo } from 'react';
import { useRefreshInterval } from '../contexts/RefreshContext';

/**
 * Hook to calculate optimal cache duration based on refresh interval
 * 
 * Cache duration should be longer than the refresh interval to ensure:
 * - Manual/automatic refreshes always hit cache initially
 * - Background jobs can update data while cache serves stale data
 * - Reduces unnecessary API calls while maintaining data freshness
 * 
 * Strategy:
 * - If refresh is OFF: use 5 minutes (300s)
 * - Otherwise: use refresh interval * 1.5 (rounded up)
 * 
 * Examples:
 * - Refresh: 5s  → Cache: 7.5s
 * - Refresh: 15s → Cache: 22.5s
 * - Refresh: 30s → Cache: 45s
 * - Refresh: 1m  → Cache: 90s
 */
export function useCacheDuration(): number {
  const refreshInterval = useRefreshInterval();

  return useMemo(() => {
    if (refreshInterval === false) {
      // Refresh is OFF: use 5 minutes
      return 5 * 60 * 1000;
    }

    // Calculate cache as 1.5x the refresh interval (minimum 3 seconds)
    const cacheDuration = Math.ceil(refreshInterval * 1.5);
    return Math.max(cacheDuration, 3000); // Minimum 3 seconds
  }, [refreshInterval]);
}
