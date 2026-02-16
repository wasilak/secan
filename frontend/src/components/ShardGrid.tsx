import { Box, ScrollArea, Table, Text, Group, Stack } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { ShardInfo, NodeWithShards } from '../types/api';
import { ShardCell } from './ShardCell';
import { ShardContextMenu } from './ShardContextMenu';
import { ShardStatsModal } from './ShardStatsModal';
import { RelocationConfirmDialog } from './RelocationConfirmDialog';
import { useShardGridStore } from '../stores/shard-grid-store';
import { getShardsForNodeAndIndex } from '../utils/shard-grid-parser';
import { apiClient } from '../api/client';

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
  
  // Context menu state - Requirements: 4.2, 4.8, 4.9
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuShard, setContextMenuShard] = useState<ShardInfo | null>(null);
  
  // Shard stats modal state - Requirements: 4.5
  const [statsModalOpened, setStatsModalOpened] = useState(false);
  const [statsModalShard, setStatsModalShard] = useState<ShardInfo | null>(null);
  
  // Relocation confirmation dialog state - Requirements: 5.8
  const [confirmDialogOpened, setConfirmDialogOpened] = useState(false);
  const [confirmDialogSourceNode, setConfirmDialogSourceNode] = useState<NodeWithShards | null>(null);
  const [confirmDialogDestinationNode, setConfirmDialogDestinationNode] = useState<NodeWithShards | null>(null);
  
  // Get state from store
  const {
    nodes,
    indices,
    unassignedShards,
    loading,
    error,
    selectedShard,
    relocationMode,
    destinationIndicators,
    selectShard,
    enterRelocationMode,
    exitRelocationMode,
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
  
  // Handle Escape key to exit relocation mode - Requirements: 5.13
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && relocationMode) {
        exitRelocationMode();
      }
    };
    
    if (relocationMode) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [relocationMode, exitRelocationMode]);
  
  // Handle outside click to exit relocation mode - Requirements: 5.13
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (relocationMode && scrollAreaRef.current) {
        // Check if click is outside the scroll area
        const target = e.target as Node;
        if (!scrollAreaRef.current.contains(target)) {
          exitRelocationMode();
        }
      }
    };
    
    if (relocationMode) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [relocationMode, exitRelocationMode]);
  
  // Handle shard click - Requirements: 4.1, 4.2
  const handleShardClick = (shard: ShardInfo, event: React.MouseEvent) => {
    // Update selected shard in state
    selectShard(shard);
    
    // Open context menu near the clicked shard - Requirements: 4.2, 4.9
    setContextMenuShard(shard);
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setContextMenuOpened(true);
  };
  
  // Handle context menu close - Requirements: 4.8
  const handleContextMenuClose = () => {
    setContextMenuOpened(false);
    setContextMenuShard(null);
  };
  
  // Handle show shard stats - Requirements: 4.3, 4.5
  const handleShowStats = (shard: ShardInfo) => {
    setStatsModalShard(shard);
    setStatsModalOpened(true);
    handleContextMenuClose();
  };
  
  // Handle select for relocation - Requirements: 4.4, 5.1, 5.2, 5.3
  const handleSelectForRelocation = (shard: ShardInfo) => {
    // Enter relocation mode
    // This will:
    // 1. Set relocationMode to true
    // 2. Store selected shard
    // 3. Calculate valid destinations
    enterRelocationMode(shard);
    handleContextMenuClose();
  };
  
  // Handle relocation confirmation - Requirements: 5.10, 5.11, 5.12, 6.1
  const handleRelocationConfirm = async () => {
    if (selectedShard && confirmDialogSourceNode && confirmDialogDestinationNode) {
      try {
        // Call the backend API to relocate the shard - Requirements: 6.1, 6.2
        await apiClient.relocateShard(clusterId, {
          index: selectedShard.index,
          shard: selectedShard.shard,
          from_node: confirmDialogSourceNode.id,
          to_node: confirmDialogDestinationNode.id,
        });
        
        // Show success notification - Requirements: 5.11
        notifications.show({
          color: 'green',
          icon: <IconCheck size={18} />,
          title: 'Relocation Initiated',
          message: `Shard ${selectedShard.shard} of index "${selectedShard.index}" is being relocated from ${confirmDialogSourceNode.name} to ${confirmDialogDestinationNode.name}`,
        });
        
        // Exit relocation mode after successful relocation
        exitRelocationMode();
        
        // Close confirmation dialog
        setConfirmDialogOpened(false);
        setConfirmDialogSourceNode(null);
        setConfirmDialogDestinationNode(null);
      } catch (error) {
        // Show error notification - Requirements: 5.12
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        notifications.show({
          color: 'red',
          icon: <IconX size={18} />,
          title: 'Relocation Failed',
          message: `Failed to relocate shard: ${errorMessage}`,
        });
        
        // Re-throw to let the dialog handle loading state
        throw error;
      }
    }
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
                  
                  // Check if there's a destination indicator for this node and index
                  // Requirements: 5.5, 5.6, 5.7
                  const destinationIndicator = relocationMode && 
                    destinationIndicators.has(node.id) &&
                    destinationIndicators.get(node.id)?.index === index.name
                      ? destinationIndicators.get(node.id)
                      : null;
                  
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
                      {shards.length > 0 || destinationIndicator ? (
                        <Group gap="xs" justify="center" wrap="wrap">
                          {/* Render actual shards */}
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
                          
                          {/* Render destination indicator if in relocation mode */}
                          {destinationIndicator && (
                            <ShardCell
                              key={`destination-${destinationIndicator.index}-${destinationIndicator.shard}`}
                              shard={destinationIndicator}
                              isSelected={false}
                              isDestinationIndicator={true}
                              onClick={(_shard, event) => {
                                // Handle destination indicator click - Requirements: 5.8
                                event.stopPropagation();
                                
                                // Find source node (the node where the selected shard currently is)
                                const sourceNode = nodes.find(n => 
                                  n.id === selectedShard?.node || n.name === selectedShard?.node
                                );
                                
                                // Destination node is the current node in the loop
                                const destinationNode = node;
                                
                                if (sourceNode && destinationNode && selectedShard) {
                                  // Set state for confirmation dialog
                                  setConfirmDialogSourceNode(sourceNode);
                                  setConfirmDialogDestinationNode(destinationNode);
                                  setConfirmDialogOpened(true);
                                }
                              }}
                            />
                          )}
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
      
      {/* Context menu - Requirements: 4.2, 4.8, 4.9 */}
      {contextMenuShard && (
        <ShardContextMenu
          shard={contextMenuShard}
          opened={contextMenuOpened}
          position={contextMenuPosition}
          onClose={handleContextMenuClose}
          onShowStats={handleShowStats}
          onSelectForRelocation={handleSelectForRelocation}
        />
      )}
      
      {/* Shard stats modal - Requirements: 4.5, 4.6 */}
      <ShardStatsModal
        shard={statsModalShard}
        opened={statsModalOpened}
        onClose={() => setStatsModalOpened(false)}
        clusterId={clusterId}
      />
      
      {/* Relocation confirmation dialog - Requirements: 5.8, 5.9 */}
      <RelocationConfirmDialog
        shard={selectedShard}
        sourceNode={confirmDialogSourceNode}
        destinationNode={confirmDialogDestinationNode}
        opened={confirmDialogOpened}
        onClose={() => {
          setConfirmDialogOpened(false);
          setConfirmDialogSourceNode(null);
          setConfirmDialogDestinationNode(null);
        }}
        onConfirm={handleRelocationConfirm}
      />
    </Box>
  );
}
