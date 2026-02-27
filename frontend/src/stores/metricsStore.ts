import { create } from 'zustand';
import type { TimeRange, ClusterMetrics } from '../types/api';

/**
 * Metrics store state interface
 * Manages metrics data, time range selection, and loading state
 *
 * Requirements: 10.0
 */
interface MetricsStoreState {
  // Data
  metricsData: ClusterMetrics[];
  selectedTimeRange: TimeRange | null;
  refreshInterval: number; // in milliseconds

  // Loading state
  isLoading: boolean;
  error: Error | null;

  // Actions
  setMetrics: (metrics: ClusterMetrics[]) => void;
  setTimeRange: (timeRange: TimeRange) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setRefreshInterval: (interval: number) => void;

  // Derived selectors
  getMetricsForTimeRange: (timeRange?: TimeRange) => ClusterMetrics[];
  getLatestMetrics: () => ClusterMetrics | null;
  getMetricsStats: () => {
    minTimestamp: number | null;
    maxTimestamp: number | null;
    count: number;
    healthStatus: Record<string, number>;
  };

  // Reset
  reset: () => void;
}

/**
 * Default time range: last 24 hours
 */
function getDefaultTimeRange(): TimeRange {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400; // 24 hours in seconds
  return {
    start: oneDayAgo,
    end: now,
    label: 'Last 24h',
  };
}

/**
 * Metrics store for managing cluster metrics data and UI state
 *
 * Features:
 * - Store metrics data points with timestamps
 * - Manage selected time range for Prometheus queries
 * - Handle loading and error states
 * - Provide derived selectors for metrics analysis
 * - Support auto-refresh with configurable intervals
 *
 * Integration:
 * - Used with React Query for data fetching
 * - Integrated with TimeRangeSelector component
 * - Used by statistics and metrics display components
 */
export const useMetricsStore = create<MetricsStoreState>((set, get) => ({
  // Initial state
  metricsData: [],
  selectedTimeRange: getDefaultTimeRange(),
  refreshInterval: 30000, // 30 seconds
  isLoading: false,
  error: null,

  // Actions
  setMetrics: (metrics: ClusterMetrics[]) => {
    set({ metricsData: metrics });
  },

  setTimeRange: (timeRange: TimeRange) => {
    set({ selectedTimeRange: timeRange });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: Error | null) => {
    set({ error });
  },

  setRefreshInterval: (interval: number) => {
    set({ refreshInterval: Math.max(interval, 5000) }); // Minimum 5 seconds
  },

  // Derived selectors
  getMetricsForTimeRange: (timeRange?: TimeRange) => {
    const state = get();
    const range = timeRange || state.selectedTimeRange;

    if (!range) {
      return state.metricsData;
    }

    return state.metricsData.filter(
      (metric) => metric.timestamp >= range.start && metric.timestamp <= range.end
    );
  },

  getLatestMetrics: () => {
    const state = get();
    if (state.metricsData.length === 0) return null;
    return state.metricsData[state.metricsData.length - 1];
  },

  getMetricsStats: () => {
    const state = get();
    const metrics = state.metricsData;

    if (metrics.length === 0) {
      return {
        minTimestamp: null,
        maxTimestamp: null,
        count: 0,
        healthStatus: {},
      };
    }

    // Calculate health status distribution
    const healthStatus: Record<string, number> = {
      green: 0,
      yellow: 0,
      red: 0,
    };

    metrics.forEach((metric) => {
      healthStatus[metric.health] = (healthStatus[metric.health] || 0) + 1;
    });

    return {
      minTimestamp: Math.min(...metrics.map((m) => m.timestamp)),
      maxTimestamp: Math.max(...metrics.map((m) => m.timestamp)),
      count: metrics.length,
      healthStatus,
    };
  },

  // Reset state
  reset: () => {
    set({
      metricsData: [],
      selectedTimeRange: getDefaultTimeRange(),
      refreshInterval: 30000,
      isLoading: false,
      error: null,
    });
  },
}));

export default useMetricsStore;
