import { Grid, Group, Stack } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { MultiSelect } from '@mantine/core';
import { useClusterNodes } from '../../hooks/useClusterNodes';

import { ShardStatsCards } from '../../components/ShardStatsCards';
import { FilterSidebar } from '../../components/FacetedFilter';
import { TablePagination } from '../../components/TablePagination';
import { ShardsList } from '../ClusterView';
import { SHARD_STATE_COLORS, SHARD_TYPE_COLORS } from '../../utils/colors';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';
import type { ShardInfo, PaginatedResponse } from '../../types/api';
import { useRefreshInterval } from '../../contexts/RefreshContext';

// Local small component to fetch nodes and render a MultiSelect wired to nodeFilter search param.
function NodeMultiSelect({
  clusterId,
  searchParams,
  setSearchParams,
}: {
  clusterId: string;
  searchParams: URLSearchParams;
  // keep loose type to match useSearchParams setter signature
  setSearchParams: (p: URLSearchParams, opts?: any) => void;
}) {
  const { data: nodesPaginated } = useClusterNodes(clusterId, {
    page: 1,
    pageSize: 1000,
    filters: { search: '' },
    enabled: !!clusterId,
    placeholderData: (prev) => prev,
  });

  const options = (nodesPaginated?.items ?? []).map((n) => ({ value: n.id, label: n.name || n.id }));

  const selected = (searchParams.get('nodeFilter') || '').split(',').filter(Boolean);

  const onChange = (values: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (values && values.length > 0) {
      params.set('nodeFilter', values.join(','));
    } else {
      params.delete('nodeFilter');
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div style={{ padding: '0 8px' }}>
      <MultiSelect
        data={options}
        placeholder="Filter by node..."
        searchable
        nothingFoundMessage="No nodes"
        value={selected}
        onChange={onChange}
        clearable
        aria-label="Filter shards by node"
      />
    </div>
  );
}

interface ShardsViewProps {
  clusterId: string;
}

export function ShardsView({ clusterId }: ShardsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshInterval = useRefreshInterval();

  // Shards search filter with URL sync and debounce
  const shardsSearch = searchParams.get('shardsSearch') || '';
  const [localShardsSearch, setLocalShardsSearch] = useState(shardsSearch);

  useEffect(() => {
    setLocalShardsSearch(searchParams.get('shardsSearch') || '');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localShardsSearch !== searchParams.get('shardsSearch')) {
        const newParams = new URLSearchParams(searchParams);
        if (localShardsSearch) {
          newParams.set('shardsSearch', localShardsSearch);
        } else {
          newParams.delete('shardsSearch');
        }
        setSearchParams(newParams, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localShardsSearch, searchParams, setSearchParams]);

  const selectedShardStates = searchParams.get('shardStates')?.split(',').filter(Boolean) || [
    'STARTED',
    'INITIALIZING',
    'RELOCATING',
    'UNASSIGNED',
  ];
  const showShardPrimaries = searchParams.get('showPrimaries') !== 'false';
  const showShardReplicas = searchParams.get('showReplicas') !== 'false';

  const updateShardsFilters = (newStates?: string[], newShowPrimaries?: boolean, newShowReplicas?: boolean) => {
    const params = new URLSearchParams(searchParams);

    if (newStates !== undefined) {
      if (newStates.length > 0) {
        params.set('shardStates', newStates.join(','));
      } else {
        params.delete('shardStates');
      }
    }

    if (newShowPrimaries !== undefined) {
      if (newShowPrimaries) {
        params.delete('showPrimaries');
      } else {
        params.set('showPrimaries', 'false');
      }
    }

    if (newShowReplicas !== undefined) {
      if (newShowReplicas) {
        params.delete('showReplicas');
      } else {
        params.set('showReplicas', 'false');
      }
    }

    setSearchParams(params, { replace: true });
  };

  const updateShardsParam = (key: string, value: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, 'true');
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams, { replace: true });
  };

  const [shardsPage, setShardsPage] = useState(1);

  const shardsFilters = useMemo(
    () => ({
      hide_special: searchParams.get('showSpecial') !== 'true',
      show_primaries: showShardPrimaries,
      show_replicas: showShardReplicas,
      // Pass node filter through to API (comma-separated node ids)
      node: searchParams.get('nodeFilter') || '',
      state: searchParams.get('shardStates') || '',
      search: searchParams.get('shardsSearch') || '',
    }),
    [searchParams, showShardPrimaries, showShardReplicas]
  );

  const {
    data: shardsPaginated,
    isLoading: shardsLoading,
    error: shardsError,
  } = useQuery<PaginatedResponse<ShardInfo>>({
    queryKey: queryKeys.cluster(clusterId).shards(shardsPage, shardsFilters),
    queryFn: async () => {
      // If multiple nodes selected, fetch per-node and merge results client-side
      const nodeParam = (shardsFilters as any).node as string | undefined;
      const nodes = nodeParam ? nodeParam.split(',').map((s) => s.trim()).filter(Boolean) : [];

      if (nodes.length <= 1) {
        // Single node (or none) - delegate to API which handles pagination server-side
        return apiClient.getShards(clusterId, shardsPage, 50, shardsFilters);
      }

      // Multiple nodes selected: fetch all pages per node and merge client-side.
      // Backend doesn't reliably return OR semantics for a comma-separated
      // node parameter, so we request shards per node and combine results.
      const perNodePageSize = 2000; // large page size to capture many shards per request
      const perNodeMaxItems = 10000; // safety cap to avoid unbounded fetches per node

      // Fetch pages sequentially for each node, but run nodes in parallel.
      const fetchAllForNode = async (nodeId: string): Promise<ShardInfo[]> => {
        const collected: ShardInfo[] = [];
        let page = 1;
        try {
          while (collected.length < perNodeMaxItems) {
            const resp = await apiClient.getShards(clusterId, page, perNodePageSize, { ...shardsFilters, node: nodeId });
            const items: ShardInfo[] = (resp as any).items ?? [];
            if (items.length > 0) collected.push(...items);
            // Stop when fewer than page size returned (last page) or no items
            if (items.length < perNodePageSize) break;
            page += 1;
          }
        } catch (e) {
          // Swallow errors per-node so a single failing node doesn't break the whole view
          // The error will surface via the overall query error state if needed.
          // eslint-disable-next-line no-console
          console.warn(`Failed fetching shards for node ${nodeId}:`, e);
        }
        return collected;
      };

      const perNodePromises = nodes.map((n) => fetchAllForNode(n));
      const perNodeResponses = await Promise.all(perNodePromises);
      const allItems: ShardInfo[] = perNodeResponses.flat();

      // Deduplicate by index:shard:primary:node
      const key = (s: ShardInfo) => `${s.index}:${s.shard}:${String(s.primary)}:${s.node ?? 'null'}`;
      const map = new Map<string, ShardInfo>();
      for (const s of allItems) {
        const k = key(s);
        if (!map.has(k)) map.set(k, s);
      }
      const merged = Array.from(map.values());

      const total = merged.length;
      const pageSize = 50;
      const totalPages = Math.ceil(total / pageSize);
      const page = Math.max(1, Math.min(shardsPage, totalPages || 1));
      const start = (page - 1) * pageSize;
      const pageItems = merged.slice(start, start + pageSize);

      return {
        items: pageItems,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      } as PaginatedResponse<ShardInfo>;
    },
    refetchInterval: refreshInterval,
    enabled: !!clusterId,
    placeholderData: (previousData) => previousData,
  });

  const shards = shardsPaginated?.items ?? [];

  const stats = {
    totalShards: shards?.length ?? 0,
    primaryShards: shards?.filter((s) => s.primary).length ?? 0,
    replicaShards: shards?.filter((s) => !s.primary).length ?? 0,
    unassignedShards: shards?.filter((s) => s.state === 'UNASSIGNED').length ?? 0,
    relocatingShards: shards?.filter((s) => s.state === 'RELOCATING').length ?? 0,
    initializingShards: shards?.filter((s) => s.state === 'INITIALIZING').length ?? 0,
  };

  return (
    <Grid gutter="md" overflow="hidden">
      <Grid.Col span={12}>
        <ShardStatsCards stats={stats} />
      </Grid.Col>
      <Grid.Col span={12}>
        <Group gap="md" wrap="nowrap" align="flex-start">
          <FilterSidebar
            textFilters={[
              {
                value: localShardsSearch,
                onChange: setLocalShardsSearch,
                placeholder: 'Filter shards...',
              },
            ]}
            conditionalSections={[
              {
                visible: true,
                content: (
                  // Node MultiSelect: values = node.id, labels = node.name
                  <NodeMultiSelect
                    clusterId={clusterId}
                    searchParams={searchParams}
                    setSearchParams={setSearchParams}
                  />
                ),
              },
            ]}
            categories={[
              {
                title: 'State',
                options: [
                  { label: 'Started', value: 'STARTED', color: SHARD_STATE_COLORS.STARTED },
                  { label: 'Initializing', value: 'INITIALIZING', color: SHARD_STATE_COLORS.INITIALIZING },
                  { label: 'Relocating', value: 'RELOCATING', color: SHARD_STATE_COLORS.RELOCATING },
                  { label: 'Unassigned', value: 'UNASSIGNED', color: SHARD_STATE_COLORS.UNASSIGNED },
                ],
                selected: selectedShardStates,
                onChange: (newStates) => updateShardsFilters(newStates, undefined, undefined),
              },
              {
                title: 'Type',
                options: [
                  { label: 'Primaries', value: 'primaries', color: SHARD_TYPE_COLORS.primaries },
                  { label: 'Replicas', value: 'replicas', color: SHARD_TYPE_COLORS.replicas },
                ],
                selected: [
                  ...(showShardPrimaries ? ['primaries'] : []),
                  ...(showShardReplicas ? ['replicas'] : []),
                ],
                onChange: (selected) => {
                  updateShardsFilters(undefined, selected.includes('primaries'), selected.includes('replicas'));
                },
              },
            ]}
            toggles={[
              {
                label: 'Show special indices',
                value: searchParams.get('showSpecial') === 'true',
                onChange: (val) => updateShardsParam('showSpecial', val),
              },
            ]}
          />
          <Stack gap="md" style={{ flex: 1 }}>
            <ShardsList
              shards={shards}
              loading={shardsLoading}
              error={shardsError as Error | null}
              hideStats
            />
            {shardsPaginated && shardsPaginated.total_pages > 1 && (
              <TablePagination
                simple
                currentPage={shardsPage}
                totalPages={shardsPaginated.total_pages}
                pageSize={50}
                totalItems={shardsPaginated.total}
                onPageChange={setShardsPage}
                onPageSizeChange={() => {}}
              />
            )}
          </Stack>
        </Group>
      </Grid.Col>
    </Grid>
  );
}
