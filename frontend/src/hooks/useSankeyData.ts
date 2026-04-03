import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { SankeyResponse, SankeyQueryParams } from '../types/api';

export interface UseSankeyDataOptions {
  clusterId: string;
  topIndices: number;
  includeUnassigned: boolean;
  states?: string[];
  /** When true the backend excludes dot-prefixed indices before top-N ranking. */
  excludeSpecial?: boolean;
  /** Criterion used to rank and select the top-N indices (default: "shards"). */
  sortBy?: 'shards' | 'primary' | 'replicas' | 'store';
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
  const { clusterId, topIndices, includeUnassigned, states, excludeSpecial, sortBy } = options;

  const [data, setData] = useState<SankeyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);

  // Monotonically-increasing fetch ID. Each call to fetchData captures the
  // current ID; results are discarded if a newer fetch has started by the time
  // the response arrives. This prevents stale responses from overwriting newer
  // data when deps change rapidly (e.g. the user clicks Apply while a previous
  // fetch is still in-flight).
  const fetchIdRef = useRef<number>(0);

  // Stable string key for the states array so the useCallback dep stays stable
  // even when the caller passes a new array reference with the same values.
  const statesKey = states && states.length > 0 ? states.slice().sort().join(',') : '';

  const fetchData = useCallback(async () => {
    const myId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);

    const params: SankeyQueryParams = {
      topIndices,
      includeUnassigned,
      states: statesKey || undefined,
      excludeSpecial: excludeSpecial ?? false,
      sortBy: sortBy ?? 'shards',
    };

    try {
      const result = await apiClient.getSankeyData(clusterId, params);
      if (fetchIdRef.current === myId) {
        setData(result);
        setLoading(false);
      }
    } catch (err: unknown) {
      if (fetchIdRef.current === myId) {
        setError(err);
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId, topIndices, includeUnassigned, statesKey, excludeSpecial, sortBy]);

  // Run on mount and whenever deps change
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Imperative refetch
  const refetch = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
