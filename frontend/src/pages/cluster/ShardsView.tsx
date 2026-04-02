import { Grid, Group, Stack } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { ShardStatsCards } from '../../components/ShardStatsCards';
import { FilterSidebar } from '../../components/FacetedFilter';
import { TablePagination } from '../../components/TablePagination';
import { ShardsList } from '../ClusterView';
import { SHARD_STATE_COLORS, SHARD_TYPE_COLORS } from '../../utils/colors';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';
import type { ShardInfo, PaginatedResponse } from '../../types/api';
import { useRefreshInterval } from '../../contexts/RefreshContext';

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
    queryFn: () => apiClient.getShards(clusterId, shardsPage, 50, shardsFilters),
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
