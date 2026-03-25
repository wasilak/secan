import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import type { IndexInfo } from '../../types/api';
import { sortShards } from '../../utils/shardOrdering';
import { formatBytes } from '../../utils/formatters';
import type { ShardAllocationGridProps } from './ShardAllocationGrid.types';

const SHARD_STATES = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;

export function ShardAllocationGrid(props: ShardAllocationGridProps): ReactElement {
  const {
    nodes,
    shards,
    indices,
    loading,
    error,
    openIndexModal,
    openNodeModal,
    searchParams,
    sharedRelocationMode,
    sharedValidDestinationNodes,
    onSharedRelocationCancel,
    indexNameFilter,
    nodeNameFilter,
    matchesWildcard,
    onShardClick,
    onSharedDestinationClick,
  } = props;

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error">
        Failed to load shard allocation data.
      </Alert>
    );
  }

  const selectedStatesParam = searchParams.get('shardStates');
  const selectedShardStates = selectedStatesParam
    ? selectedStatesParam.split(',').filter(Boolean)
    : Array.from(SHARD_STATES);

  const showClosed = searchParams.get('showClosed') === 'true';
  const showSpecial = searchParams.get('showSpecial') === 'true';

  const fullIndices = indices as IndexInfo[];

  const filteredNodes = useMemo(() => {
    if (!nodeNameFilter || !matchesWildcard) return nodes;
    return nodes.filter((node) => matchesWildcard(node.name, nodeNameFilter));
  }, [nodes, nodeNameFilter, matchesWildcard]);

  const filteredIndicesList = useMemo(() => {
    return fullIndices.filter((index) => {
      if (indexNameFilter && matchesWildcard && !matchesWildcard(index.name, indexNameFilter)) {
        return false;
      }

      if (!showClosed && index.status !== 'open') {
        return false;
      }

      if (!showSpecial && index.name.startsWith('.')) {
        return false;
      }

      return true;
    });
  }, [fullIndices, indexNameFilter, matchesWildcard, showClosed, showSpecial]);

  const indexHealthMap = useMemo(() => {
    const map = new Map<string, IndexInfo['health']>();
    fullIndices.forEach((index) => {
      map.set(index.name, index.health);
    });
    return map;
  }, [fullIndices]);

  const getIndexBackgroundColor = useCallback(
    (indexName: string): string => {
      const health = indexHealthMap.get(indexName);
      // Use a subtle dark background for all health states to match topology layout
      if (!health) {
        return 'var(--mantine-color-dark-7)';
      }
      return 'var(--mantine-color-dark-7)';
    },
    [indexHealthMap]
  );

  const filteredIndicesByName = useMemo(
    () => new Set(filteredIndicesList.map((i) => i.name)),
    [filteredIndicesList]
  );

  const filteredShards = useMemo(() => {
    const filtered = shards.filter((shard) => {
      if (!filteredIndicesByName.has(shard.index)) {
        return false;
      }

      if (shard.state === 'RELOCATING') {
        return true;
      }

      if (!selectedShardStates.includes(shard.state)) {
        return false;
      }

      return true;
    });

    return sortShards(filtered);
  }, [shards, filteredIndicesByName, selectedShardStates]);

  const assignedShards = useMemo(
    () => filteredShards.filter((s) => s.node && s.state !== 'UNASSIGNED'),
    [filteredShards]
  );

  const unassignedShards = useMemo(
    () => filteredShards.filter((s) => !s.node || s.state === 'UNASSIGNED'),
    [filteredShards]
  );

  const nodeIdentifierMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node) => {
      map.set(node.id, node.name);
      map.set(node.name, node.name);
      if (node.ip) {
        map.set(node.ip, node.name);
      }
    });
    return map;
  }, [nodes]);

  const shardsByNodeAndIndex = useMemo(() => {
    const outer = new Map<string, Map<string, typeof shards>>();

    assignedShards.forEach((shard) => {
      if (!shard.node) return;
      const nodeName = nodeIdentifierMap.get(shard.node);
      if (!nodeName) return;

      if (!outer.has(nodeName)) {
        outer.set(nodeName, new Map());
      }

      const inner = outer.get(nodeName)!;
      if (!inner.has(shard.index)) {
        inner.set(shard.index, []);
      }

      inner.get(shard.index)!.push(shard);
    });

    return outer;
  }, [assignedShards, nodeIdentifierMap, shards]);

  const unassignedByIndex = useMemo(
    () =>
      unassignedShards.reduce((acc, shard) => {
        (acc[shard.index] ||= []).push(shard);
        return acc;
      }, {} as Record<string, typeof shards>),
    [unassignedShards, shards]
  );

  const renderShardTile = useCallback(
    (shard: typeof shards[number], key: string) => {
      const handleClick = (event: React.MouseEvent) => {
        if (onShardClick) {
          onShardClick(shard, event);
        }
      };

      const indexHealth = indexHealthMap.get(shard.index);
      let backgroundColor: string;
      switch (indexHealth) {
        case 'green':
          backgroundColor = 'var(--mantine-color-green-6)';
          break;
        case 'yellow':
          backgroundColor = 'var(--mantine-color-yellow-6)';
          break;
        case 'red':
          backgroundColor = 'var(--mantine-color-red-6)';
          break;
        default:
          backgroundColor = 'var(--mantine-color-gray-6)';
      }

      // State-specific accents
      let borderColor = 'rgba(0, 0, 0, 0.6)';
      if (shard.state === 'RELOCATING') {
        borderColor = 'var(--mantine-color-yellow-4)';
      } else if (shard.state === 'UNASSIGNED') {
        backgroundColor = 'var(--mantine-color-red-6)';
        borderColor = 'var(--mantine-color-red-4)';
      }

      const borderStyle = shard.primary ? 'solid' : 'dashed';

      return (
        <Tooltip
          key={key}
          withArrow
          label={
            <div>
              <div>Index: {shard.index}</div>
              <div>Shard: {shard.shard}</div>
              <div>Type: {shard.primary ? 'Primary' : 'Replica'}</div>
              <div>State: {shard.state}</div>
              {shard.node && <div>Node: {shard.node}</div>}
              <div>Docs: {shard.docs}</div>
              <div>Size: {formatBytes(shard.store)}</div>
            </div>
          }
        >
          <Box
            onClick={handleClick}
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor,
              color: 'white',
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 3,
              borderWidth: 1,
              borderStyle,
              borderColor,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.7)',
              cursor: onShardClick ? 'pointer' : 'default',
            }}
          >
            {shard.shard}
          </Box>
        </Tooltip>
      );
    },
    [onShardClick, indexHealthMap]
  );

  if (!filteredNodes.length || !filteredIndicesList.length) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Text c="dimmed">No shard allocation data available</Text>
      </Stack>
    );
  }

  const renderIndexHeader = useCallback(
    (index: IndexInfo) => {
      const health = indexHealthMap.get(index.name);
      const healthDotColor = (() => {
        switch (health) {
          case 'green':
            return 'var(--mantine-color-green-5)';
          case 'yellow':
            return 'var(--mantine-color-yellow-5)';
          case 'red':
            return 'var(--mantine-color-red-5)';
          default:
            return 'var(--mantine-color-dark-2)';
        }
      })();

      const totalCopies = index.primaryShards * (index.replicaShards + 1);

      return (
        <Stack gap={4} align="center" style={{ maxWidth: 100 }}>
          <Text
            size="xs"
            fw={500}
            lineClamp={1}
            title={index.name}
            style={{ 
              cursor: 'pointer', 
              textDecoration: 'underline',
              wordBreak: 'break-word',
            }}
            onClick={(e) => {
              e.stopPropagation();
              openIndexModal(index.name);
            }}
          >
            {index.name}
          </Text>
          <Group gap={6} justify="center">
            <Box
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: healthDotColor,
              }}
            />
            <Text size="xs" c="dimmed" lineClamp={1}>
              {index.docsCount.toLocaleString()} · x{totalCopies} · {formatBytes(index.storeSize)}
            </Text>
          </Group>
        </Stack>
      );
    },
    [indexHealthMap, openIndexModal]
  );

  return (
    <Stack gap="md">
      <Group gap="md">
        <Text size="xs">
          <Text component="span" fw={700}>
            {filteredNodes.length}
          </Text>{' '}
          nodes
        </Text>
        <Text size="xs">
          <Text component="span" fw={700}>
            {filteredIndicesList.length}
          </Text>{' '}
          indices
        </Text>
        <Text size="xs">
          <Text component="span" fw={700}>
            {filteredShards.length}
          </Text>{' '}
          shards
        </Text>
        {unassignedShards.length > 0 && (
          <Badge color="red" variant="filled" size="xs">
            {unassignedShards.length} unassigned
          </Badge>
        )}
      </Group>

      <Card
        withBorder
        radius="md"
        shadow="sm"
        p="xs"
        style={{ backgroundColor: 'var(--mantine-color-dark-8)' }}
      >
        <ScrollArea style={{ width: '100%' }}>
          <Table style={{ minWidth: 'max-content' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    style={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'var(--mantine-color-dark-8)',
                      zIndex: 2,
                    }}
                  >
                    <Text size="xs" fw={500}>
                      Node
                    </Text>
                  </Table.Th>
                  {filteredIndicesList.map((index) => (
                    <Table.Th
                      key={index.name}
                      style={{ 
                        textAlign: 'center',
                        maxWidth: 120,
                        overflow: 'hidden',
                      }}
                    >
                      {renderIndexHeader(index as IndexInfo)}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {unassignedShards.length > 0 && (
                  <Table.Tr
                    style={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                    }}
                  >
                    <Table.Td
                      style={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'var(--mantine-color-dark-7)',
                        zIndex: 1,
                      }}
                    >
                      <Stack gap={2}>
                        <Text size="xs" fw={700} c="red">
                          Unassigned
                        </Text>
                        <Badge size="xs" color="red" variant="filled">
                          {unassignedShards.length}
                        </Badge>
                      </Stack>
                    </Table.Td>
                    {filteredIndicesList.map((index) => {
                      const list = unassignedByIndex[index.name] || [];
                       return (
                         <Table.Td
                           key={`unassigned-${index.name}`}
                           style={{
                             padding: 4,
                             textAlign: 'center',
                             backgroundColor: getIndexBackgroundColor(index.name),
                           }}
                         >
                          {list.length === 0 ? (
                            <Text size="xs" c="dimmed">
                              -
                            </Text>
                          ) : (
                            <Group gap={2} justify="center" wrap="wrap">
                              {list.map((shard, idx) =>
                                renderShardTile(
                                  shard,
                                  `unassigned-${shard.index}-${shard.shard}-${idx}`,
                                ),
                              )}
                            </Group>
                          )}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                )}

                {filteredNodes.map((node) => {
                  const nodeShards = shardsByNodeAndIndex.get(node.name);
                  const isValidDestination =
                    sharedRelocationMode &&
                    sharedValidDestinationNodes.some(
                      (id) => id === node.id || id === node.name,
                    );

                  const rowStyle =
                    sharedRelocationMode && isValidDestination
                      ? {
                          outline: '2px dashed var(--mantine-color-violet-4)',
                          outlineOffset: -2,
                          backgroundColor: 'var(--mantine-color-dark-7)',
                        }
                      : undefined;

                  return (
                    <Table.Tr key={node.id} style={rowStyle}>
                      <Table.Td
                        style={{
                          position: 'sticky',
                          left: 0,
                          backgroundColor:
                            sharedRelocationMode && isValidDestination
                              ? 'var(--mantine-color-violet-9)'
                              : 'var(--mantine-color-dark-8)',
                          cursor:
                            sharedRelocationMode && isValidDestination
                              ? 'pointer'
                              : 'default',
                          zIndex: 1,
                        }}
                        onClick={() => {
                          if (sharedRelocationMode && isValidDestination && onSharedDestinationClick) {
                            onSharedDestinationClick(node.id);
                          } else {
                            openNodeModal(node.id);
                          }
                        }}
                      >
                        {isValidDestination ? (
                          <Tooltip label="Click to select this destination">
                            <Stack gap={4}>
                              <Text
                                size="xs"
                                fw={500}
                                truncate="end"
                                title={node.name}
                                style={{ textDecoration: 'underline' }}
                              >
                                {node.name}
                              </Text>
                              <Text
                                size="xs"
                                c="dimmed"
                                truncate="end"
                                title={node.ip}
                              >
                                {node.ip}
                              </Text>
                            </Stack>
                          </Tooltip>
                        ) : (
                          <Stack gap={4}>
                            <Text
                              size="xs"
                              fw={500}
                              truncate="end"
                              title={node.name}
                              style={{ textDecoration: 'underline' }}
                            >
                              {node.name}
                            </Text>
                            <Text
                              size="xs"
                              c="dimmed"
                              truncate="end"
                              title={node.ip}
                            >
                              {node.ip}
                            </Text>
                          </Stack>
                        )}
                      </Table.Td>

                      {filteredIndicesList.map((index) => {
                        const indexShards = nodeShards?.get(index.name) || [];

                        return (
                           <Table.Td
                             key={`${node.id}-${index.name}`}
                             style={{
                               padding: 4,
                               textAlign: 'center',
                               backgroundColor: getIndexBackgroundColor(index.name),
                             }}
                           >
                            {indexShards.length === 0 ? (
                              <Text size="xs" c="dimmed">
                                -
                              </Text>
                            ) : (
                              <Group gap={2} justify="center" wrap="wrap">
                                {indexShards.map((shard, idx) =>
                                  renderShardTile(
                                    shard,
                                    `${node.id}-${index.name}-${shard.shard}-${idx}`,
                                  ),
                                )}
                              </Group>
                            )}
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
      </Card>
    </Stack>
  );
}
