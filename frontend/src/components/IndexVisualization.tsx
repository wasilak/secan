import {
  Box,
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Alert,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery, useViewportSize } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import { getHealthColor, getShardBorderColor } from '../utils/colors';
import {
  calculateNodePositions,
  DEFAULT_POSITIONING_CONFIG,
  type NodePosition,
  type PositioningConfig,
} from '../utils/nodePositioning';
import { formatBytes } from '../utils/formatters';
import type { HealthStatus, ShardInfo } from '../types/api';
import { useMemo } from 'react';

/**
 * Responsive font size configuration
 * 
 * Requirements: 8.4 - Scale font sizes based on zoom level and viewport size
 * 
 * Calculates font sizes that scale proportionally with viewport width
 * to maintain readability at different screen sizes.
 */
interface ResponsiveFontSizes {
  /** Font size for shard indicators (numbers inside shard boxes) */
  shardIndicator: string;
  /** Font size for node card titles (node names) */
  nodeTitle: string;
  /** Font size for node card labels (e.g., "Shards:") */
  nodeLabel: string;
  /** Font size for center index title */
  centerTitle: string;
  /** Font size for center index labels */
  centerLabel: string;
  /** Font size for tooltip content */
  tooltipContent: string;
  /** Font size for tooltip headers */
  tooltipHeader: string;
}

/**
 * Calculate responsive font sizes based on viewport width
 * 
 * Requirements: 8.4 - Ensure readability at different viewport sizes
 * 
 * Uses a scaling factor based on viewport width to adjust font sizes:
 * - Mobile (< 768px): Smaller base sizes with moderate scaling
 * - Tablet (768px - 1024px): Medium base sizes with proportional scaling
 * - Desktop (> 1024px): Standard base sizes
 * 
 * @param viewportWidth - Current viewport width in pixels
 * @returns Object containing responsive font sizes
 */
function calculateResponsiveFontSizes(viewportWidth: number): ResponsiveFontSizes {
  // Define breakpoints
  const MOBILE_BREAKPOINT = 768;
  const TABLET_BREAKPOINT = 1024;
  const DESKTOP_BREAKPOINT = 1440;
  
  // Calculate scaling factor based on viewport width
  // Requirements: 8.4 - Scale font sizes based on viewport size
  let scaleFactor: number;
  
  if (viewportWidth < MOBILE_BREAKPOINT) {
    // Mobile: scale from 0.85 to 1.0 as width increases from 320px to 768px
    scaleFactor = 0.85 + ((viewportWidth - 320) / (MOBILE_BREAKPOINT - 320)) * 0.15;
  } else if (viewportWidth < TABLET_BREAKPOINT) {
    // Tablet: scale from 1.0 to 1.1 as width increases from 768px to 1024px
    scaleFactor = 1.0 + ((viewportWidth - MOBILE_BREAKPOINT) / (TABLET_BREAKPOINT - MOBILE_BREAKPOINT)) * 0.1;
  } else if (viewportWidth < DESKTOP_BREAKPOINT) {
    // Desktop: scale from 1.1 to 1.2 as width increases from 1024px to 1440px
    scaleFactor = 1.1 + ((viewportWidth - TABLET_BREAKPOINT) / (DESKTOP_BREAKPOINT - TABLET_BREAKPOINT)) * 0.1;
  } else {
    // Large desktop: cap at 1.2x
    scaleFactor = 1.2;
  }
  
  // Clamp scale factor to reasonable bounds
  scaleFactor = Math.max(0.85, Math.min(1.2, scaleFactor));
  
  // Base font sizes (in pixels)
  const BASE_SHARD_INDICATOR = 12;
  const BASE_NODE_TITLE = 14;
  const BASE_NODE_LABEL = 12;
  const BASE_CENTER_TITLE = 18;
  const BASE_CENTER_LABEL = 14;
  const BASE_TOOLTIP_CONTENT = 12;
  const BASE_TOOLTIP_HEADER = 14;
  
  // Apply scaling factor to all font sizes
  // Requirements: 8.4 - Font sizes scale proportionally
  return {
    shardIndicator: `${Math.round(BASE_SHARD_INDICATOR * scaleFactor)}px`,
    nodeTitle: `${Math.round(BASE_NODE_TITLE * scaleFactor)}px`,
    nodeLabel: `${Math.round(BASE_NODE_LABEL * scaleFactor)}px`,
    centerTitle: `${Math.round(BASE_CENTER_TITLE * scaleFactor)}px`,
    centerLabel: `${Math.round(BASE_CENTER_LABEL * scaleFactor)}px`,
    tooltipContent: `${Math.round(BASE_TOOLTIP_CONTENT * scaleFactor)}px`,
    tooltipHeader: `${Math.round(BASE_TOOLTIP_HEADER * scaleFactor)}px`,
  };
}

