import { Grid, Group, Stack } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';

import { useClusterNodes } from '../../hooks/useClusterNodes';
import { NodeStatsCards } from '../../components/NodeStatsCards';
import { TablePagination } from '../../components/TablePagination';
import { FilterSidebar } from '../../components/FacetedFilter';
import { getRoleIcon } from '../../components/RoleIcons';
import type { NodeInfo } from '../../types/api';
import { NodesList } from '../ClusterView';

interface NodesViewProps {
  clusterId: string;
}

export function NodesView({ clusterId }: NodesViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const nodesSearch = searchParams.get('nodesSearch') || '';
  const [localNodesSearch, setLocalNodesSearch] = useState(nodesSearch);

  useEffect(() => {
    setLocalNodesSearch(searchParams.get('nodesSearch') || '');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localNodesSearch !== searchParams.get('nodesSearch')) {
        const newParams = new URLSearchParams(searchParams);
        if (localNodesSearch) {
          newParams.set('nodesSearch', localNodesSearch);
        } else {
          newParams.delete('nodesSearch');
        }
        setSearchParams(newParams, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localNodesSearch, searchParams, setSearchParams]);

  const [nodesPage, setNodesPage] = useState(1);
  const [nodesPerPage, setNodesPerPage] = useState(50);

  const nodesFilters = useMemo(
    () => ({
      search: searchParams.get('nodesSearch') || '',
      roles: searchParams.get('nodeRoles') || '',
    }),
    [searchParams]
  );

  const {
    data: nodesPaginated,
    isInitialLoading: nodesLoading,
    error: nodesError,
  } = useClusterNodes(clusterId, {
    page: nodesPage,
    pageSize: nodesPerPage,
    filters: nodesFilters,
    enabled: true,
  });

  const nodesArray: NodeInfo[] = nodesPaginated?.items ?? [];

  const { data: allNodesUnfiltered } = useClusterNodes(clusterId, {
    page: 1,
    pageSize: 1000,
    filters: { search: '' },
    enabled: true,
  });

  const availableRoles = useMemo(() => {
    const roles = allNodesUnfiltered?.items?.flatMap((n) => n.roles) || [];
    return Array.from(new Set(roles));
  }, [allNodesUnfiltered]);

  const nodeRolesParam = searchParams.get('nodeRoles') || '';
  const selectedNodeRoles = nodeRolesParam.split(',').filter(Boolean);

  const updateNodeRoles = (newRoles: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (newRoles.length > 0) {
      params.set('nodeRoles', newRoles.join(','));
    } else {
      params.set('nodeRoles', '');
    }
    setSearchParams(params, { replace: true });
  };

  const handleNodesPageSizeChange = (size: number) => {
    setNodesPerPage(size);
    setNodesPage(1);
  };

  return (
    <Grid gutter="md" overflow="hidden">
      <Grid.Col span={12}>
        <NodeStatsCards nodes={nodesArray || []} />
      </Grid.Col>
      <Grid.Col span={12}>
        <Group gap="md" wrap="nowrap" align="flex-start">
          <FilterSidebar
            textFilters={[
              {
                value: localNodesSearch,
                onChange: setLocalNodesSearch,
                placeholder: 'Filter nodes...',
              },
            ]}
            categories={[
              {
                title: 'Roles',
                options: availableRoles.map((role) => {
                  const roleInfo = getRoleIcon(role);
                  const Icon = roleInfo.icon;
                  return {
                    label: roleInfo.label,
                    value: role,
                    icon: <Icon size={14} color={`var(--mantine-color-${roleInfo.color}-6)`} />,
                  };
                }),
                selected: selectedNodeRoles,
                onChange: updateNodeRoles,
              },
            ]}
          />
          <Stack gap="md" style={{ flex: 1 }}>
            <NodesList
              nodes={nodesArray}
              loading={nodesLoading}
              error={nodesError as Error | null}
              nodesSearch={localNodesSearch}
              availableRoles={availableRoles}
              hideStats
            />
            {nodesPaginated && nodesPaginated.total > 0 && (
              <TablePagination
                currentPage={nodesPage}
                totalPages={nodesPaginated.total_pages}
                pageSize={nodesPerPage}
                totalItems={nodesPaginated.total}
                onPageChange={setNodesPage}
                onPageSizeChange={handleNodesPageSizeChange}
              />
            )}
          </Stack>
        </Group>
      </Grid.Col>
    </Grid>
  );
}
