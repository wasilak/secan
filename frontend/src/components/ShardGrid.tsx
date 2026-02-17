import { Box, ScrollArea, Table, Text, Group, Stack, Skeleton, Collapse, ActionIcon, Loader, Anchor } from '@mantine/core';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDebouncedCallback, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ShardInfo, NodeWithShards } from '../types/api';
import { ShardCell } from './ShardCell';
import { ShardContextMenu } from './ShardContextMenu';
import { ShardStatsModal } from './ShardStatsModal';
import { RelocationConfirmDialog } from './RelocationConfirmDialog';
import { useShardGridStore } from '../stores/shard-grid-store';
import { getShardsForNodeAndIndex } from '../utils/shard-grid-parser';
import { parseShardGridData } from '../utils/shard-grid-parser';
import { apiClient } from '../api/client';

/**
 * Props for ShardGrid component
 */
interface ShardGridProps {
  clusterId: string;
  refreshInterval?: number;
  openNodeModal?: (nodeId: string) => void;
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
  openNodeModal,
}: ShardGridProps): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Responsive breakpoints - Requirements: 11.1, 11.5, 11.9
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1366px)');
  
  // Collapsible state for node stats and index metadata - Requirements: 11.6, 11.7
  const [nodeStatsCollapsed, setNodeStatsCollapsed] = useState<Record<string, boolean>>({});
  const [indexMetadataCollapsed, setIndexMetadataCollapsed] = useState<Record<string, boolean>>({});
  
  // Compact view state - Requirements: 11.10
  const [compactView, setCompactView] = useState(false);
  
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
    isPolling,
    selectShard,
    enterRelocationMode,
    exitRelocationMode,
    startPolling,
    stopPolling,
    addRelocatingShard,
    setNodes,
    setIndices,
    setUnassignedShards,
    setLoading,
    getCachedData,
    setCacheData,
    invalidateCache,
  } = useShardGridStore();
  
  // Debounced scroll handler for performance - Requirements: 9.4
  // This prevents excessive re-renders during scrolling
  const handleScroll = useDebouncedCallback(() => {
    // Scroll handling logic if needed
    // The virtualizer already handles scroll efficiently
    // This is here for any additional scroll-based logic
  }, 100); // 100ms debounce
  
  // Add scroll event listener - Requirements: 9.4
  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  /**
   * Fetch cluster state and update shard grid
   * 
   * This function fetches nodes, indices, and shards from the backend,
   * parses them into the shard grid data structure, and updates the store.
   * 
   * Uses caching to reduce unnecessary API calls - Requirements: 9.7
   * 
   * Also checks for relocation completion and handles cleanup.
   * 
   * Requirements: 7.2, 7.3, 7.7, 7.8, 7.10, 9.7
   */
  const fetchClusterState = useCallback(async () => {
    if (!clusterId) {
      return;
    }
    
    // Check cache first - Requirements: 9.7
    const cachedData = getCachedData();
    if (cachedData && !isPolling) {
      // Use cached data if available and not polling
      // (during polling we want fresh data)
      setNodes(cachedData.nodes);
      setIndices(cachedData.indices);
      setUnassignedShards(cachedData.unassignedShards);
      return;
    }
    
    try {
      // Fetch nodes, indices, and shards in parallel
      const [nodesData, indicesData, shardsData] = await Promise.all([
        apiClient.getNodes(clusterId),
        apiClient.getIndices(clusterId),
        apiClient.getShards(clusterId),
      ]);
      
      // Parse the data into shard grid structure
      const gridData = parseShardGridData(nodesData, indicesData, shardsData);
      
      // Update cache - Requirements: 9.7
      setCacheData(gridData.nodes, gridData.indices, gridData.unassignedShards);
      
      // Check for relocation completion if we're polling - Requirements: 7.7, 7.8
      if (isPolling) {
        // Get the current relocating shards from the store
        const { relocatingShards, removeRelocatingShard, stopPolling: stopPollingAction, pollingStartTime } = useShardGridStore.getState();
        
        // Check for polling timeout - Requirements: 7.12
        // Timeout is 5 minutes (300000 milliseconds)
        const POLLING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        if (pollingStartTime && Date.now() - pollingStartTime > POLLING_TIMEOUT_MS) {
          // Stop polling due to timeout
          stopPollingAction();
          
          // Show timeout notification for any remaining relocating shards
          if (relocatingShards.size > 0) {
            notifications.show({
              color: 'yellow',
              icon: <IconX size={18} />,
              title: 'Relocation Monitoring Timeout',
              message: `Stopped monitoring after 5 minutes. ${relocatingShards.size} shard(s) may still be relocating. Please refresh the page to check current status or view cluster health for more details.`,
              autoClose: 15000,
            });
          }
          
          // Don't process relocation checks if we've timed out
          return;
        }
        
        // Check each relocating shard to see if it's completed
        const completedShards: ShardInfo[] = [];
        const failedShards: ShardInfo[] = [];
        
        for (const shardKey of relocatingShards) {
          // Parse the shard key (format: "index:shard:primary")
          const [index, shardNumStr, primaryStr] = shardKey.split(':');
          const shardNum = parseInt(shardNumStr, 10);
          const primary = primaryStr === 'true';
          
          // Find this shard in the new data
          const shard = shardsData.find(s => 
            s.index === index && 
            s.shard === shardNum && 
            s.primary === primary
          );
          
          if (shard) {
            // Check if relocation is complete - Requirements: 7.7, 7.8
            // Relocation is complete when:
            // 1. Shard is no longer in RELOCATING state
            // 2. Shard is in STARTED state (healthy)
            if (shard.state === 'STARTED' && !shard.relocatingNode) {
              completedShards.push(shard);
              removeRelocatingShard(shard);
            }
            // Check if relocation failed - Requirements: 7.9
            // Relocation fails when:
            // 1. Shard goes back to UNASSIGNED state
            else if (shard.state === 'UNASSIGNED') {
              failedShards.push(shard);
              removeRelocatingShard(shard);
            }
          } else {
            // If we can't find the shard at all, it might have been deleted
            // Remove it from tracking
            const dummyShard: ShardInfo = {
              index,
              shard: shardNum,
              primary,
              state: 'UNASSIGNED',
              docs: 0,
              store: 0,
            };
            removeRelocatingShard(dummyShard);
          }
        }
        
        // Show success notifications for completed relocations - Requirements: 7.7
        for (const shard of completedShards) {
          notifications.show({
            color: 'green',
            icon: <IconCheck size={18} />,
            title: 'Relocation Successful',
            message: `Shard ${shard.shard} of index "${shard.index}" has been successfully relocated and is now active on the destination node.`,
            autoClose: 5000,
          });
        }
        
        // Show error notifications for failed relocations - Requirements: 7.9
        for (const shard of failedShards) {
          notifications.show({
            color: 'red',
            icon: <IconX size={18} />,
            title: 'Relocation Failed',
            message: `Shard ${shard.shard} of index "${shard.index}" could not be relocated and is now unassigned. Check cluster logs for details or try relocating again.`,
            autoClose: false, // Don't auto-close error messages
          });
        }
        
        // Stop polling if no more shards are relocating - Requirements: 7.10
        const remainingRelocatingShards = useShardGridStore.getState().relocatingShards;
        if (remainingRelocatingShards.size === 0) {
          stopPollingAction();
        }
      }
      
      // Update store with new data
      setNodes(gridData.nodes);
      setIndices(gridData.indices);
      setUnassignedShards(gridData.unassignedShards);
    } catch (err) {
      console.error('Failed to fetch cluster state:', err);
      // Don't show error notification during polling - it's too noisy
      // The error state in the store will be handled by the component
    }
  }, [clusterId, isPolling, setNodes, setIndices, setUnassignedShards, getCachedData, setCacheData]);
  
  // Auto-refresh logic - Requirements: 3.12
  useEffect(() => {
    if (!clusterId) {
      return;
    }
    
    // Initial fetch
    setLoading(true);
    fetchClusterState().finally(() => setLoading(false));
    
    // Set up polling interval for regular refresh
    const intervalId = setInterval(() => {
      fetchClusterState();
    }, refreshInterval);
    
    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [clusterId, refreshInterval, fetchClusterState, setLoading]);
  
  // Cleanup polling on unmount - Requirements: 7.10
  useEffect(() => {
    return () => {
      // Stop polling when component unmounts
      stopPolling();
    };
  }, [stopPolling]);
  
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
  
  // Handle shard click - Requirements: 4.1, 4.2, 11.4
  const handleShardClick = (shard: ShardInfo, event: React.MouseEvent | React.TouchEvent) => {
    // Update selected shard in state
    selectShard(shard);
    
    // Get position from mouse or touch event - Requirements: 11.4
    let clientX: number;
    let clientY: number;
    
    if ('touches' in event && event.touches.length > 0) {
      // Touch event
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      // Mouse event
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      // Fallback
      clientX = 0;
      clientY = 0;
    }
    
    // Open context menu near the clicked shard - Requirements: 4.2, 4.9
    setContextMenuShard(shard);
    setContextMenuPosition({
      x: clientX,
      y: clientY,
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
  
  // Handle relocation confirmation - Requirements: 5.10, 5.11, 5.12, 6.1, 7.1, 7.2, 9.7
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
        
        // Invalidate cache on mutation - Requirements: 9.7
        invalidateCache();
        
        // Show success notification - Requirements: 5.11, 7.1
        notifications.show({
          color: 'green',
          icon: <IconCheck size={18} />,
          title: 'Relocation Started',
          message: `Shard ${selectedShard.shard} of index "${selectedShard.index}" is being relocated from ${confirmDialogSourceNode.name} to ${confirmDialogDestinationNode.name}. Progress will be tracked automatically.`,
          autoClose: 5000,
        });
        
        // Add shard to relocating set for tracking
        addRelocatingShard(selectedShard);
        
        // Start polling for relocation progress - Requirements: 7.2, 7.3
        // Poll every 2 seconds to track relocation progress
        const pollingIntervalId = window.setInterval(() => {
          fetchClusterState();
        }, 2000);
        
        startPolling(pollingIntervalId);
        
        // Exit relocation mode after successful relocation
        exitRelocationMode();
        
        // Close confirmation dialog
        setConfirmDialogOpened(false);
        setConfirmDialogSourceNode(null);
        setConfirmDialogDestinationNode(null);
      } catch (error) {
        // Show error notification - Requirements: 5.12, 8.10
        let errorMessage = 'An unexpected error occurred';
        let actionableGuidance = 'Please try again or contact support if the problem persists.';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Provide actionable guidance based on error type
          if (errorMessage.includes('validation_failed')) {
            actionableGuidance = 'Please check that the source and destination nodes are valid and different.';
          } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            actionableGuidance = 'Check your network connection and try again.';
          } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
            actionableGuidance = 'You may not have permission to relocate shards. Contact your administrator.';
          } else if (errorMessage.includes('not found')) {
            actionableGuidance = 'The shard or node may have been removed. Refresh the page and try again.';
          } else if (errorMessage.includes('already relocating')) {
            actionableGuidance = 'This shard is already being relocated. Wait for the current relocation to complete.';
          }
        }
        
        notifications.show({
          color: 'red',
          icon: <IconX size={18} />,
          title: 'Relocation Failed',
          message: `${errorMessage}. ${actionableGuidance}`,
          autoClose: false, // Don't auto-close error messages
        });
        
        // Re-throw to let the dialog handle loading state
        throw error;
      }
    }
  };
  
  // Format percentage - Requirements: 9.3
  const formatPercent = useCallback((value: number): string => {
    return `${Math.round(value)}%`;
  }, []);
  
  // Format load average - Requirements: 9.3
  const formatLoad = useCallback((load?: number): string => {
    if (load === undefined) return 'N/A';
    return load.toFixed(2);
  }, []);
  
  // Format number with commas - Requirements: 9.3
  const formatNumber = useCallback((value: number): string => {
    return value.toLocaleString();
  }, []);
  
  // Format size in bytes to human-readable format - Requirements: 9.3
  const formatSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);
  
  // Toggle node stats collapse - Requirements: 11.6
  const toggleNodeStats = useCallback((nodeId: string) => {
    setNodeStatsCollapsed(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);
  
  // Toggle index metadata collapse - Requirements: 11.7
  const toggleIndexMetadata = useCallback((indexName: string) => {
    setIndexMetadataCollapsed(prev => ({
      ...prev,
      [indexName]: !prev[indexName],
    }));
  }, []);
  
  // Determine if we should use virtualization - Requirements: 9.1, 9.2, 9.3
  // Enable virtualization for grids with >20 nodes or >20 indices
  // Memoize this calculation to avoid unnecessary re-renders
  // IMPORTANT: This must be called before any early returns to comply with React hooks rules
  const shouldVirtualize = useMemo(() => {
    return nodes.length > 20 || indices.length > 20;
  }, [nodes.length, indices.length]);
  
  // Calculate responsive sizes - Requirements: 11.1, 11.3, 11.10
  // Adjust column width and row height based on screen size and compact view
  // IMPORTANT: These must be called before any early returns to comply with React hooks rules
  const columnWidth = useMemo(() => {
    if (compactView) return isMobile ? 100 : 120; // Smaller in compact view
    if (isMobile) return 120; // Smaller columns on mobile
    if (isTablet) return 140; // Medium columns on tablet
    return 150; // Full columns on desktop
  }, [isMobile, isTablet, compactView]);
  
  const rowHeight = useMemo(() => {
    if (compactView) return isMobile ? 80 : 60; // Shorter in compact view
    if (isMobile) return 100; // Taller rows on mobile for better touch targets
    return 80; // Standard height on larger screens
  }, [isMobile, compactView]);
  
  const nodeColumnWidth = useMemo(() => {
    if (compactView) return isMobile ? 160 : 200; // Narrower in compact view
    if (isMobile) return 200; // Narrower node column on mobile
    return 250; // Full width on larger screens
  }, [isMobile, compactView]);
  
  // Set up row virtualizer for nodes - Requirements: 9.1
  // IMPORTANT: This must be called before any early returns to comply with React hooks rules
  const rowVirtualizer = useVirtualizer({
    count: nodes.length + (unassignedShards.length > 0 ? 1 : 0), // +1 for unassigned row if needed
    getScrollElement: () => scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') || null,
    estimateSize: () => rowHeight, // Use responsive row height
    overscan: 5, // Render 5 extra rows above and below viewport
    enabled: shouldVirtualize,
  });
  
  // Set up column virtualizer for indices - Requirements: 9.2
  // IMPORTANT: This must be called before any early returns to comply with React hooks rules
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: indices.length,
    getScrollElement: () => scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') || null,
    estimateSize: () => columnWidth, // Use responsive column width
    overscan: 3, // Render 3 extra columns left and right of viewport
    enabled: shouldVirtualize,
  });
  
  // Get virtual items - Requirements: 9.3
  // Memoize virtual items to avoid unnecessary recalculations
  // IMPORTANT: These must be called before any early returns to comply with React hooks rules
  const virtualRows = useMemo(() => {
    return shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
  }, [shouldVirtualize, rowVirtualizer]);
  
  const virtualColumns = useMemo(() => {
    return shouldVirtualize ? columnVirtualizer.getVirtualItems() : [];
  }, [shouldVirtualize, columnVirtualizer]);
  
  // Early returns AFTER all hooks have been called
  if (loading) {
    // Display loading skeleton while fetching - Requirements: 9.9
    return (
      <Box p="md">
        <Stack gap="md">
          <Text size="sm" c="dimmed">Loading shard grid...</Text>
          <Skeleton height={50} radius="md" />
          <Skeleton height={200} radius="md" />
          <Skeleton height={200} radius="md" />
          <Skeleton height={200} radius="md" />
        </Stack>
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
      {/* Compact view toggle and polling indicator - Requirements: 11.10, 9.9 */}
      <Group gap="xs" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }} justify="space-between">
        <Group gap="xs">
          <ActionIcon
            variant={compactView ? 'filled' : 'light'}
            onClick={() => setCompactView(!compactView)}
            aria-label={compactView ? 'Switch to normal view' : 'Switch to compact view'}
            title={compactView ? 'Normal view' : 'Compact view'}
          >
            <IconChevronDown size={18} />
          </ActionIcon>
          <Text size="sm" c="dimmed">
            {compactView ? 'Compact view' : 'Normal view'}
          </Text>
        </Group>
        
        {/* Polling indicator - Requirements: 9.9 */}
        {isPolling && (
          <Group gap="xs">
            <Loader size="xs" color="blue" />
            <Text size="sm" c="blue">
              Tracking relocation progress...
            </Text>
          </Group>
        )}
      </Group>
      
      {/* Grid container with scrolling */}
      <ScrollArea
        ref={scrollAreaRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          // Use CSS transforms for smooth scrolling - Requirements: 9.4, 9.5
          willChange: 'transform',
          transform: 'translateZ(0)', // Force GPU acceleration
          // Enable pinch-to-zoom on touch devices - Requirements: 11.8
          touchAction: isMobile ? 'pinch-zoom' : 'auto',
        }}
        type="always"
      >
        {shouldVirtualize ? (
          // Virtualized rendering for large grids - Requirements: 9.1, 9.2
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: `${columnVirtualizer.getTotalSize() + nodeColumnWidth}px`, // Use responsive node column width
              position: 'relative',
            }}
          >
            {/* Sticky header row */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'var(--mantine-color-body)',
                display: 'flex',
                borderBottom: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              {/* Node column header */}
              <div
                style={{
                  width: `${nodeColumnWidth}px`,
                  minWidth: `${nodeColumnWidth}px`,
                  padding: '12px',
                  fontWeight: 600,
                  position: 'sticky',
                  left: 0,
                  zIndex: 11,
                  backgroundColor: 'var(--mantine-color-body)',
                  borderRight: '1px solid var(--mantine-color-gray-3)',
                }}
              >
                Node
              </div>
              
              {/* Virtual index column headers */}
              {virtualColumns.map((virtualColumn) => {
                const index = indices[virtualColumn.index];
                return (
                  <div
                    key={index.name}
                    style={{
                      position: 'absolute',
                      left: `${virtualColumn.start + nodeColumnWidth}px`,
                      width: `${virtualColumn.size}px`,
                      padding: '12px',
                      textAlign: 'center',
                      borderRight: '1px solid var(--mantine-color-gray-3)',
                    }}
                  >
                    <Stack gap="xs" align="center">
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
                  </div>
                );
              })}
            </div>
            
            {/* Virtual rows */}
            {virtualRows.map((virtualRow) => {
              const isUnassignedRow = virtualRow.index === nodes.length;
              const node = isUnassignedRow ? null : nodes[virtualRow.index];
              
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: `${virtualRow.start}px`,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    display: 'flex',
                    borderBottom: '1px solid var(--mantine-color-gray-3)',
                  }}
                >
                  {/* Node info column (sticky) */}
                  <div
                    style={{
                      width: `${nodeColumnWidth}px`,
                      minWidth: `${nodeColumnWidth}px`,
                      padding: '12px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      backgroundColor: 'var(--mantine-color-body)',
                      borderRight: '1px solid var(--mantine-color-gray-3)',
                    }}
                  >
                    {isUnassignedRow ? (
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
                    ) : node ? (
                      <Stack gap="xs">
                        <Box>
                          <Text fw={600} size="sm">
                            {node.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {node.ip || 'N/A'}
                          </Text>
                        </Box>
                        <Group gap="xs" wrap="wrap">
                          <Text size="xs" c="dimmed">
                            Heap: {formatPercent((node.heapUsed / node.heapMax) * 100)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Disk: {formatPercent((node.diskUsed / node.diskTotal) * 100)}
                          </Text>
                          {node.cpuPercent !== undefined && (
                            <Text size="xs" c="dimmed">
                              CPU: {formatPercent(node.cpuPercent)}
                            </Text>
                          )}
                          {node.loadAverage !== undefined && (
                            <Text size="xs" c="dimmed">
                              Load: {formatLoad(node.loadAverage)}
                            </Text>
                          )}
                        </Group>
                      </Stack>
                    ) : null}
                  </div>
                  
                  {/* Virtual shard cells */}
                  {virtualColumns.map((virtualColumn) => {
                    const index = indices[virtualColumn.index];
                    
                    if (isUnassignedRow) {
                      // Render unassigned shards for this index
                      const indexUnassignedShards = unassignedShards.filter(
                        (shard) => shard.index === index.name
                      );
                      
                      return (
                        <div
                          key={`unassigned-${index.name}`}
                          style={{
                            position: 'absolute',
                            left: `${virtualColumn.start + nodeColumnWidth}px`,
                            width: `${virtualColumn.size}px`,
                            padding: '12px',
                            textAlign: 'center',
                            borderRight: '1px solid var(--mantine-color-gray-3)',
                          }}
                        >
                          {indexUnassignedShards.length > 0 ? (
                            <Group gap="xs" justify="center" wrap="wrap">
                              {indexUnassignedShards.map((shard) => {
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
                        </div>
                      );
                    } else if (node) {
                      // Render shards for this node and index
                      const shards = getShardsForNodeAndIndex(node, index.name);
                      const destinationIndicator = relocationMode && 
                        destinationIndicators.has(node.id) &&
                        destinationIndicators.get(node.id)?.index === index.name
                          ? destinationIndicators.get(node.id)
                          : null;
                      
                      return (
                        <div
                          key={`${node.id}-${index.name}`}
                          style={{
                            position: 'absolute',
                            left: `${virtualColumn.start + nodeColumnWidth}px`,
                            width: `${virtualColumn.size}px`,
                            padding: '12px',
                            textAlign: 'center',
                            borderRight: '1px solid var(--mantine-color-gray-3)',
                          }}
                        >
                          {shards.length > 0 || destinationIndicator ? (
                            <Group gap="xs" justify="center" wrap="wrap">
                              {shards.map((shard) => {
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
                              
                              {destinationIndicator && (
                                <ShardCell
                                  key={`destination-${destinationIndicator.index}-${destinationIndicator.shard}`}
                                  shard={destinationIndicator}
                                  isSelected={false}
                                  isDestinationIndicator={true}
                                  onClick={(_shard, event) => {
                                    event.stopPropagation();
                                    const sourceNode = nodes.find(n => 
                                      n.id === selectedShard?.node || n.name === selectedShard?.node
                                    );
                                    const destinationNode = node;
                                    
                                    if (sourceNode && destinationNode && selectedShard) {
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
                        </div>
                      );
                    }
                    
                    return null;
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          // Non-virtualized rendering for small grids
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            style={{
              minWidth: '100%',
              tableLayout: 'fixed',
              // Ensure touch targets are large enough on mobile - Requirements: 11.3
              fontSize: isMobile ? '14px' : compactView ? '12px' : '13px',
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
                    width: `${nodeColumnWidth}px`,
                    minWidth: `${nodeColumnWidth}px`,
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
                      width: `${columnWidth}px`,
                      minWidth: `${columnWidth}px`,
                      textAlign: 'center',
                      verticalAlign: 'top',
                    }}
                  >
                    <Stack gap="xs" align="center">
                      {/* Index name with collapse toggle on small screens */}
                      <Group gap="xs" justify="center" wrap="nowrap">
                        <Box
                          style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: (isMobile || isTablet) ? '80px' : '100%',
                            textAlign: 'center',
                          }}
                          title={index.name}
                        >
                          {index.name}
                        </Box>
                        
                        {/* Collapse toggle button on small screens - Requirements: 11.7 */}
                        {(isMobile || isTablet) && (
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={() => toggleIndexMetadata(index.name)}
                            aria-label={indexMetadataCollapsed[index.name] ? 'Show index metadata' : 'Hide index metadata'}
                          >
                            {indexMetadataCollapsed[index.name] ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
                          </ActionIcon>
                        )}
                      </Group>
                      
                      {/* Index metadata - collapsible on small screens */}
                      {(isMobile || isTablet) ? (
                        <Collapse in={!indexMetadataCollapsed[index.name]}>
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
                        </Collapse>
                      ) : (
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
                      )}
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
                    width: `${nodeColumnWidth}px`,
                    minWidth: `${nodeColumnWidth}px`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: 'var(--mantine-color-body)',
                  }}
                >
                  <Stack gap="xs">
                    {/* Node name and IP with collapse toggle on small screens */}
                    <Group gap="xs" justify="space-between" wrap="nowrap">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        {openNodeModal ? (
                          <Anchor
                            component="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNodeModal(node.id);
                            }}
                            style={{ 
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openNodeModal(node.id);
                              }
                            }}
                          >
                            <Text fw={600} size="sm" style={{ textDecoration: 'inherit' }}>
                              {node.name}
                            </Text>
                          </Anchor>
                        ) : (
                          <Text fw={600} size="sm">
                            {node.name}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {node.ip || 'N/A'}
                        </Text>
                      </Box>
                      
                      {/* Collapse toggle button on small screens - Requirements: 11.6 */}
                      {(isMobile || isTablet) && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => toggleNodeStats(node.id)}
                          aria-label={nodeStatsCollapsed[node.id] ? 'Show node stats' : 'Hide node stats'}
                        >
                          {nodeStatsCollapsed[node.id] ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                        </ActionIcon>
                      )}
                    </Group>
                    
                    {/* Node statistics - collapsible on small screens */}
                    {(isMobile || isTablet) ? (
                      <Collapse in={!nodeStatsCollapsed[node.id]}>
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
                      </Collapse>
                    ) : (
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
                    )}
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
                        width: `${columnWidth}px`,
                        minWidth: `${columnWidth}px`,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        // Ensure adequate padding for touch targets on mobile - Requirements: 11.3, 11.10
                        padding: isMobile ? '16px 8px' : compactView ? '6px' : '12px',
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
                    width: `${nodeColumnWidth}px`,
                    minWidth: `${nodeColumnWidth}px`,
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
                        width: `${columnWidth}px`,
                        minWidth: `${columnWidth}px`,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        // Ensure adequate padding for touch targets on mobile - Requirements: 11.3, 11.10
                        padding: isMobile ? '16px 8px' : compactView ? '6px' : '12px',
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
        )}
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
