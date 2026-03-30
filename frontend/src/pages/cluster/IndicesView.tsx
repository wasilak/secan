import { Grid, Group, Stack } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';
import type { ShardInfo, PaginatedResponse } from '../../types/api';
import { IconPlus, IconEyeOff } from '@tabler/icons-react';

import { useClusterIndices } from '../../hooks/useClusterIndices';
import { IndexStatsCards } from '../../components/IndexStatsCards';
import { TablePagination } from '../../components/TablePagination';
import { FilterSidebar } from '../../components/FacetedFilter';
import { IndicesList } from '../ClusterView';
import { useClusterNavigation } from '../../hooks/useClusterNavigation';

interface IndicesViewProps {
  clusterId: string;
}

export function IndicesView({ clusterId }: IndicesViewProps) {
  // navigation not required here; parent ClusterView manages section navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const { navigateToIndex } = useClusterNavigation();

  const indicesSearch = searchParams.get('indicesSearch') || '';
  const [localIndicesSearch, setLocalIndicesSearch] = useState(indicesSearch);

  useEffect(() => {
    setLocalIndicesSearch(searchParams.get('indicesSearch') || '');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localIndicesSearch !== searchParams.get('indicesSearch')) {
        const newParams = new URLSearchParams(searchParams);
        if (localIndicesSearch) {
          newParams.set('indicesSearch', localIndicesSearch);
        } else {
          newParams.delete('indicesSearch');
        }
        setSearchParams(newParams, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localIndicesSearch, searchParams, setSearchParams]);

  const selectedHealth = searchParams.get('health')?.split(',').filter(Boolean) || [
    'green',
    'yellow',
    'red',
    'unknown',
  ];
  const selectedStatus = searchParams.get('status')?.split(',').filter(Boolean) || [
    'open',
    'close',
  ];
  const showSpecialIndices = searchParams.get('showSpecial') === 'true';

  const updateIndicesFilters = (newHealth?: string[], newStatus?: string[]) => {
    const params = new URLSearchParams(searchParams);

    if (newHealth !== undefined) {
      if (newHealth.length === 4) {
        params.delete('health');
      } else if (newHealth.length > 0) {
        params.set('health', newHealth.join(','));
      } else {
        params.delete('health');
      }
    }

    if (newStatus !== undefined) {
      if (newStatus.length === 2) {
        params.delete('status');
      } else if (newStatus.length > 0) {
        params.set('status', newStatus.join(','));
      } else {
        params.delete('status');
      }
    }

    setSearchParams(params, { replace: true });
  };

  const updateIndicesParam = (key: string, value: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, 'true');
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams, { replace: true });
  };

  const [indicesPage, setIndicesPage] = useState(1);

  const {
    data: indicesPaginated,
    isLoading: indicesLoading,
    error: indicesError,
  } = useClusterIndices(clusterId, {
    page: indicesPage,
    pageSize: 50,
    filters: {
      search: localIndicesSearch,
      health: selectedHealth,
      status: selectedStatus,
      showSpecial: showSpecialIndices,
    },
  });

  const indices = indicesPaginated?.items;

  // Per-page: request UNASSIGNED shards only for indices visible on this page.
  const visibleIndexNames = indices?.map((i) => i.name) ?? [];
  const visibleIndexFilter = visibleIndexNames.join(',');

  const { data: unassignedForPage = [] } = useQuery<ShardInfo[]>({
    queryKey: queryKeys.cluster(clusterId).shards(undefined, {
      state: 'UNASSIGNED',
      index: visibleIndexFilter,
      page: indicesPage,
    }),
    queryFn: async () => {
      if (!clusterId || visibleIndexNames.length === 0) return [];
      const resp = await apiClient.getShards(clusterId, 1, 2000, {
        state: 'UNASSIGNED',
        index: visibleIndexFilter,
      });
      const paginated = resp as PaginatedResponse<ShardInfo> | Record<string, unknown>;
      return (paginated && (paginated as PaginatedResponse<ShardInfo>).items) ?? [];
    },
    enabled: !!clusterId && visibleIndexNames.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });

  const unassignedByIndexForPage: Record<string, ShardInfo[]> = unassignedForPage.reduce(
    (acc: Record<string, ShardInfo[]>, shard: ShardInfo) => {
      if (!acc[shard.index]) acc[shard.index] = [];
      acc[shard.index].push(shard);
      return acc;
    },
    {} as Record<string, ShardInfo[]>
  );

  const indexStats = {
    totalIndices: indicesPaginated?.total ?? 0,
    greenIndices: indices?.filter((idx) => idx.health === 'green').length ?? 0,
    yellowIndices: indices?.filter((idx) => idx.health === 'yellow').length ?? 0,
    redIndices: indices?.filter((idx) => idx.health === 'red').length ?? 0,
    openIndices: indices?.filter((idx) => idx.status === 'open').length ?? 0,
    closedIndices: indices?.filter((idx) => idx.status === 'close').length ?? 0,
  };

  const openIndexModal = (indexName: string, tab?: string) => {
    navigateToIndex(indexName, tab || 'visualization');
  };

  return (
    <Grid gutter="md" overflow="hidden">
      <Grid.Col span={12}>
        <IndexStatsCards
          stats={indexStats}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Group gap="md" wrap="nowrap" align="flex-start">
          <FilterSidebar
            textFilters={[
              {
                value: localIndicesSearch,
                onChange: setLocalIndicesSearch,
                placeholder: 'Filter indices...',
              },
            ]}
            categories={[
              {
                title: 'Health',
                options: [
                  { label: 'green', value: 'green', color: 'var(--mantine-color-green-6)' },
                  { label: 'yellow', value: 'yellow', color: 'var(--mantine-color-yellow-6)' },
                  { label: 'red', value: 'red', color: 'var(--mantine-color-red-6)' },
                  { label: 'unknown', value: 'unknown', color: 'var(--mantine-color-gray-6)' },
                ],
                selected: selectedHealth,
                onChange: (newHealth) => updateIndicesFilters(newHealth, undefined),
              },
              {
                title: 'Status',
                options: [
                  { label: 'open', value: 'open', color: 'var(--mantine-color-blue-6)' },
                  { label: 'closed', value: 'close', color: 'var(--mantine-color-gray-6)' },
                ],
                selected: selectedStatus,
                onChange: (newStatus) => updateIndicesFilters(undefined, newStatus),
              },
            ]}
            toggles={[
              {
                label: 'Show special indices',
                value: showSpecialIndices,
                onChange: (val) => updateIndicesParam('showSpecial', val),
                icon: <IconEyeOff size={16} />,
              },
            ]}
            actions={[
            {
              label: 'Create Index',
              onClick: () => {
                // Open create-index modal via search param so it behaves like other modals
                const newParams = new URLSearchParams(searchParams);
                newParams.set('indexCreate', '1');
                // push new history entry so Back closes the modal
                setSearchParams(newParams, { replace: false });
              },
              icon: <IconPlus size={16} />,
            },
            ]}
          />
          <Stack gap="md" style={{ flex: 1 }}>
            <IndicesList
              indices={indices}
              indicesPaginated={indicesPaginated}
              loading={indicesLoading}
              error={indicesError}
              openIndexModal={openIndexModal}
              unassignedByIndexProp={unassignedByIndexForPage}
            />
            {indicesPaginated && indicesPaginated.total_pages > 1 && (
              <TablePagination
                simple
                currentPage={indicesPage}
                totalPages={indicesPaginated.total_pages}
                pageSize={50}
                totalItems={indicesPaginated.total}
                onPageChange={setIndicesPage}
                onPageSizeChange={() => {}}
              />
            )}
          </Stack>
        </Group>
      </Grid.Col>
    </Grid>
  );
}