/**
 * Props for the CenterIndexElement component
 * 
 * Requirements: 1.1, 4.4, 4.5
 */
interface CenterIndexElementProps {
  /**
   * Index name to display
   */
  indexName: string;
  
  /**
   * Health status of the index (green, yellow, red)
   */
  health: HealthStatus;
  
  /**
   * Total number of primary shards
   */
  primaryShards: number;
  
  /**
   * Total number of replica shards
   */
  replicaShards: number;
  
  /**
   * Responsive font sizes for scaling
   * Requirements: 8.4
   */
  fontSizes: ResponsiveFontSizes;
}

/**
 * Props for the NodeCard component
 * 
 * Requirements: 2.1, 2.2, 4.1
 */
interface NodeCardProps {
  /**
   * Node position information
   */
  node: NodePosition;
  
  /**
   * Optional callback when node is clicked
   */
  onClick?: (nodeId: string) => void;
  
  /**
   * Optional node metrics for tooltip display
   * These will be populated when real node data is available
   */
  nodeMetrics?: {
    heapUsed?: number;
    heapMax?: number;
    diskUsed?: number;
    diskTotal?: number;
    cpuPercent?: number;
  };
  
  /**
   * Responsive font sizes for scaling
   * Requirements: 8.4
   */
  fontSizes: ResponsiveFontSizes;
}

/**
 * Props for the ConnectionLines component
 * 
 * Requirements: 1.4
 */
interface ConnectionLinesProps {
  /**
   * Array of primary node positions
   */
  primaryNodes: NodePosition[];
  
  /**
   * Array of replica node positions
   */
  replicaNodes: NodePosition[];
  
  /**
   * X coordinate of the center index element
   */
  centerX: number;
  
  /**
   * Y coordinate of the center index element (center point)
   */
  centerY: number;
  
  /**
   * Width of the center index element
   */
  centerWidth: number;
  
  /**
   * Width of node cards
   */
  nodeWidth: number;
  
  /**
   * Height of node cards
   */
  nodeHeight: number;
}

/**
 * Props for the ShardIndicator component
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2
 */
interface ShardIndicatorProps {
  /**
   * Shard information to display
   */
  shard: ShardInfo;
  
  /**
   * Responsive font sizes for scaling
   * Requirements: 8.4
   */
  fontSizes: ResponsiveFontSizes;
}

/**
 * ShardIndicator Component
 * 
 * Renders an individual shard indicator with color coding based on shard state.
 * Displays shard number for primary shards, and shard + replica number for replicas.
 * Reuses the pattern from ShardCell component with transparent background and colored border.
 * Shows detailed shard information on hover via tooltip.
 * 
 * Color coding (Requirements 3.1, 3.2, 3.3, 3.4, 3.5):
 * - STARTED: Green border (healthy)
 * - INITIALIZING: Yellow border (transitional)
 * - RELOCATING: Orange border (transitional)
 * - UNASSIGNED: Red border (critical)
 * 
 * Display format (Requirements 6.1, 6.2):
 * - Primary shards: Show shard number only (e.g., "0", "1", "2")
 * - Replica shards: Show shard number (e.g., "0", "1", "2")
 * 
 * Tooltip content (Requirement 4.2):
 * - Index name
 * - Shard number
 * - Shard type (primary/replica)
 * - State
 * - Document count
 * - Size (formatted using formatBytes)
 * 
 * @param props - Component props
 * @returns Shard indicator element with tooltip
 */
