import { useState, useMemo, useEffect, useCallback } from 'react';
import { NodeDetailStats, ShardInfo, NodeRole } from '../types/api';

/**
 * Topology Filters Interface
 */
export interface TopologyFilters {
  nodeRoles?: string[];
  nodeHealth?: string[];
  indexHealth?: string[];
  shardState?: string[];
  nodeSearch?: string;
  indexSearch?: string;
}

/**
 * Hook for managing topology filter state
 *
 * Features:
 * - Shared filter state across views
 * - URL state synchronization
 * - Filter application to nodes and shards
 *
 * @param initialFilters - Initial filter values
 */
export function useTopologyFilters(initialFilters?: TopologyFilters) {
  const [filters, setFilters] = useState<TopologyFilters>(initialFilters || {});

  // Update filter
  const updateFilter = useCallback(<K extends keyof TopologyFilters>(
    key: K,
    value: TopologyFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Clear specific filter
  const clearFilter = useCallback(<K extends keyof TopologyFilters>(key: K) => {
    setFilters((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }, []);

  return {
    filters,
    updateFilter,
    clearFilters,
    clearFilter,
  };
}

/**
 * Hook for filtering topology data
 *
 * Applies filters to nodes and shards efficiently with memoization
 *
 * @param nodes - All nodes
 * @param shards - All shards
 * @param filters - Active filters
 */
export function useFilteredTopologyData(
  nodes: NodeDetailStats[],
  shards: ShardInfo[],
  filters: TopologyFilters
) {
  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // Node role filter
      if (filters.nodeRoles && filters.nodeRoles.length > 0) {
        const hasRole = node.roles?.some((role: NodeRole) =>
          filters.nodeRoles?.includes(role)
        );
        if (!hasRole) return false;
      }

      // Node search filter
      if (filters.nodeSearch) {
        const searchLower = filters.nodeSearch.toLowerCase();
        const matchesName = node.name.toLowerCase().includes(searchLower);
        const matchesIp = node.ip?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesIp) return false;
      }

      return true;
    });
  }, [nodes, filters.nodeRoles, filters.nodeSearch]);

  // Filter shards
  const filteredShards = useMemo(() => {
    return shards.filter((shard) => {
      // Index search filter
      if (filters.indexSearch) {
        if (!shard.index.toLowerCase().includes(filters.indexSearch.toLowerCase())) {
          return false;
        }
      }

      // Shard state filter
      if (filters.shardState && filters.shardState.length > 0) {
        if (!filters.shardState.includes(shard.state)) return false;
      }

      return true;
    });
  }, [shards, filters.indexSearch, filters.shardState]);

  return { filteredNodes, filteredShards };
}

/**
 * Hook for debouncing values
 *
 * Useful for debouncing filter inputs to improve performance
 *
 * @param value - Value to debounce
 * @param delay - Debounce delay in ms (default: 300)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
