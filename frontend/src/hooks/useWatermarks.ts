import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Watermark thresholds for disk allocation
 */
export interface WatermarkThresholds {
  low: number; // Default 85% - warning threshold
  high: number; // Default 90% - no new shards allocated
  floodStage: number; // Default 95% - indices become read-only
}

/**
 * Default Elasticsearch watermark thresholds (as percentages)
 */
const DEFAULT_WATERMARKS: WatermarkThresholds = {
  low: 85,
  high: 90,
  floodStage: 95,
};

/**
 * Parse watermark value from Elasticsearch settings
 * Supports both percentage (e.g., "85%") and byte values (e.g., "10gb")
 * For byte values, we can't calculate percentage without knowing total disk size,
 * so we fall back to defaults
 */
function parseWatermark(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;

  // Handle percentage values like "85%"
  if (value.endsWith('%')) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // For byte values (e.g., "10gb"), we can't calculate percentage
  // without knowing total disk size, so return default
  return defaultValue;
}

/**
 * Extract watermark thresholds from cluster settings
 */
function extractWatermarks(settings: Record<string, unknown>): WatermarkThresholds {
  // Check transient settings first, then persistent, then defaults
  const transient = settings.transient as Record<string, unknown> | undefined;
  const persistent = settings.persistent as Record<string, unknown> | undefined;
  const defaults = settings.defaults as Record<string, unknown> | undefined;

  // Navigate through nested structure: cluster.routing.allocation.disk.watermark.*
  const getWatermarkValue = (key: string): string | undefined => {
    for (const source of [transient, persistent, defaults]) {
      if (!source) continue;

      const cluster = source.cluster as Record<string, unknown> | undefined;
      const routing = cluster?.routing as Record<string, unknown> | undefined;
      const allocation = routing?.allocation as Record<string, unknown> | undefined;
      const disk = allocation?.disk as Record<string, unknown> | undefined;
      const watermark = disk?.watermark as Record<string, unknown> | undefined;

      const value = watermark?.[key];
      if (value !== undefined) {
        return String(value);
      }
    }
    return undefined;
  };

  return {
    low: parseWatermark(getWatermarkValue('low'), DEFAULT_WATERMARKS.low),
    high: parseWatermark(getWatermarkValue('high'), DEFAULT_WATERMARKS.high),
    floodStage: parseWatermark(getWatermarkValue('flood_stage'), DEFAULT_WATERMARKS.floodStage),
  };
}

/**
 * Get color for progress bar based on watermark thresholds
 */
export function getWatermarkColor(percent: number, watermarks: WatermarkThresholds): string {
  if (percent >= watermarks.floodStage) {
    return 'red';
  } else if (percent >= watermarks.high) {
    return 'orange';
  } else if (percent >= watermarks.low) {
    return 'yellow';
  }
  return 'blue';
}

/**
 * Hook to fetch and parse Elasticsearch watermark thresholds
 *
 * @param clusterId - Cluster ID to fetch settings for
 * @param enabled - Whether to enable the query (default: true)
 * @returns Watermark thresholds and query state
 */
export function useWatermarks(clusterId: string | undefined, enabled: boolean = true) {
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster', clusterId, 'watermarks'],
    queryFn: async () => {
      if (!clusterId) throw new Error('Cluster ID is required');

      // Fetch cluster settings with defaults to get watermark values
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        '/_cluster/settings?include_defaults=true&flat_settings=false'
      );

      return response;
    },
    enabled: enabled && !!clusterId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - watermarks don't change often
    refetchOnWindowFocus: false,
  });

  const watermarks = settings ? extractWatermarks(settings) : DEFAULT_WATERMARKS;

  return {
    watermarks,
    isLoading,
    error,
    // Helper function to get color for a given percentage
    getColor: (percent: number) => getWatermarkColor(percent, watermarks),
  };
}
