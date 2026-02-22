import { useState, useMemo, useEffect } from 'react';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Alert,
  Modal,
  Select,
  Badge,
  ScrollArea,
  Progress,
  ActionIcon,
  Menu,
  Checkbox,
  TextInput,
  Tooltip,
  Code,
  Skeleton,
  Box,
} from '@mantine/core';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconLock,
  IconLockOpen,
  IconMaximize,
  IconMinimize,
  IconSortAscending,
  IconSortDescending,
  IconFilter,
  IconRefresh,
} from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { useWatermarks } from '../hooks/useWatermarks';
import type { ShardInfo, NodeInfo } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { ShardGridSkeleton } from '../components/LoadingSkeleton';
import { getShardStateColor } from '../utils/colors';

/**
 * ShardManagement component displays and manages shard allocation
 *
 * Features:
 * - Display shard allocation
 * - Shard relocation UI
 * - Shard allocation lock/unlock
 * - Filter affected indices
 * - Expand/compress view
 * - Sort indices
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
 */
export function ShardManagement() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [relocateModalOpen, setRelocateModalOpen] = useState(false);
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [shardDetailsData, setShardDetailsData] = useState<unknown>(null);
  const [shardDetailsLoading, setShardDetailsLoading] = useState(false);

  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);

  // UI state from URL params
  const expandedView = searchParams.get('expanded') === 'true';
  const sortAscending = searchParams.get('sort') !== 'desc';
  const showOnlyAffected = searchParams.get('affected') === 'true';
  const indexFilter = searchParams.get('filter') || '';

  // Update URL params
  const updateParam = (key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '' || value === false) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    setSearchParams(newParams);
  };

  const setExpandedView = (value: boolean) => updateParam('expanded', value);
  const setSortAscending = (value: boolean) => updateParam('sort', value ? 'asc' : 'desc');
  const setShowOnlyAffected = (value: boolean) => updateParam('affected', value);
  const setIndexFilter = (value: string) => updateParam('filter', value);

  // Fetch shards
  const {
    data: shards,
    isLoading: shardsLoading,
    error: shardsError,
  } = useQuery({
    queryKey: ['cluster', id, 'shards'],
    queryFn: () => apiClient.getShards(id!),
    enabled: !!id,
  });

  // Fetch nodes for relocation targets
  const { data: nodes, isLoading: nodesLoading } = useQuery({
    queryKey: ['cluster', id, 'nodes'],
    queryFn: () => apiClient.getNodes(id!),
    enabled: !!id,
  });

  // Fetch cluster settings to check allocation status
  const { data: clusterSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: async () => {
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        id!,
        'GET',
        '/_cluster/settings'
      );
      return response.data;
    },
    enabled: !!id,
  });

  // Check if shard allocation is enabled
  const shardAllocationEnabled = useMemo(() => {
    if (!clusterSettings) return true;

    const transient = clusterSettings.transient as Record<string, unknown> | undefined;
    const persistent = clusterSettings.persistent as Record<string, unknown> | undefined;

    const transientAllocation = transient?.cluster as Record<string, unknown> | undefined;
    const persistentAllocation = persistent?.cluster as Record<string, unknown> | undefined;

    const transientRouting = transientAllocation?.routing as Record<string, unknown> | undefined;
    const persistentRouting = persistentAllocation?.routing as Record<string, unknown> | undefined;

    const transientEnable = (transientRouting?.allocation as Record<string, unknown>)?.enable as
      | string
      | undefined;
    const persistentEnable = (persistentRouting?.allocation as Record<string, unknown>)?.enable as
      | string
      | undefined;

    const enableValue = transientEnable || persistentEnable || 'all';
    return enableValue === 'all';
  }, [clusterSettings]);

  // Enable shard allocation mutation
  const enableAllocationMutation = useMutation({
    mutationFn: () =>
      apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': 'all',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Shard allocation enabled',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to enable shard allocation: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Disable shard allocation mutation
  const disableAllocationMutation = useMutation({
    mutationFn: (mode: string) =>
      apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': mode,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Shard allocation disabled',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to disable shard allocation: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Relocate shard mutation
  const relocateMutation = useMutation({
    mutationFn: ({
      index,
      shard,
      fromNode,
      toNode,
    }: {
      index: string;
      shard: number;
      fromNode: string;
      toNode: string;
    }) =>
      apiClient.proxyRequest(id!, 'POST', '/_cluster/reroute', {
        commands: [
          {
            move: {
              index,
              shard,
              from_node: fromNode,
              to_node: toNode,
            },
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'shards'] });
      notifications.show({
        title: 'Success',
        message: 'Shard relocation initiated successfully',
        color: 'green',
      });
      setRelocateModalOpen(false);
      setSelectedShard(null);
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to relocate shard: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleRelocateShard = (shard: ShardInfo) => {
    setSelectedShard(shard);
    setRelocateModalOpen(true);
  };

  const handleShardDetails = (shard: ShardInfo) => {
    setSelectedShard(shard);
    setDetailsModalOpen(true);
  };

  // Fetch detailed stats when details modal opens
  useEffect(() => {
    if (detailsModalOpen && selectedShard) {
      setShardDetailsLoading(true);
      setShardDetailsData(null); // Reset previous data

      apiClient
        .getShardStats(id!, selectedShard.index, selectedShard.shard)
        .then((stats) => {
          setShardDetailsData(stats);
        })
        .catch((error) => {
          console.error('Failed to fetch shard stats:', error);
          setShardDetailsData(selectedShard); // Fallback to basic shard info
        })
        .finally(() => {
          setShardDetailsLoading(false);
        });
    } else if (!detailsModalOpen) {
      // Reset when modal closes
      setShardDetailsData(null);
      setShardDetailsLoading(false);
    }
  }, [detailsModalOpen, selectedShard, id]);

  // Group shards by index - must be before early returns
  const shardsByIndex = useMemo(() => {
    return (
      shards?.reduce(
        (acc, shard) => {
          if (!acc[shard.index]) {
            acc[shard.index] = [];
          }
          acc[shard.index].push(shard);
          return acc;
        },
        {} as Record<string, ShardInfo[]>
      ) || {}
    );
  }, [shards]);

  // Filter and sort indices - must be before early returns
  const filteredIndices = useMemo(() => {
    let indices = Object.keys(shardsByIndex);

    // Apply name filter
    if (indexFilter) {
      indices = indices.filter((index) => index.toLowerCase().includes(indexFilter.toLowerCase()));
    }

    // Apply "show only affected" filter
    if (showOnlyAffected) {
      indices = indices.filter((index) => {
        const indexShards = shardsByIndex[index];
        return indexShards.some(
          (s) => s.state === 'UNASSIGNED' || s.state === 'RELOCATING' || s.state === 'INITIALIZING'
        );
      });
    }

    // Sort
    indices.sort((a, b) => {
      return sortAscending ? a.localeCompare(b) : b.localeCompare(a);
    });

    return indices;
  }, [shardsByIndex, indexFilter, showOnlyAffected, sortAscending]);

  if (!id) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </FullWidthContainer>
    );
  }

  if (shardsLoading || nodesLoading || settingsLoading) {
    return <ShardGridSkeleton />;
  }

  if (shardsError) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load shards: {(shardsError as Error).message}
        </Alert>
      </FullWidthContainer>
    );
  }

  // Group shards by state
  const shardsByState =
    shards?.reduce(
      (acc, shard) => {
        if (!acc[shard.state]) {
          acc[shard.state] = [];
        }
        acc[shard.state].push(shard);
        return acc;
      },
      {} as Record<string, ShardInfo[]>
    ) || {};

  // Count problem shards
  const unassignedCount = shardsByState['UNASSIGNED']?.length || 0;
  const relocatingCount = shardsByState['RELOCATING']?.length || 0;
  const initializingCount = shardsByState['INITIALIZING']?.length || 0;
  const hasProblems = unassignedCount > 0 || relocatingCount > 0 || initializingCount > 0;

  // Group shards by node
  const shardsByNode =
    shards?.reduce(
      (acc, shard) => {
        const node = shard.node || 'UNASSIGNED';
        if (!acc[node]) {
          acc[node] = [];
        }
        acc[node].push(shard);
        return acc;
      },
      {} as Record<string, ShardInfo[]>
    ) || {};

  // Separate unassigned shards
  const unassignedShards = shardsByNode['UNASSIGNED'] || [];
  const assignedNodes = Object.keys(shardsByNode).filter((node) => node !== 'UNASSIGNED');

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Shard Management</Title>
          <Text size="sm" c="dimmed">
            View and manage shard allocation across nodes
          </Text>
        </div>
      </Group>

      {/* Toolbar with convenience actions */}
      <Card shadow="sm" padding="md" mb="md">
        <Group justify="space-between">
          <Group>
            {/* Shard allocation lock/unlock */}
            {shardAllocationEnabled ? (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Tooltip label="Disable shard allocation">
                    <ActionIcon
                      size="lg"
                      variant="subtle"
                      color="green"
                      loading={disableAllocationMutation.isPending}
                    >
                      <IconLockOpen size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Disable Allocation</Menu.Label>
                  <Menu.Item onClick={() => disableAllocationMutation.mutate('none')}>
                    <IconLock size={14} /> None (default)
                  </Menu.Item>
                  <Menu.Item onClick={() => disableAllocationMutation.mutate('primaries')}>
                    <IconLock size={14} /> Primaries only
                  </Menu.Item>
                  <Menu.Item onClick={() => disableAllocationMutation.mutate('new_primaries')}>
                    <IconLock size={14} /> New primaries only
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Tooltip label="Enable shard allocation">
                <ActionIcon
                  size="lg"
                  variant="subtle"
                  color="red"
                  onClick={() => enableAllocationMutation.mutate()}
                  loading={enableAllocationMutation.isPending}
                >
                  <IconLock size={20} />
                </ActionIcon>
              </Tooltip>
            )}

            {/* Expand/compress view */}
            <Tooltip label={expandedView ? 'Compress view' : 'Expand view'}>
              <ActionIcon size="lg" variant="subtle" onClick={() => setExpandedView(!expandedView)}>
                {expandedView ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
              </ActionIcon>
            </Tooltip>

            {/* Sort ascending/descending */}
            <Tooltip label={sortAscending ? 'Sort descending' : 'Sort ascending'}>
              <ActionIcon
                size="lg"
                variant="subtle"
                onClick={() => setSortAscending(!sortAscending)}
              >
                {sortAscending ? <IconSortAscending size={20} /> : <IconSortDescending size={20} />}
              </ActionIcon>
            </Tooltip>

            {/* Refresh */}
            <Tooltip label="Refresh data">
              <ActionIcon
                size="lg"
                variant="subtle"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['cluster', id, 'shards'] });
                  queryClient.invalidateQueries({ queryKey: ['cluster', id, 'nodes'] });
                  queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
                }}
              >
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Group>
            {/* Index name filter */}
            <TextInput
              placeholder="Filter indices..."
              leftSection={<IconFilter size={16} />}
              value={indexFilter}
              onChange={(e) => setIndexFilter(e.currentTarget.value)}
              w={200}
            />

            {/* Show only affected checkbox */}
            {hasProblems && (
              <Checkbox
                label="Show only affected"
                checked={showOnlyAffected}
                onChange={(e) => setShowOnlyAffected(e.currentTarget.checked)}
                size="sm"
              />
            )}
          </Group>
        </Group>
      </Card>

      {/* Problem shards alert */}
      {hasProblems && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Shard Issues Detected"
          color="yellow"
          mb="md"
        >
          <Stack gap="xs">
            {unassignedCount > 0 && (
              <Text size="sm">
                ⚠️ {unassignedCount} unassigned shard{unassignedCount > 1 ? 's' : ''}
              </Text>
            )}
            {relocatingCount > 0 && (
              <Text size="sm">
                🔄 {relocatingCount} relocating shard{relocatingCount > 1 ? 's' : ''}
              </Text>
            )}
            {initializingCount > 0 && (
              <Text size="sm">
                ⏳ {initializingCount} initializing shard{initializingCount > 1 ? 's' : ''}
              </Text>
            )}
          </Stack>
        </Alert>
      )}

      {/* Shard state summary */}
      <Group mb="md" grow>
        {Object.entries(shardsByState).map(([state, stateShards]) => (
          <Card key={state} shadow="sm" padding="md">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                {state}
              </Text>
              <Text size="xl" fw={700}>
                {stateShards.length}
              </Text>
              <Badge size="sm" color={getShardStateColor(state as ShardInfo['state'])}>
                {state}
              </Badge>
            </Stack>
          </Card>
        ))}
      </Group>

      {/* Unassigned shards section */}
      {unassignedShards.length > 0 && (
        <Card shadow="sm" padding="lg" mb="md" bg="var(--mantine-color-red-0)">
          <Group justify="space-between" mb="md">
            <Box>
              <Title order={3}>Unassigned Shards</Title>
              <Text size="sm" c="dimmed">
                {unassignedShards.length} shard{unassignedShards.length > 1 ? 's' : ''} not
                allocated to any node
              </Text>
            </Box>
            <Badge size="lg" color="red" variant="filled">
              {unassignedShards.length}
            </Badge>
          </Group>

          <Stack gap="md">
            {/* Group unassigned shards by index */}
            {Object.entries(
              unassignedShards.reduce(
                (acc, shard) => {
                  if (!acc[shard.index]) {
                    acc[shard.index] = [];
                  }
                  acc[shard.index].push(shard);
                  return acc;
                },
                {} as Record<string, ShardInfo[]>
              )
            )
              .filter(([index]) => {
                // Apply index filter
                if (indexFilter && !index.toLowerCase().includes(indexFilter.toLowerCase())) {
                  return false;
                }
                return true;
              })
              .sort(([a], [b]) => (sortAscending ? a.localeCompare(b) : b.localeCompare(a)))
              .map(([index, indexShards]) => (
                <Card key={index} shadow="xs" padding="sm" withBorder bg="white">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        {index}
                      </Text>
                      <Badge size="sm" color="red" variant="light">
                        {indexShards.length} unassigned
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      {indexShards.map((shard, idx) => (
                        <Tooltip
                          key={`unassigned-${shard.index}-${shard.shard}-${idx}`}
                          label={
                            <div>
                              <div>Shard: {shard.shard}</div>
                              <div>Type: {shard.primary ? 'Primary' : 'Replica'}</div>
                              <div>State: UNASSIGNED</div>
                              <div>Reason: Not allocated to any node</div>
                            </div>
                          }
                        >
                          <Badge size="lg" variant={shard.primary ? 'filled' : 'light'} color="red">
                            {shard.shard}
                          </Badge>
                        </Tooltip>
                      ))}
                    </Group>
                  </Stack>
                </Card>
              ))}
          </Stack>
        </Card>
      )}

      {/* Shard allocation by node */}
      <Card shadow="sm" padding="lg" mb="md">
        <Title order={3} mb="md">
          Shard Allocation by Node
        </Title>
        <Stack gap="md">
          {assignedNodes.map((node) => {
            const nodeShards = shardsByNode[node];
            const nodeInfo = nodes?.find((n) => n.name === node);
            const primaryShards = nodeShards.filter((s) => s.primary).length;
            const replicaShards = nodeShards.filter((s) => !s.primary).length;

            return (
              <Card key={node} shadow="xs" padding="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Box>
                      <Text size="sm" fw={500}>
                        {node}
                      </Text>
                      {nodeInfo && expandedView && (
                        <>
                          <Text size="xs" c="dimmed">
                            {nodeInfo.ip}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Roles: {nodeInfo.roles.join(', ')}
                          </Text>
                        </>
                      )}
                    </Box>
                    <Group gap="xs">
                      <Badge size="sm" variant="light" color="blue">
                        {primaryShards}p
                      </Badge>
                      <Badge size="sm" variant="light" color="gray">
                        {replicaShards}r
                      </Badge>
                      <Badge size="sm" variant="light">
                        {nodeShards.length} total
                      </Badge>
                    </Group>
                  </Group>

                  {nodeInfo && (
                    <Group gap="md">
                      <Box style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Heap
                        </Text>
                        <Progress
                          value={Math.round((nodeInfo.heapUsed / nodeInfo.heapMax) * 100)}
                          color={getColor(Math.round((nodeInfo.heapUsed / nodeInfo.heapMax) * 100))}
                          size="sm"
                          radius="xs"
                        />
                        {expandedView && (
                          <Text size="xs" c="dimmed">
                            {formatBytes(nodeInfo.heapUsed)} / {formatBytes(nodeInfo.heapMax)}
                          </Text>
                        )}
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">
                          Disk
                        </Text>
                        <Progress
                          value={Math.round((nodeInfo.diskUsed / nodeInfo.diskTotal) * 100)}
                          color={getColor(
                            Math.round((nodeInfo.diskUsed / nodeInfo.diskTotal) * 100)
                          )}
                          size="sm"
                          radius="xs"
                        />
                        {expandedView && (
                          <Text size="xs" c="dimmed">
                            {formatBytes(nodeInfo.diskUsed)} / {formatBytes(nodeInfo.diskTotal)}
                          </Text>
                        )}
                      </Box>
                    </Group>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Card>

      {/* Detailed shard list by index */}
      <Card shadow="sm" padding="lg">
        <Title order={3} mb="md">
          Shards by Index ({filteredIndices.length}{' '}
          {filteredIndices.length === 1 ? 'index' : 'indices'})
        </Title>
        <ScrollArea>
          <Stack gap="md">
            {filteredIndices.map((index) => {
              const indexShards = shardsByIndex[index];
              const hasIssues = indexShards.some(
                (s) =>
                  s.state === 'UNASSIGNED' || s.state === 'RELOCATING' || s.state === 'INITIALIZING'
              );

              return (
                <Card key={index} shadow="xs" padding="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        {index}
                      </Text>
                      {hasIssues && (
                        <Badge size="sm" color="yellow">
                          Has Issues
                        </Badge>
                      )}
                    </Group>
                    <Group gap="xs">
                      {indexShards.map((shard, idx) => (
                        <Tooltip
                          key={`${shard.index}-${shard.shard}-${idx}`}
                          label={
                            <div>
                              <div>Shard: {shard.shard}</div>
                              <div>Type: {shard.primary ? 'Primary' : 'Replica'}</div>
                              <div>State: {shard.state}</div>
                              <div>Node: {shard.node || 'N/A'}</div>
                              {shard.docs !== undefined && shard.docs !== null && (
                                <div>Docs: {shard.docs.toLocaleString()}</div>
                              )}
                              {shard.store !== undefined && shard.store !== null && (
                                <div>Size: {formatBytes(shard.store)}</div>
                              )}
                            </div>
                          }
                        >
                          <Badge
                            size="lg"
                            variant={shard.primary ? 'filled' : 'light'}
                            color={
                              shard.state === 'STARTED'
                                ? 'green'
                                : shard.state === 'UNASSIGNED'
                                  ? 'red'
                                  : 'yellow'
                            }
                            onClick={(e) => {
                              // Right-click or Ctrl+click for relocate, regular click for details
                              if (e.ctrlKey || e.metaKey || e.button === 2) {
                                if (shard.state === 'STARTED' && shard.node) {
                                  e.preventDefault();
                                  handleRelocateShard(shard);
                                }
                              } else {
                                handleShardDetails(shard);
                              }
                            }}
                            onContextMenu={(e) => {
                              if (shard.state === 'STARTED' && shard.node) {
                                e.preventDefault();
                                handleRelocateShard(shard);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {shard.shard}
                          </Badge>
                        </Tooltip>
                      ))}
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </ScrollArea>
      </Card>

      {selectedShard && (
        <>
          <RelocateShardModal
            opened={relocateModalOpen}
            onClose={() => {
              setRelocateModalOpen(false);
              setSelectedShard(null);
            }}
            shard={selectedShard}
            nodes={nodes || []}
            onRelocate={(toNode) => {
              if (selectedShard.node) {
                relocateMutation.mutate({
                  index: selectedShard.index,
                  shard: selectedShard.shard,
                  fromNode: selectedShard.node,
                  toNode,
                });
              }
            }}
            isLoading={relocateMutation.isPending}
          />

          <Modal
            opened={detailsModalOpen}
            onClose={() => {
              setDetailsModalOpen(false);
              setShardDetailsData(null);
            }}
            title={
              selectedShard ? (
                <Group gap="xs">
                  <Text size="lg" fw={600}>
                    Shard Details:
                  </Text>
                  <Badge size="lg" variant="light" color="blue">
                    {selectedShard.index}
                  </Badge>
                  <Text size="lg" c="dimmed">
                    /
                  </Text>
                  <Badge size="lg" variant="filled" color="cyan">
                    #{selectedShard.shard}
                  </Badge>
                  <Badge
                    size="lg"
                    variant={selectedShard.primary ? 'filled' : 'light'}
                    color={selectedShard.primary ? 'green' : 'gray'}
                  >
                    {selectedShard.primary ? 'Primary' : 'Replica'}
                  </Badge>
                </Group>
              ) : (
                'Shard Details'
              )
            }
            size="80%"
            fullScreen={false}
            styles={{
              body: {
                height: 'calc(100vh - 120px)',
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            <ScrollArea style={{ flex: 1 }}>
              {shardDetailsLoading ? (
                <Stack gap="xs">
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} width="70%" radius="xs" />
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} width="50%" radius="xs" />
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} radius="xs" />
                  <Skeleton height={20} width="80%" radius="xs" />
                </Stack>
              ) : (
                <Code block>{JSON.stringify(shardDetailsData || selectedShard, null, 2)}</Code>
              )}
            </ScrollArea>
          </Modal>
        </>
      )}
    </FullWidthContainer>
  );
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * RelocateShardModal component for relocating shards
 *
 * Requirements: 10.2, 10.3, 10.4
 */
interface RelocateShardModalProps {
  opened: boolean;
  onClose: () => void;
  shard: ShardInfo;
  nodes: NodeInfo[];
  onRelocate: (toNode: string) => void;
  isLoading: boolean;
}

function RelocateShardModal({
  opened,
  onClose,
  shard,
  nodes,
  onRelocate,
  isLoading,
}: RelocateShardModalProps) {
  const form = useForm({
    initialValues: {
      targetNode: '',
    },
    validate: {
      targetNode: (value: string) => (!value ? 'Target node is required' : null),
    },
  });

  // Filter out the current node from available targets
  const availableNodes = nodes
    .filter((node) => node.name !== shard.node)
    .map((node) => ({
      value: node.name,
      label: `${node.name} (${node.roles.join(', ')})`,
    }));

  const handleSubmit = form.onSubmit((values) => {
    onRelocate(values.targetNode);
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Relocate Shard" size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} title="Shard Information" color="blue">
            <Stack gap="xs">
              <Text size="sm">
                <strong>Index:</strong> {shard.index}
              </Text>
              <Text size="sm">
                <strong>Shard:</strong> {shard.shard}
              </Text>
              <Text size="sm">
                <strong>Type:</strong> {shard.primary ? 'Primary' : 'Replica'}
              </Text>
              <Text size="sm">
                <strong>Current Node:</strong> {shard.node}
              </Text>
            </Stack>
          </Alert>

          <Select
            label="Target Node"
            placeholder="Select target node"
            data={availableNodes}
            searchable
            required
            {...form.getInputProps('targetNode')}
          />

          <Alert icon={<IconAlertCircle size={16} />} title="Warning" color="yellow">
            <Text size="sm">
              Relocating shards can impact cluster performance. Ensure the target node has
              sufficient resources.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              Relocate Shard
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
