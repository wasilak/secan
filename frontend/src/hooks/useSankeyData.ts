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
 * or states change. Parameter changes are debounced by 300 ms to avoid
 * flooding the backend while the user is typing/adjusting controls.
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (immediate: boolean) => {
      // Clear any pending debounce timer
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const doFetch = async () => {
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
      };

      if (immediate) {
        await doFetch();
      } else {
        debounceRef.current = setTimeout(() => {
          void doFetch();
        }, 300);
      }
    },
    [clusterId, topIndices, includeUnassigned, states]
  );

  // Run on mount and whenever deps change (debounced)
  useEffect(() => {
    void fetchData(false);

    return () => {
      // Cancel in-flight fetch and pending timer on unmount / dep change
      cancelledRef.current = true;
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [fetchData]);

  // Imperative refetch bypasses the debounce
  const refetch = useCallback(() => {
    void fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refetch };
}
