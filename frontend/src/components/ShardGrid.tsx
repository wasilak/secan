import { Box, ScrollArea, Table, Text, Group, Stack } from '@mantine/core';
import { useEffect, useRef } from 'react';
import type { ShardInfo } from '../types/api';
import { ShardCell } from './ShardCell';
import { useShardGridStore } from '../stores/shard-grid-store';
import { getShardsForNodeAndIndex } from '../utils/shard-grid-parser';

/**
 * Props for ShardGrid component
 */
interface ShardGridProps {
  clusterId: string;
  refreshInterval?: number;
}

/**
 * ShardGrid component
 * 
 * Renders a grid layout with nodes as rows and indices as columns.
 * Displays shards at the intersection of node rows and index columns.
 * 
 * Features:
 * - Sticky headers for nodes and indices
 * - Horizontal and vertical scrolling
 * - Color-coded shard states
 * - Click handling for shard selection
 * - Support for relocation mode with destination indicators
 * 
 * Requirements: 3.1, 3.8, 3.9
 */
export function ShardGrid({
  clusterId,
  refreshInterval = 30000,
}: ShardGridProps): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Get state from store
  const {
    nodes,
    indices,
    unassignedShards,
    loading,
    error,
    selectedShard,
    selectShard,
  } = useShardGridStore();
  
  // Auto-refresh logic - Requirements: 3.12
  useEffect(() => {
    // TODO: This will be fully implemented when the cluster state API is available
    // For now, we set up the polling infrastructure
    
    if (!clusterId) {
      return;
    }
    
    // Initial fetch would go here
    // fetchClusterState(clusterId);
    
    // Set up polling interval
    const intervalId = setInterval(() => {
      // Poll cluster state API
      // fetchClusterState(clusterId);
      console.log(`Polling cluster state for ${clusterId} (interval: ${refreshInterval}ms)`);
    }, refreshInterval);
    
    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [clusterId, refreshInterval]);
  
  // Handle shard click - Requirements: 4.1
  const handleShardClick = (shard: ShardInfo) => {
    // Update selected shard in state
    selectShard(shard);
    // Context menu will be implemented in task 12.2
    console.log('Shard clicked:', shard);
  };
  
  // Format percentage
  const formatPercent = (value: number): string => {
    return `${Math.round(value)}%`;
  };
  
  // Format load average
  const formatLoad = (load?: number): string => {
    if (load === undefined) return 'N/A';
    return load.toFixed(2);
  };
  
  // Format number with commas
  const formatNumber = (value: number): string => {
    return value.toLocaleString();
  };
  
  // Format size in bytes to human-readable format
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  if (loading) {
    return (
      <Box p="md">
        Loading shard grid...
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box p="md" c="red">
        Error loading shard grid: {error.message}
      </Box>
    );
  }
  
  if (nodes.length === 0 || indices.length === 0) {
    return (
      <Box p="md">
        No data available. Please check cluster connection.
      </Box>
    );
  }
  
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      role="grid"
      aria-label="Shard allocation grid"
    >
      {/* Grid container with scrolling */}
      <ScrollArea
        ref={scrollAreaRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
        }}
        type="always"
      >
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          style={{
            minWidth: '100%',
            tableLayout: 'fixed',
          }}
        >
          {/* Header row with index names */}
          <Table.Thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--mantine-color-body)',
            }}
          >
            <Table.Tr>
              {/* Empty cell for node column header */}
              <Table.Th
                style={{
                  width: '250px',
                  minWidth: '250px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 11,
                  backgroundColor: 'var(--mantine-color-body)',
                }}
              >
                Node
              </Table.Th>
              
              {/* Index column headers - Requirements: 3.3 */}
              {indices.map((index) => (
                <Table.Th
                  key={index.name}
                  style={{
                    width: '150px',
                    minWidth: '150px',
                    textAlign: 'center',
                    verticalAlign: 'top',
                  }}
                >
                  <Stack gap="xs" align="center">
                    {/* Index name */}
                    <Box
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        textAlign: 'center',
                      }}
                      title={index.name}
                    >
                      {index.name}
                    </Box>
                    
                    {/* Index metadata */}
                    <Box
                      style={{
                        fontSize: '11px',
                        color: 'var(--mantine-color-dimmed)',
                        textAlign: 'center',
                      }}
                    >
                      <div>{index.shardCount} shards</div>
                      <div>{formatNumber(index.docsCount)} docs</div>
                      <div>{formatSize(index.storeSize)}</div>
                    </Box>
                  </Stack>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          
          <Table.Tbody>
            {/* Node rows - Requirements: 3.2 */}
            {nodes.map((node) => (
              <Table.Tr key={node.id} role="row" aria-label={`Node ${node.name}`}>
                {/* Node information column (sticky) */}
                <Table.Td
                  style={{
                    width: '250px',
                    minWidth: '250px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: 'var(--mantine-color-body)',
                  }}
                >
                  <Stack gap="xs">
                    {/* Node name and IP */}
                    <Box>
                      <Text fw={600} size="sm">
                        {node.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {node.ip || 'N/A'}
                      </Text>
                    </Box>
                    
                    {/* Node statistics */}
                    <Group gap="xs" wrap="wrap">
                      {/* Heap usage */}
                      <Text size="xs" c="dimmed">
                        Heap: {formatPercent((node.heapUsed / node.heapMax) * 100)}
                      </Text>
                      
                      {/* Disk usage */}
                      <Text size="xs" c="dimmed">
                        Disk: {formatPercent((node.diskUsed / node.diskTotal) * 100)}
                      </Text>
                      
                      {/* CPU usage */}
                      {node.cpuPercent !== undefined && (
                        <Text size="xs" c="dimmed">
                          CPU: {formatPercent(node.cpuPercent)}
                        </Text>
                      )}
                      
                      {/* Load average */}
                      {node.loadAverage !== undefined && (
                        <Text size="xs" c="dimmed">
                          Load: {formatLoad(node.loadAverage)}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                </Table.Td>
                
                {/* Shard cells for each index */}
                {indices.map((index) => {
                  const shards = getShardsForNodeAndIndex(node, index.name);
                  
                  return (
                    <Table.Td
                      key={`${node.id}-${index.name}`}
                      style={{
                        width: '150px',
                        minWidth: '150px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      {shards.length > 0 ? (
                        <Group gap="xs" justify="center" wrap="wrap">
                          {shards.map((shard) => {
                            // Check if this shard is selected - Requirements: 4.1
                            const isSelected = selectedShard !== null &&
                              selectedShard.index === shard.index &&
                              selectedShard.shard === shard.shard &&
                              selectedShard.primary === shard.primary &&
                              selectedShard.node === shard.node;
                            
                            return (
                              <ShardCell
                                key={`${shard.index}-${shard.shard}-${shard.primary}`}
                                shard={shard}
                                isSelected={isSelected}
                                onClick={handleShardClick}
                              />
                            );
                          })}
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
            
            {/* Unassigned shards row - Requirements: 3.10 */}
            {unassignedShards.length > 0 && (
              <Table.Tr role="row" aria-label="Unassigned shards">
                {/* Unassigned label column (sticky) */}
                <Table.Td
                  style={{
                    width: '250px',
                    minWidth: '250px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: 'var(--mantine-color-body)',
                  }}
                >
                  <Stack gap="xs">
                    <Box>
                      <Text fw={600} size="sm" c="red">
                        Unassigned Shards
                      </Text>
                      <Text size="xs" c="dimmed">
                        {unassignedShards.length} shard{unassignedShards.length !== 1 ? 's' : ''}
                      </Text>
                    </Box>
                  </Stack>
                </Table.Td>
                
                {/* Unassigned shards grouped by index */}
                {indices.map((index) => {
                  const indexUnassignedShards = unassignedShards.filter(
                    (shard) => shard.index === index.name
                  );
                  
                  return (
                    <Table.Td
                      key={`unassigned-${index.name}`}
                      style={{
                        width: '150px',
                        minWidth: '150px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      {indexUnassignedShards.length > 0 ? (
                        <Group gap="xs" justify="center" wrap="wrap">
                          {indexUnassignedShards.map((shard) => {
                            // Check if this shard is selected - Requirements: 4.1
                            const isSelected = selectedShard !== null &&
                              selectedShard.index === shard.index &&
                              selectedShard.shard === shard.shard &&
                              selectedShard.primary === shard.primary &&
                              selectedShard.state === 'UNASSIGNED';
                            
                            return (
                              <ShardCell
                                key={`unassigned-${shard.index}-${shard.shard}-${shard.primary}`}
                                shard={shard}
                                isSelected={isSelected}
                                onClick={handleShardClick}
                              />
                            );
                          })}
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