function ShardIndicator({ shard, fontSizes }: ShardIndicatorProps) {
  const borderColor = getShardBorderColor(shard.state);
  const cellSize = 32; // Smaller than ShardCell for compact display in node cards
  
  /**
   * Tooltip content with shard details
   * Requirements: 4.2 - Display index, shard number, state, docs, size
   * Requirements: 8.4 - Use responsive font sizes in tooltips
   */
  const tooltipContent = (
    <div style={{ fontSize: fontSizes.tooltipContent }}>
      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: fontSizes.tooltipHeader }}>
        Shard {shard.shard}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Index:</strong> {shard.index}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Type:</strong> {shard.primary ? 'Primary' : 'Replica'}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>State:</strong> {shard.state}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Documents:</strong> {shard.docs.toLocaleString()}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Size:</strong> {formatBytes(shard.store)}
      </div>
    </div>
  );
  
  return (
    <Tooltip
      label={tooltipContent}
      position="top"
      withArrow
      arrowSize={6}
      offset={8}
      openDelay={200}
      transitionProps={{ duration: 150 }}
      multiline
      w={250}
    >
      <Box
        style={{
          width: `${cellSize}px`,
          height: `${cellSize}px`,
          minWidth: `${cellSize}px`,
          minHeight: `${cellSize}px`,
          border: `2px solid ${borderColor}`,
          backgroundColor: 'transparent',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fontSizes.shardIndicator, // Requirements: 8.4 - Responsive font size
          fontWeight: 600,
          color: 'var(--mantine-color-gray-9)',
          userSelect: 'none',
          position: 'relative',
        }}
        // Accessibility
        role="gridcell"
        aria-label={`Shard ${shard.shard} of index ${shard.index}, ${shard.primary ? 'primary' : 'replica'}, state ${shard.state}`}
      >
        {/* Shard number - Requirements: 6.1, 6.2 */}
        {shard.shard}
        
        {/* Primary indicator (small dot in corner) - Requirements: 6.1 */}
        {shard.primary && (
          <Box
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-blue-6)',
            }}
            aria-hidden="true"
          />
        )}
      </Box>
    </Tooltip>
  );
}

/**
 * ConnectionLines Component
 * 
 * Renders SVG lines connecting the center index element to each node card.
 * Uses curved paths for a more polished APM-style appearance.
 * Primary nodes (left) use blue lines, replica nodes (right) use green lines.
 * 
 * Requirements: 1.4
 * 
 * @param props - Component props
 * @returns SVG element with connection lines
 */
function ConnectionLines({
  primaryNodes,
  replicaNodes,
  centerX,
  centerY,
  centerWidth,
  nodeWidth,
  nodeHeight,
}: ConnectionLinesProps) {
  /**
   * Generate a curved SVG path from center to a node
   * Uses quadratic bezier curve for smooth connection
   * 
   * @param nodeX - X coordinate of the node
   * @param nodeY - Y coordinate of the node
   * @param isLeft - Whether the node is on the left side (primary)
   * @returns SVG path string
   */
  const generatePath = (nodeX: number, nodeY: number, isLeft: boolean): string => {
    // Calculate connection points
    const startX = isLeft ? centerX : centerX + centerWidth;
    const startY = centerY;
    
    const endX = isLeft ? nodeX + nodeWidth : nodeX;
    const endY = nodeY + nodeHeight / 2;
    
    // Calculate control point for bezier curve (midpoint with horizontal offset)
    const controlX = (startX + endX) / 2;
    const controlY = (startY + endY) / 2;
    
    // Create quadratic bezier curve path
    return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
  };
  
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Primary node connections (blue) */}
      {primaryNodes.map((node) => (
        <path
          key={`connection-primary-${node.nodeId}`}
          d={generatePath(node.x, node.y, true)}
          stroke="#228be6"
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />
      ))}
      
      {/* Replica node connections (green) */}
      {replicaNodes.map((node) => (
        <path
          key={`connection-replica-${node.nodeId}`}
          d={generatePath(node.x, node.y, false)}
          stroke="#40c057"
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />
      ))}
    </svg>
  );
}

/**
 * NodeCard Component
 * 
 * Renders a node card with name, shard count, and individual shard indicators.
 * Used for both primary and replica nodes in the visualization.
 * Displays a tooltip on hover with detailed node information.
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 6.1, 6.2
 * 
 * @param props - Component props
 * @returns Node card element
 */
