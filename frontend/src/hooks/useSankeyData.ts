import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { SankeyResponse, SankeyQueryParams } from '../types/api';

export interface UseSankeyDataOptions {
  clusterId: string;
  topIndices: number;
  includeUnassigned: boolean;
  states?: string[];
}

export interface UseSankeyDataResult {
  data: SankeyResponse | null;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Hook that fetches Sankey topology data for a cluster.
 *
 * Re-fetches automatically whenever clusterId, topIndices, includeUnassigned,
 * or states change. Callers should only change topIndices on an explicit user
 * action (e.g. clicking an Apply button) to avoid unnecessary backend requests.
 *
 * Requirements: topology-sankey-view 4.2, 4.3
 */
export function useSankeyData(options: UseSankeyDataOptions): UseSankeyDataResult {
  const { clusterId, topIndices, includeUnassigned, states } = options;

  const [data, setData] = useState<SankeyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);

  // Keep a stable ref to a cancel flag so stale fetches do not overwrite state.
  const cancelledRef = useRef<boolean>(false);

  const fetchData = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    const params: SankeyQueryParams = {
      topIndices,
      includeUnassigned,
      states: states && states.length > 0 ? states.join(',') : undefined,
    };

    try {
      const result = await apiClient.getSankeyData(clusterId, params);
      if (!cancelledRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err: unknown) {
      if (!cancelledRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [clusterId, topIndices, includeUnassigned, states]);

  // Run on mount and whenever deps change
  useEffect(() => {
    void fetchData();

    return () => {
      // Cancel in-flight fetch on unmount / dep change
      cancelledRef.current = true;
    };
  }, [fetchData]);

  // Imperative refetch
  const refetch = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