function NodeCard({ node, onClick, nodeMetrics, fontSizes }: NodeCardProps) {
  /**
   * Format bytes to human-readable size
   * 
   * @param bytes - Size in bytes
   * @returns Formatted size string
   */
  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  /**
   * Format percentage value
   * 
   * @param value - Percentage value (0-100)
   * @returns Formatted percentage string
   */
  const formatPercent = (value?: number): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(1)}%`;
  };
  
  /**
   * Tooltip content with node details
   * Requirements: 4.1 - Display node name, ID, shard count, heap, disk, CPU
   * Requirements: 8.4 - Use responsive font sizes in tooltips
   */
  const tooltipContent = (
    <div style={{ fontSize: fontSizes.tooltipContent }}>
      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: fontSizes.tooltipHeader }}>
        {node.nodeName}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Node ID:</strong> {node.nodeId}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Shard Count:</strong> {node.shardCount}
      </div>
      
      {nodeMetrics && (
        <>
          {nodeMetrics.heapUsed !== undefined && nodeMetrics.heapMax !== undefined && (
            <div style={{ marginBottom: '4px' }}>
              <strong>Heap:</strong> {formatBytes(nodeMetrics.heapUsed)} / {formatBytes(nodeMetrics.heapMax)}
              {' '}({formatPercent((nodeMetrics.heapUsed / nodeMetrics.heapMax) * 100)})
            </div>
          )}
          
          {nodeMetrics.diskUsed !== undefined && nodeMetrics.diskTotal !== undefined && (
            <div style={{ marginBottom: '4px' }}>
              <strong>Disk:</strong> {formatBytes(nodeMetrics.diskUsed)} / {formatBytes(nodeMetrics.diskTotal)}
              {' '}({formatPercent((nodeMetrics.diskUsed / nodeMetrics.diskTotal) * 100)})
            </div>
          )}
          
          {nodeMetrics.cpuPercent !== undefined && (
            <div style={{ marginBottom: '4px' }}>
              <strong>CPU:</strong> {formatPercent(nodeMetrics.cpuPercent)}
            </div>
          )}
        </>
      )}
      
      {!nodeMetrics && (
        <div style={{ marginTop: '8px', fontStyle: 'italic', color: 'var(--mantine-color-dimmed)' }}>
          Detailed metrics will be available when connected to real cluster data
        </div>
      )}
    </div>
  );
  
  return (
    <Tooltip
      label={tooltipContent}
      position="top"
      withArrow
      arrowSize={6}
      offset={8}
      openDelay={200}
      transitionProps={{ duration: 150 }}
      multiline
      w={300}
    >
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        withBorder
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: 180,
          cursor: onClick ? 'pointer' : 'default',
          zIndex: 1,
        }}
        onClick={() => onClick?.(node.nodeId)}
      >
        <Stack gap="xs">
          <Text size="sm" fw={600} truncate style={{ fontSize: fontSizes.nodeTitle }}>
            {node.nodeName}
          </Text>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" style={{ fontSize: fontSizes.nodeLabel }}>
              Shards:
            </Text>
            <Badge size="sm" variant="light">
              {node.shardCount}
            </Badge>
          </Group>
          
          {/* Individual shard indicators - Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2 */}
          <Group gap={4} wrap="wrap">
            {node.shards.map((shard) => (
              <ShardIndicator 
                key={`${shard.index}-${shard.shard}-${shard.primary}`} 
                shard={shard}
                fontSizes={fontSizes}
              />
            ))}
          </Group>
        </Stack>
      </Card>
    </Tooltip>
  );
}

/**
 * CenterIndexElement Component
 * 
 * Renders the center index card in the APM-style visualization.
 * Displays the index name, health status with color coding, and shard counts.
 * This is the focal point of the visualization that will be connected to nodes.
 * 
 * Requirements: 1.1, 4.4, 4.5
 * 
 * @param props - Component props
 * @returns Center index card element
 */
function CenterIndexElement({
  indexName,
  health,
  primaryShards,
  replicaShards,
  fontSizes,
}: CenterIndexElementProps) {
  return (
    <Card
      shadow="md"
      padding="lg"
      radius="md"
      withBorder
      style={{
        minWidth: 250,
        maxWidth: 300,
      }}
    >
      <Stack gap="sm">
        {/* Index name header - Requirements: 8.4 - Responsive font size */}
        <Text size="lg" fw={700} ta="center" style={{ fontSize: fontSizes.centerTitle }}>
          {indexName}
        </Text>
        
        {/* Health status badge with color coding */}
        <Group justify="center">
          <Badge
            color={getHealthColor(health)}
            variant="filled"
            size="lg"
          >
            {health.toUpperCase()}
          </Badge>
        </Group>
        
        {/* Shard counts - Requirements: 8.4 - Responsive font size */}
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed" style={{ fontSize: fontSizes.centerLabel }}>
              Primary Shards:
            </Text>
            <Text size="sm" fw={600} style={{ fontSize: fontSizes.centerLabel }}>
              {primaryShards}
            </Text>
          </Group>
          
          <Group justify="space-between">
            <Text size="sm" c="dimmed" style={{ fontSize: fontSizes.centerLabel }}>
              Replica Shards:
            </Text>
            <Text size="sm" fw={600} style={{ fontSize: fontSizes.centerLabel }}>
              {replicaShards}
            </Text>
          </Group>
        </Stack>
      </Stack>
    </Card>
  );
}

/**
 * Props for the IndexVisualization component
 * 
 * Requirements: 1.1, 7.1
 */
export interface IndexVisualizationProps {
  /**
   * Cluster ID to fetch shard data from
   */
  clusterId: string;
  
  /**
   * Index name to visualize
   */
  indexName: string;
  
  /**
   * Optional callback when a node is clicked
   * Allows navigation to node details
   */
  onNodeClick?: (nodeId: string) => void;
  
  /**
   * Optional refresh interval in milliseconds
   * Default: 30000 (30 seconds)
   */
  refreshInterval?: number;
}

/**
 * IndexVisualization Component
 * 
 * Displays an APM-style visualization of index shard distribution across cluster nodes.
 * Shows the index in the center with primary shard nodes on the left and replica shard
 * nodes on the right, connected by visual lines.
 * 
 * Features:
 * - Center index element with health status
 * - Primary shard nodes positioned on the left
 * - Replica shard nodes positioned on the right
 * - Visual connections between index and nodes
 * - Interactive tooltips on hover
 * - Node click navigation
 * - Automatic refresh
 * - Responsive layout
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2
 */
export function IndexVisualization({
  clusterId: _clusterId,
  indexName,
  onNodeClick,
  refreshInterval: _refreshInterval = 30000,
}: IndexVisualizationProps) {
  // TODO: Implement data fetching with useIndexShards hook (Task 2.1)
  // TODO: Implement data transformation logic (Task 3) - DONE: using calculateNodePositions
  // TODO: Implement SVG-based visualization rendering (Task 4.3 - visual connections)
  // TODO: Implement interactive elements (Task 6)
  // TODO: Implement responsive layout (Task 7) - IN PROGRESS
  // TODO: Implement visualization controls (Task 8)
  
  // Responsive breakpoint detection - Requirements: 8.1, 8.2, 8.5
  // Reuse responsive pattern from ShardGrid component
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Get viewport size for responsive font size calculation - Requirements: 8.4
  const { width: viewportWidth } = useViewportSize();
  
  // Calculate responsive font sizes based on viewport width - Requirements: 8.4
  // Recalculates when viewport width changes
  const fontSizes = useMemo(() => {
    return calculateResponsiveFontSizes(viewportWidth);
  }, [viewportWidth]);
  
  // Placeholder loading state
  const isLoading = false;
  const error = null;
  
  // Placeholder shard data for demonstration (Task 4.2)
  // This will be replaced with real data from useIndexShards hook in Task 2.1
  // Memoize to prevent unnecessary recalculations
  const placeholderShards: ShardInfo[] = useMemo(() => [
    {
      index: indexName,
      shard: 0,
      primary: true,
      state: 'STARTED',
      node: 'node-1',
      docs: 1000,
      store: 5000000,
    },
    {
      index: indexName,
      shard: 1,
      primary: true,
      state: 'STARTED',
      node: 'node-2',
      docs: 2000,
      store: 10000000,
    },
    {
      index: indexName,
      shard: 0,
      primary: false,
      state: 'STARTED',
      node: 'node-3',
      docs: 1000,
      store: 5000000,
    },
    {
      index: indexName,
      shard: 1,
      primary: false,
      state: 'STARTED',
      node: 'node-4',
      docs: 2000,
      store: 10000000,
    },
  ], [indexName]);
  
  // Calculate responsive positioning configuration - Requirements: 8.1, 8.5
  // Memoize configuration to avoid unnecessary recalculations
  const positioningConfig: PositioningConfig = useMemo(() => {
    if (isMobile) {
      // Mobile layout: stack nodes vertically
      // Requirements: 8.2 - Stack nodes vertically when viewport width < 768px
      return {
        containerWidth: 350, // Narrower container for mobile
        containerHeight: 800, // Taller container to accommodate vertical stacking
        centerWidth: 200, // Smaller center element
        nodeHeight: 120, // Taller nodes for better touch targets
        nodeSpacing: 30, // More spacing between stacked nodes
        horizontalOffset: 0, // No horizontal offset in vertical layout
      };
    }
    
    // Desktop layout: use default APM-style horizontal layout
    return DEFAULT_POSITIONING_CONFIG;
  }, [isMobile]);
  
  // Calculate node positions using responsive configuration - Requirements: 8.1, 8.5
  // Recalculates when viewport size changes via useMediaQuery
  const { primaryNodes, replicaNodes } = useMemo(() => {
    return calculateNodePositions(placeholderShards, positioningConfig);
  }, [placeholderShards, positioningConfig]);
  
  // Calculate shard counts for center element
  const placeholderHealth: HealthStatus = 'green';
  const placeholderPrimaryShards = placeholderShards.filter(s => s.primary).length;
  const placeholderReplicaShards = placeholderShards.filter(s => !s.primary).length;
  
  // Calculate center index position for connection lines - Requirements: 8.1, 8.5
  // Adjust based on layout mode (horizontal vs vertical)
  const centerX = useMemo(() => {
    if (isMobile) {
      // Center horizontally in mobile view
      return (positioningConfig.containerWidth - positioningConfig.centerWidth) / 2;
    }
    return positioningConfig.containerWidth / 2 - positioningConfig.centerWidth / 2;
  }, [isMobile, positioningConfig]);
  
  const centerY = useMemo(() => {
    if (isMobile) {
      // Position center element at top in mobile view for vertical stacking
      return 50;
    }
    return positioningConfig.containerHeight / 2;
  }, [isMobile, positioningConfig]);
  
  const nodeWidth = 180; // Must match NodeCard width
  const nodeHeight = positioningConfig.nodeHeight;
  
  if (isLoading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Loading visualization...
          </Text>
        </Stack>
      </Center>
    );
  }
  
  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Failed to Load Visualization"
        color="red"
      >
        <Text size="sm">{error}</Text>
      </Alert>
    );
  }
  
  return (
    <Box p="md">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>
              Index Visualization
            </Text>
            <Badge color="blue" variant="light">
              {isMobile ? 'Vertical Layout' : 'APM-Style Layout'}
            </Badge>
          </Group>
          
          {/* Visualization container with absolute positioning - Requirements: 8.1, 8.5 */}
          {/* Container adapts to viewport width and recalculates on resize */}
          <Box
            h={positioningConfig.containerHeight}
            style={{
              position: 'relative',
              width: positioningConfig.containerWidth,
              margin: '0 auto',
              // Smooth transition when switching between layouts
              transition: 'width 0.3s ease, height 0.3s ease',
            }}
          >
            {/* Connection lines - Requirements: 1.4 */}
            <ConnectionLines
              primaryNodes={primaryNodes}
              replicaNodes={replicaNodes}
              centerX={centerX}
              centerY={centerY}
              centerWidth={positioningConfig.centerWidth}
              nodeWidth={nodeWidth}
              nodeHeight={nodeHeight}
            />
            
            {/* Primary nodes (left side on desktop, stacked on mobile) - Requirements: 1.2, 2.3, 8.2 */}
            {primaryNodes.map((node) => (
              <NodeCard 
                key={`primary-${node.nodeId}`} 
                node={node} 
                onClick={onNodeClick}
                fontSizes={fontSizes}
              />
            ))}
            
            {/* Center index element - Requirements: 1.1, 4.4, 4.5 */}
            <Box
              style={{
                position: 'absolute',
                left: centerX,
                top: isMobile ? centerY : centerY - 80,
                zIndex: 2,
                // Smooth transition when switching between layouts
                transition: 'left 0.3s ease, top 0.3s ease',
              }}
            >
              <CenterIndexElement
                indexName={indexName}
                health={placeholderHealth}
                primaryShards={placeholderPrimaryShards}
                replicaShards={placeholderReplicaShards}
                fontSizes={fontSizes}
              />
            </Box>
            
            {/* Replica nodes (right side on desktop, stacked on mobile) - Requirements: 1.3, 2.4, 8.2 */}
            {replicaNodes.map((node) => (
              <NodeCard 
                key={`replica-${node.nodeId}`} 
                node={node} 
                onClick={onNodeClick}
                fontSizes={fontSizes}
              />
            ))}
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
