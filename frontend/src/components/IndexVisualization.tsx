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
  ActionIcon,
  TextInput,
  Menu,
  ScrollArea,
  Collapse,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle, IconZoomIn, IconZoomOut, IconZoomReset, IconSearch, IconX, IconDownload, IconFileTypePng, IconFileTypeSvg, IconChevronDown, IconChevronUp, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { toPng } from 'html-to-image';
import { getHealthColor, getShardBorderColor } from '../utils/colors';
import {
  calculateNodePositions,
  DEFAULT_POSITIONING_CONFIG,
  type NodePosition,
  type PositioningConfig,
} from '../utils/nodePositioning';
import { formatBytes } from '../utils/formatters';
import type { HealthStatus, ShardInfo } from '../types/api';
import { useMemo, useState } from 'react';
import { useIndexShards } from '../hooks/useIndexShards';


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
 * - INITIALIZING: Yellow border (transitional) with progress indicator
 * - RELOCATING: Orange border (transitional) with arrow indicator
 * - UNASSIGNED: Red border (critical)
 * 
 * Display format (Requirements 6.1, 6.2):
 * - Primary shards: Show shard number only (e.g., "0", "1", "2")
 * - Replica shards: Show shard number (e.g., "0", "1", "2")
 * 
 * Edge cases (Requirements 6.4, 6.5):
 * - Relocating shards: Show arrow indicator (→) to indicate movement
 * - Initializing shards: Show progress indicator (⏳) to indicate initialization
 * 
 * Tooltip content (Requirement 4.2):
 * - Index name
 * - Shard number
 * - Shard type (primary/replica)
 * - State
 * - Document count
 * - Size (formatted using formatBytes)
 * - Relocating node (if applicable)
 * 
 * @param props - Component props
 * @returns Shard indicator element with tooltip
 */
function ShardIndicator({ shard }: ShardIndicatorProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const borderColor = getShardBorderColor(shard.state);
  const cellSize = 24; // Smaller size for compact display
  
  /**
   * Tooltip content with shard details
   * Requirements: 4.2 - Display index, shard number, state, docs, size
   * Requirements: 6.4 - Display relocating node when applicable
   * Requirements: 8.4 - Use responsive font sizes in tooltips
   */
  const tooltipContent = (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        Shard {shard.shard}
      </Text>
      
      <Text size="xs">
        <Text component="span" fw={600}>Index:</Text> {shard.index}
      </Text>
      
      <Text size="xs">
        <Text component="span" fw={600}>Type:</Text> {shard.primary ? 'Primary' : 'Replica'}
      </Text>
      
      <Text size="xs">
        <Text component="span" fw={600}>State:</Text> {shard.state}
      </Text>
      
      {/* Show relocating target node - Requirements: 6.4 */}
      {shard.state === 'RELOCATING' && shard.relocatingNode && (
        <Text size="xs">
          <Text component="span" fw={600}>Relocating to:</Text> {shard.relocatingNode}
        </Text>
      )}
      
      {/* Show current node if assigned */}
      {shard.node && (
        <Text size="xs">
          <Text component="span" fw={600}>Node:</Text> {shard.node}
        </Text>
      )}
      
      <Text size="xs">
        <Text component="span" fw={600}>Documents:</Text> {shard.docs.toLocaleString()}
      </Text>
      
      <Text size="xs">
        <Text component="span" fw={600}>Size:</Text> {formatBytes(shard.store)}
      </Text>
    </Stack>
  );
  
  return (
    <Tooltip
      label={tooltipContent}
      position="bottom"
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
          fontSize: '10px',
          fontWeight: 600,
          color: isDark ? 'var(--mantine-color-gray-3)' : 'var(--mantine-color-gray-7)',
          userSelect: 'none',
          position: 'relative',
        }}
        // Accessibility
        role="gridcell"
        aria-label={`Shard ${shard.shard} of index ${shard.index}, ${shard.primary ? 'primary' : 'replica'}, state ${shard.state}${shard.state === 'RELOCATING' && shard.relocatingNode ? `, relocating to ${shard.relocatingNode}` : ''}`}
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
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-blue-6)',
            }}
            aria-hidden="true"
          />
        )}
        
        {/* Relocating indicator - Requirements: 6.4 */}
        {/* Show arrow (→) to indicate shard is moving to another node */}
        {shard.state === 'RELOCATING' && (
          <Box
            style={{
              position: 'absolute',
              bottom: '1px',
              right: '2px',
              fontSize: '8px',
              lineHeight: '8px',
              color: 'var(--mantine-color-orange-6)',
            }}
            aria-hidden="true"
            title="Relocating"
          >
            →
          </Box>
        )}
        
        {/* Initializing indicator - Requirements: 6.5 */}
        {/* Show hourglass (⏳) to indicate shard is initializing */}
        {shard.state === 'INITIALIZING' && (
          <Box
            style={{
              position: 'absolute',
              bottom: '1px',
              right: '2px',
              fontSize: '8px',
              lineHeight: '8px',
              color: 'var(--mantine-color-yellow-6)',
            }}
            aria-hidden="true"
            title="Initializing"
          >
            ⏳
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

/**
 * ConnectionLines Component
 * 
 * Renders SVG lines connecting the center index element to each node card.
 * Uses angled paths with rounded corners for a cleaner appearance.
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
   * Generate an angled path with rounded corners from center to a node
   * Creates a path with horizontal and vertical segments connected by smooth arcs
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
    
    // Calculate midpoint for the corner
    const midX = (startX + endX) / 2;
    
    // Corner radius for smooth rounded corners
    const cornerRadius = 12;
    
    // Determine if we need to go up or down
    const goingDown = endY > startY;
    
    // Calculate the corner points
    // We'll create a path that goes: horizontal -> corner -> vertical -> corner -> horizontal
    const horizontalLength = Math.abs(midX - startX);
    const verticalLength = Math.abs(endY - startY);
    
    // Only add corners if there's enough space
    const useCorners = horizontalLength > cornerRadius * 2 && verticalLength > cornerRadius * 2;
    
    if (!useCorners) {
      // Fallback to simple straight line if not enough space for corners
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
    
    // Create path with rounded corners
    // Start -> horizontal to first corner -> arc -> vertical -> arc -> horizontal to end
    if (isLeft) {
      // Going left
      const corner1X = midX + cornerRadius;
      const corner2X = midX - cornerRadius;
      
      if (goingDown) {
        return `
          M ${startX} ${startY}
          L ${corner1X} ${startY}
          Q ${midX} ${startY} ${midX} ${startY + cornerRadius}
          L ${midX} ${endY - cornerRadius}
          Q ${midX} ${endY} ${corner2X} ${endY}
          L ${endX} ${endY}
        `;
      } else {
        return `
          M ${startX} ${startY}
          L ${corner1X} ${startY}
          Q ${midX} ${startY} ${midX} ${startY - cornerRadius}
          L ${midX} ${endY + cornerRadius}
          Q ${midX} ${endY} ${corner2X} ${endY}
          L ${endX} ${endY}
        `;
      }
    } else {
      // Going right
      const corner1X = midX - cornerRadius;
      const corner2X = midX + cornerRadius;
      
      if (goingDown) {
        return `
          M ${startX} ${startY}
          L ${corner1X} ${startY}
          Q ${midX} ${startY} ${midX} ${startY + cornerRadius}
          L ${midX} ${endY - cornerRadius}
          Q ${midX} ${endY} ${corner2X} ${endY}
          L ${endX} ${endY}
        `;
      } else {
        return `
          M ${startX} ${startY}
          L ${corner1X} ${startY}
          Q ${midX} ${startY} ${midX} ${startY - cornerRadius}
          L ${midX} ${endY + cornerRadius}
          Q ${midX} ${endY} ${corner2X} ${endY}
          L ${endX} ${endY}
        `;
      }
    }
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
          opacity={0.5}
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
          opacity={0.5}
        />
      ))}
    </svg>
  );
}

/**
 * NodeCard Component
 * 
 * Renders a compact node card styled like topology view dot cards.
 * Shows node name with a colored indicator dot and shard count badge.
 * Displays individual shard indicators in a compact grid.
 * Shows detailed tooltip on hover.
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 6.1, 6.2
 * 
 * @param props - Component props
 * @returns Node card element
 */
function NodeCard({ node, onClick, nodeMetrics }: NodeCardProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
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
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {node.nodeName}
      </Text>
      
      <Text size="xs">
        <Text component="span" fw={600}>Node ID:</Text> {node.nodeId}
      </Text>
      
      <Text size="xs">
        <Text component="span" fw={600}>Shard Count:</Text> {node.shardCount}
      </Text>
      
      {nodeMetrics && (
        <>
          {nodeMetrics.heapUsed !== undefined && nodeMetrics.heapMax !== undefined && (
            <Text size="xs">
              <Text component="span" fw={600}>Heap:</Text> {formatBytes(nodeMetrics.heapUsed)} / {formatBytes(nodeMetrics.heapMax)}
              {' '}({formatPercent((nodeMetrics.heapUsed / nodeMetrics.heapMax) * 100)})
            </Text>
          )}
          
          {nodeMetrics.diskUsed !== undefined && nodeMetrics.diskTotal !== undefined && (
            <Text size="xs">
              <Text component="span" fw={600}>Disk:</Text> {formatBytes(nodeMetrics.diskUsed)} / {formatBytes(nodeMetrics.diskTotal)}
              {' '}({formatPercent((nodeMetrics.diskUsed / nodeMetrics.diskTotal) * 100)})
            </Text>
          )}
          
          {nodeMetrics.cpuPercent !== undefined && (
            <Text size="xs">
              <Text component="span" fw={600}>CPU:</Text> {formatPercent(nodeMetrics.cpuPercent)}
            </Text>
          )}
        </>
      )}
      
      {!nodeMetrics && (
        <Text size="xs" fs="italic" c="dimmed" mt="xs">
          Detailed metrics will be available when connected to real cluster data
        </Text>
      )}
    </Stack>
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
      <Box
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: 140,
          padding: '8px',
          backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
          border: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
          borderRadius: '6px',
          cursor: onClick ? 'pointer' : 'default',
          zIndex: 1,
          transition: 'all 0.2s ease',
        }}
        onClick={() => onClick?.(node.nodeId)}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--mantine-color-blue-5)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Stack gap={6}>
          {/* Node name - centered and readable */}
          <Text 
            size="xs" 
            fw={600} 
            ta="center"
            style={{ 
              fontSize: '11px',
              color: isDark ? 'var(--mantine-color-gray-3)' : 'var(--mantine-color-gray-7)',
              lineHeight: '1.3',
              wordBreak: 'break-word',
              hyphens: 'auto',
            }}
          >
            {node.nodeName}
          </Text>
          
          {/* Shard count badge */}
          <Group justify="center">
            <Badge 
              size="xs" 
              variant="light" 
              color="blue"
              style={{ fontSize: '10px' }}
            >
              {node.shardCount} shard{node.shardCount !== 1 ? 's' : ''}
            </Badge>
          </Group>
          
          {/* Individual shard indicators in compact grid */}
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 24px)',
              gap: '3px',
              justifyContent: 'center',
            }}
          >
            {node.shards.slice(0, 8).map((shard) => (
              <ShardIndicator 
                key={`${shard.index}-${shard.shard}-${shard.primary}`} 
                shard={shard}
              />
            ))}
          </Box>
          
          {/* Show indicator if more shards exist */}
          {node.shards.length > 8 && (
            <Text 
              size="xs" 
              c="dimmed" 
              ta="center"
              style={{ fontSize: '9px' }}
            >
              +{node.shards.length - 8} more
            </Text>
          )}
        </Stack>
      </Box>
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
}: CenterIndexElementProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <Card
      shadow="md"
      padding="md"
      radius="md"
      withBorder
      style={{
        minWidth: 200,
        maxWidth: 240,
        backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
        borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
      }}
    >
      <Stack gap="sm">
        {/* Index name header - Requirements: 8.4 - Responsive font size */}
        <Text 
          size="md" 
          fw={700} 
          ta="center" 
          style={{ 
            fontSize: '14px', 
            color: isDark ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-gray-9)',
          }}
        >
          {indexName}
        </Text>
        
        {/* Health status badge with color coding */}
        <Group justify="center">
          <Badge
            color={getHealthColor(health)}
            variant="filled"
            size="md"
          >
            {health.toUpperCase()}
          </Badge>
        </Group>
        
        {/* Shard counts - Requirements: 8.4 - Responsive font size */}
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" style={{ fontSize: '11px' }}>
              Primary:
            </Text>
            <Badge size="sm" variant="light" color="blue">
              {primaryShards}
            </Badge>
          </Group>
          
          <Group justify="space-between">
            <Text size="xs" c="dimmed" style={{ fontSize: '11px' }}>
              Replica:
            </Text>
            <Badge size="sm" variant="light" color="green">
              {replicaShards}
            </Badge>
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
  clusterId,
  indexName,
  onNodeClick,
  refreshInterval = 30000,
}: IndexVisualizationProps) {
  // TODO: Implement data fetching with useIndexShards hook (Task 2.1)
  // TODO: Implement data transformation logic (Task 3) - DONE: using calculateNodePositions
  // TODO: Implement SVG-based visualization rendering (Task 4.3 - visual connections)
  // TODO: Implement interactive elements (Task 6)
  // TODO: Implement responsive layout (Task 7) - IN PROGRESS
  // TODO: Implement visualization controls (Task 8)
  
  // Zoom state management - Requirements: 5.5
  // Default zoom level is 1.0 (100%)
  // Min: 0.5 (50%), Max: 2.0 (200%)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  
  // Search/filter state management - Requirements: 5.4
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Zoom control handlers - Requirements: 5.5
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.2, 2.0));
  };
  
  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.2, 0.5));
  };
  
  const handleZoomReset = () => {
    setZoomLevel(1.0);
  };
  
  // Search control handlers - Requirements: 5.4
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.currentTarget.value);
  };
  
  const handleSearchClear = () => {
    setSearchQuery('');
  };
  
  // Export state management - Requirements: 10.1, 10.2, 10.3
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  /**
   * Generate filename for export with index name and timestamp
   * Requirements: 10.4 - Include index name and timestamp in exported image
   * 
   * Format: {indexName}-visualization-{timestamp}.{extension}
   * Example: my-index-visualization-2024-01-15T10-30-45.png
   * 
   * @param extension - File extension (png or svg)
   * @returns Formatted filename
   */
  const generateExportFilename = (extension: 'png' | 'svg'): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${indexName}-visualization-${timestamp}.${extension}`;
  };
  
  /**
   * Export visualization as PNG image
   * Requirements: 10.1, 10.2, 10.5
   * 
   * Uses html-to-image library to convert the visualization container to PNG.
   * Includes error handling and user notifications.
   */
  const handleExportPNG = async () => {
    setIsExporting(true);
    
    try {
      // Get the visualization container element
      const visualizationElement = document.getElementById('visualization-container');
      
      if (!visualizationElement) {
        throw new Error('Visualization container not found');
      }
      
      // Generate PNG image using html-to-image
      const dataUrl = await toPng(visualizationElement, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // Higher quality export
      });
      
      // Create download link and trigger download - Requirements: 10.5
      const link = document.createElement('a');
      link.download = generateExportFilename('png');
      link.href = dataUrl;
      link.click();
      
      // Show success notification
      notifications.show({
        title: 'Export Successful',
        message: 'Visualization exported as PNG',
        color: 'green',
      });
    } catch (error) {
      // Handle export errors gracefully
      console.error('Failed to export PNG:', error);
      notifications.show({
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export visualization as PNG',
        color: 'red',
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  /**
   * Export visualization as SVG image
   * Requirements: 10.1, 10.3, 10.5
   * 
   * Serializes SVG DOM elements to create an SVG file.
   * Includes error handling and user notifications.
   */
  const handleExportSVG = async () => {
    setIsExporting(true);
    
    try {
      // Get the visualization container element
      const visualizationElement = document.getElementById('visualization-container');
      
      if (!visualizationElement) {
        throw new Error('Visualization container not found');
      }
      
      // Clone the element to avoid modifying the original
      const clonedElement = visualizationElement.cloneNode(true) as HTMLElement;
      
      // Create SVG wrapper
      const svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgWrapper.setAttribute('width', visualizationElement.offsetWidth.toString());
      svgWrapper.setAttribute('height', visualizationElement.offsetHeight.toString());
      
      // Create foreignObject to embed HTML content
      const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObject.setAttribute('width', '100%');
      foreignObject.setAttribute('height', '100%');
      foreignObject.appendChild(clonedElement);
      
      svgWrapper.appendChild(foreignObject);
      
      // Serialize SVG to string
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgWrapper);
      
      // Create blob and download link - Requirements: 10.5
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = generateExportFilename('svg');
      link.href = url;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Show success notification
      notifications.show({
        title: 'Export Successful',
        message: 'Visualization exported as SVG',
        color: 'green',
      });
    } catch (error) {
      // Handle export errors gracefully
      console.error('Failed to export SVG:', error);
      notifications.show({
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export visualization as SVG',
        color: 'red',
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // Responsive breakpoint detection - Requirements: 8.1, 8.2, 8.5
  // Reuse responsive pattern from ShardGrid component
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Fetch shard data using useIndexShards hook - Requirements: 7.4, 9.1, 9.3
  // The hook is configured with refetchInterval of 30000ms (30 seconds)
  // Includes refetch function for manual retry on errors
  const { data: shards, isLoading, error, isFetching, refetch } = useIndexShards(
    clusterId,
    indexName,
    refreshInterval,
    true
  );
  
  // Use real shard data or fallback to empty array
  // Memoize to prevent unnecessary recalculations
  const shardData: ShardInfo[] = useMemo(() => {
    return shards || [];
  }, [shards]);
  
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
    return calculateNodePositions(shardData, positioningConfig);
  }, [shardData, positioningConfig]);
  
  // Filter nodes based on search query - Requirements: 5.4
  // Case-insensitive search on node name
  const filteredPrimaryNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return primaryNodes;
    }
    const query = searchQuery.toLowerCase();
    return primaryNodes.filter(node => 
      node.nodeName.toLowerCase().includes(query)
    );
  }, [primaryNodes, searchQuery]);
  
  const filteredReplicaNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return replicaNodes;
    }
    const query = searchQuery.toLowerCase();
    return replicaNodes.filter(node => 
      node.nodeName.toLowerCase().includes(query)
    );
  }, [replicaNodes, searchQuery]);
  
  // Calculate total and filtered node counts - Requirements: 5.4
  const totalNodeCount = primaryNodes.length + replicaNodes.length;
  const filteredNodeCount = filteredPrimaryNodes.length + filteredReplicaNodes.length;
  const isFiltered = searchQuery.trim().length > 0;
  
  // Determine if scrolling is needed - Requirements: 5.1, 5.2
  // Enable ScrollArea when more than 10 nodes total
  const needsScrolling = totalNodeCount > 10;
  
  // Determine if node grouping is needed - Requirements: 5.3
  // Group nodes by shard count when more than 20 nodes total
  const needsGrouping = totalNodeCount > 20;
  
  // State for managing group expansion - Requirements: 5.3
  // Track which groups are expanded (by group key)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  /**
   * Toggle group expansion state
   * Requirements: 5.3 - Allow users to expand/collapse groups
   * 
   * @param groupKey - Unique identifier for the group
   */
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };
  
  /**
   * Group nodes by shard count ranges
   * Requirements: 5.3 - Group nodes by shard count when more than 20 nodes
   * 
   * Creates groups with ranges: 1-5 shards, 6-10 shards, 11-20 shards, 21+ shards
   * 
   * @param nodes - Array of node positions to group
   * @param side - 'primary' or 'replica' to create unique group keys
   * @returns Array of node groups with metadata
   */
  interface NodeGroup {
    key: string;
    label: string;
    range: string;
    nodes: NodePosition[];
    minShards: number;
    maxShards: number;
  }
  
  const groupNodesByShardCount = useMemo(() => {
    return (nodes: NodePosition[], side: 'primary' | 'replica'): NodeGroup[] => {
      // Define shard count ranges
      const ranges = [
        { min: 1, max: 5, label: '1-5 shards' },
        { min: 6, max: 10, label: '6-10 shards' },
        { min: 11, max: 20, label: '11-20 shards' },
        { min: 21, max: Infinity, label: '21+ shards' },
      ];
      
      // Group nodes into ranges
      const groups: NodeGroup[] = [];
      
      for (const range of ranges) {
        const nodesInRange = nodes.filter(
          (node) => node.shardCount >= range.min && node.shardCount <= range.max
        );
        
        if (nodesInRange.length > 0) {
          groups.push({
            key: `${side}-${range.min}-${range.max}`,
            label: range.label,
            range: range.label,
            nodes: nodesInRange,
            minShards: range.min,
            maxShards: range.max,
          });
        }
      }
      
      return groups;
    };
  }, []);
  
  // Group nodes if needed - Requirements: 5.3
  const primaryGroups = useMemo(() => {
    if (!needsGrouping) return null;
    return groupNodesByShardCount(filteredPrimaryNodes, 'primary');
  }, [needsGrouping, filteredPrimaryNodes, groupNodesByShardCount]);
  
  const replicaGroups = useMemo(() => {
    if (!needsGrouping) return null;
    return groupNodesByShardCount(filteredReplicaNodes, 'replica');
  }, [needsGrouping, filteredReplicaNodes, groupNodesByShardCount]);
  
  // Get nodes to display based on grouping and expansion state
  // Requirements: 5.3 - Only show nodes from expanded groups
  const visiblePrimaryNodes = useMemo(() => {
    if (!needsGrouping || !primaryGroups) {
      return filteredPrimaryNodes;
    }
    
    // Only show nodes from expanded groups
    const visible: NodePosition[] = [];
    for (const group of primaryGroups) {
      if (expandedGroups.has(group.key)) {
        visible.push(...group.nodes);
      }
    }
    return visible;
  }, [needsGrouping, primaryGroups, filteredPrimaryNodes, expandedGroups]);
  
  const visibleReplicaNodes = useMemo(() => {
    if (!needsGrouping || !replicaGroups) {
      return filteredReplicaNodes;
    }
    
    // Only show nodes from expanded groups
    const visible: NodePosition[] = [];
    for (const group of replicaGroups) {
      if (expandedGroups.has(group.key)) {
        visible.push(...group.nodes);
      }
    }
    return visible;
  }, [needsGrouping, replicaGroups, filteredReplicaNodes, expandedGroups]);
  
  // Separate unassigned shards - Requirements: 3.5
  // Unassigned shards have no node assignment and should be displayed separately
  const unassignedShards = useMemo(() => {
    return shardData.filter(s => s.state === 'UNASSIGNED');
  }, [shardData]);
  
  // Calculate shard counts for center element
  const placeholderHealth: HealthStatus = 'green';
  const placeholderPrimaryShards = shardData.filter(s => s.primary).length;
  const placeholderReplicaShards = shardData.filter(s => !s.primary).length;
  
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
  
  const nodeWidth = 140; // Must match NodeCard width (updated to smaller size)
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
  
  // Handle API errors - Requirements: 9.3
  // Display error message with retry button for failed requests
  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Failed to Load Visualization"
        color="red"
      >
        <Stack gap="sm">
          <Text size="sm">
            {error instanceof Error ? error.message : 'An error occurred while loading shard data'}
          </Text>
          <Group>
            <ActionIcon
              variant="filled"
              color="red"
              size="md"
              onClick={() => refetch()}
              aria-label="Retry loading visualization"
            >
              <IconRefresh size={16} />
            </ActionIcon>
            <Text size="xs" c="dimmed">
              Click to retry
            </Text>
          </Group>
        </Stack>
      </Alert>
    );
  }
  
  // Handle empty shard arrays gracefully - Requirements: 9.3
  // Show appropriate message when no shards exist for the index
  if (!shards || shards.length === 0) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="No Shards Found"
        color="yellow"
      >
        <Text size="sm">
          No shard data available for index "{indexName}". The index may not have any allocated shards yet.
        </Text>
      </Alert>
    );
  }
  
  return (
    <Box p="md">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Text size="lg" fw={600}>
                Index Visualization
              </Text>
              
              {/* Refresh indicator - Requirements: 7.4 */}
              {/* Display subtle indicator when data is being refetched */}
              {isFetching && (
                <Tooltip label="Refreshing data..." position="right" withArrow>
                  <Badge
                    color="blue"
                    variant="light"
                    size="sm"
                    leftSection={
                      <Loader size={10} color="blue" />
                    }
                  >
                    Updating
                  </Badge>
                </Tooltip>
              )}
            </Group>
            <Group gap="xs">
              <Badge color="blue" variant="light">
                {isMobile ? 'Vertical Layout' : 'APM-Style Layout'}
              </Badge>
              
              {/* Node count badge - Requirements: 5.4 */}
              {isFiltered && (
                <Badge color="gray" variant="light">
                  {filteredNodeCount} of {totalNodeCount} nodes
                </Badge>
              )}
              
              {/* Export menu - Requirements: 10.1, 10.2, 10.3 */}
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <Tooltip label="Export Visualization" position="bottom" withArrow>
                    <ActionIcon
                      variant="light"
                      color="green"
                      size="lg"
                      loading={isExporting}
                      aria-label="Export visualization"
                    >
                      <IconDownload size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                
                <Menu.Dropdown>
                  <Menu.Label>Export Format</Menu.Label>
                  <Menu.Item
                    leftSection={<IconFileTypePng size={16} />}
                    onClick={handleExportPNG}
                    disabled={isExporting}
                  >
                    Export as PNG
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFileTypeSvg size={16} />}
                    onClick={handleExportSVG}
                    disabled={isExporting}
                  >
                    Export as SVG
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              
              {/* Zoom controls - Requirements: 5.5 */}
              <Group gap={4}>
                <Tooltip label="Zoom In" position="bottom" withArrow>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 2.0}
                    aria-label="Zoom in"
                  >
                    <IconZoomIn size={18} />
                  </ActionIcon>
                </Tooltip>
                
                <Tooltip label="Zoom Out" position="bottom" withArrow>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.5}
                    aria-label="Zoom out"
                  >
                    <IconZoomOut size={18} />
                  </ActionIcon>
                </Tooltip>
                
                <Tooltip label="Reset Zoom" position="bottom" withArrow>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={handleZoomReset}
                    disabled={zoomLevel === 1.0}
                    aria-label="Reset zoom"
                  >
                    <IconZoomReset size={18} />
                  </ActionIcon>
                </Tooltip>
                
                <Badge color="gray" variant="light" size="sm">
                  {Math.round(zoomLevel * 100)}%
                </Badge>
              </Group>
            </Group>
          </Group>
          
          {/* Search/filter input - Requirements: 5.4 */}
          <TextInput
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={handleSearchChange}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery && (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={handleSearchClear}
                  aria-label="Clear search"
                >
                  <IconX size={14} />
                </ActionIcon>
              )
            }
            style={{ maxWidth: 300 }}
          />
          
          {/* Node grouping UI - Requirements: 5.3 */}
          {needsGrouping && (primaryGroups || replicaGroups) ? (
            <Stack gap="md">
              {/* Primary node groups */}
              {primaryGroups && primaryGroups.length > 0 && (
                <Box>
                  <Text size="sm" fw={600} mb="xs" c="blue">
                    Primary Shard Nodes ({filteredPrimaryNodes.length})
                  </Text>
                  <Stack gap="xs">
                    {primaryGroups.map((group) => (
                      <Card key={group.key} padding="sm" withBorder>
                        <Group
                          justify="space-between"
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleGroup(group.key)}
                        >
                          <Group gap="xs">
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              aria-label={expandedGroups.has(group.key) ? 'Collapse group' : 'Expand group'}
                            >
                              {expandedGroups.has(group.key) ? (
                                <IconChevronUp size={16} />
                              ) : (
                                <IconChevronDown size={16} />
                              )}
                            </ActionIcon>
                            <Text size="sm" fw={500}>
                              {group.label}
                            </Text>
                          </Group>
                          <Badge size="sm" variant="light" color="blue">
                            {group.nodes.length} {group.nodes.length === 1 ? 'node' : 'nodes'}
                          </Badge>
                        </Group>
                        
                        <Collapse in={expandedGroups.has(group.key)}>
                          <Box mt="sm">
                            <ScrollArea h={400} scrollbarSize={8}>
                              <Stack gap="xs">
                                {group.nodes.map((node) => (
                                  <Card
                                    key={node.nodeId}
                                    padding="sm"
                                    withBorder
                                    style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
                                    onClick={() => onNodeClick?.(node.nodeId)}
                                  >
                                    <Group justify="space-between">
                                      <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                                        {node.nodeName}
                                      </Text>
                                      <Badge size="sm" variant="light">
                                        {node.shardCount} {node.shardCount === 1 ? 'shard' : 'shards'}
                                      </Badge>
                                    </Group>
                                    <Group gap={4} wrap="wrap" mt="xs">
                                      {node.shards.map((shard) => (
                                        <ShardIndicator
                                          key={`${shard.index}-${shard.shard}-${shard.primary}`}
                                          shard={shard}
                                        />
                                      ))}
                                    </Group>
                                  </Card>
                                ))}
                              </Stack>
                            </ScrollArea>
                          </Box>
                        </Collapse>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
              
              {/* Replica node groups - Requirements: 1.5 - Only show if replicas exist */}
              {replicaGroups && replicaGroups.length > 0 && (
                <Box>
                  <Text size="sm" fw={600} mb="xs" c="green">
                    Replica Shard Nodes ({filteredReplicaNodes.length})
                  </Text>
                  <Stack gap="xs">
                    {replicaGroups.map((group) => (
                      <Card key={group.key} padding="sm" withBorder>
                        <Group
                          justify="space-between"
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleGroup(group.key)}
                        >
                          <Group gap="xs">
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              aria-label={expandedGroups.has(group.key) ? 'Collapse group' : 'Expand group'}
                            >
                              {expandedGroups.has(group.key) ? (
                                <IconChevronUp size={16} />
                              ) : (
                                <IconChevronDown size={16} />
                              )}
                            </ActionIcon>
                            <Text size="sm" fw={500}>
                              {group.label}
                            </Text>
                          </Group>
                          <Badge size="sm" variant="light" color="green">
                            {group.nodes.length} {group.nodes.length === 1 ? 'node' : 'nodes'}
                          </Badge>
                        </Group>
                        
                        <Collapse in={expandedGroups.has(group.key)}>
                          <Box mt="sm">
                            <ScrollArea h={400} scrollbarSize={8}>
                              <Stack gap="xs">
                                {group.nodes.map((node) => (
                                  <Card
                                    key={node.nodeId}
                                    padding="sm"
                                    withBorder
                                    style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
                                    onClick={() => onNodeClick?.(node.nodeId)}
                                  >
                                    <Group justify="space-between">
                                      <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                                        {node.nodeName}
                                      </Text>
                                      <Badge size="sm" variant="light">
                                        {node.shardCount} {node.shardCount === 1 ? 'shard' : 'shards'}
                                      </Badge>
                                    </Group>
                                    <Group gap={4} wrap="wrap" mt="xs">
                                      {node.shards.map((shard) => (
                                        <ShardIndicator
                                          key={`${shard.index}-${shard.shard}-${shard.primary}`}
                                          shard={shard}
                                        />
                                      ))}
                                    </Group>
                                  </Card>
                                ))}
                              </Stack>
                            </ScrollArea>
                          </Box>
                        </Collapse>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
              
              {/* Unassigned shards section - Requirements: 3.5 */}
              {/* Display unassigned shards in separate section at bottom */}
              {unassignedShards.length > 0 && (
                <Box>
                  <Text size="sm" fw={600} mb="xs" c="red">
                    Unassigned Shards ({unassignedShards.length})
                  </Text>
                  <Card padding="md" withBorder>
                    <Group gap={4} wrap="wrap">
                      {unassignedShards.map((shard) => (
                        <ShardIndicator
                          key={`unassigned-${shard.index}-${shard.shard}-${shard.primary}`}
                          shard={shard}
                        />
                      ))}
                    </Group>
                  </Card>
                </Box>
              )}
            </Stack>
          ) : (
            <>
              {/* Visualization container with absolute positioning - Requirements: 8.1, 8.5 */}
              {/* Container adapts to viewport width and recalculates on resize */}
              {/* Wrap in ScrollArea when more than 10 nodes - Requirements: 5.1, 5.2 */}
              {needsScrolling ? (
                <ScrollArea
                  h={600}
                  scrollbarSize={12}
                  scrollHideDelay={500}
                  style={{
                    width: '100%',
                  }}
                >
                  <Box
                    id="visualization-container"
                    h={positioningConfig.containerHeight}
                    style={{
                      position: 'relative',
                      width: positioningConfig.containerWidth,
                      margin: '0 auto',
                      // Smooth transition when switching between layouts
                      transition: 'width 0.3s ease, height 0.3s ease',
                      // Apply zoom transform - Requirements: 5.5
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                      // Smooth zoom transition
                      transitionProperty: 'width, height, transform',
                    }}
                  >
                    {/* Connection lines - Requirements: 1.4 */}
                    {/* Only render connections for visible nodes - Requirements: 5.3 */}
                    <ConnectionLines
                      primaryNodes={visiblePrimaryNodes}
                      replicaNodes={visibleReplicaNodes}
                      centerX={centerX}
                      centerY={centerY}
                      centerWidth={positioningConfig.centerWidth}
                      nodeWidth={nodeWidth}
                      nodeHeight={nodeHeight}
                    />
                    
                    {/* Primary nodes (left side on desktop, stacked on mobile) - Requirements: 1.2, 2.3, 8.2 */}
                    {visiblePrimaryNodes.map((node) => (
                      <NodeCard 
                        key={`primary-${node.nodeId}`} 
                        node={node} 
                        onClick={onNodeClick}
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
                      />
                    </Box>
                    
                    {/* Replica nodes (right side on desktop, stacked on mobile) - Requirements: 1.3, 2.4, 8.2 */}
                    {/* Requirements: 1.5 - Only render replica nodes if they exist (index has replicas) */}
                    {visibleReplicaNodes.length > 0 && visibleReplicaNodes.map((node) => (
                      <NodeCard 
                        key={`replica-${node.nodeId}`} 
                        node={node} 
                        onClick={onNodeClick}
                      />
                    ))}
                  </Box>
                </ScrollArea>
              ) : (
                <Box
                  id="visualization-container"
                  h={positioningConfig.containerHeight}
                  style={{
                    position: 'relative',
                    width: positioningConfig.containerWidth,
                    margin: '0 auto',
                    // Smooth transition when switching between layouts
                    transition: 'width 0.3s ease, height 0.3s ease',
                    // Apply zoom transform - Requirements: 5.5
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    // Smooth zoom transition
                    transitionProperty: 'width, height, transform',
                  }}
                >
                  {/* Connection lines - Requirements: 1.4 */}
                  {/* Only render connections for visible nodes - Requirements: 5.3 */}
                  <ConnectionLines
                    primaryNodes={visiblePrimaryNodes}
                    replicaNodes={visibleReplicaNodes}
                    centerX={centerX}
                    centerY={centerY}
                    centerWidth={positioningConfig.centerWidth}
                    nodeWidth={nodeWidth}
                    nodeHeight={nodeHeight}
                  />
                  
                  {/* Primary nodes (left side on desktop, stacked on mobile) - Requirements: 1.2, 2.3, 8.2 */}
                  {visiblePrimaryNodes.map((node) => (
                    <NodeCard 
                      key={`primary-${node.nodeId}`} 
                      node={node} 
                      onClick={onNodeClick}
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
                    />
                  </Box>
                  
                  {/* Replica nodes (right side on desktop, stacked on mobile) - Requirements: 1.3, 2.4, 8.2 */}
                  {/* Requirements: 1.5 - Only render replica nodes if they exist (index has replicas) */}
                  {visibleReplicaNodes.length > 0 && visibleReplicaNodes.map((node) => (
                    <NodeCard 
                      key={`replica-${node.nodeId}`} 
                      node={node} 
                      onClick={onNodeClick}
                    />
                  ))}
                </Box>
              )}
              
              {/* Unassigned shards section - Requirements: 3.5 */}
              {/* Display unassigned shards in separate section at bottom */}
              {unassignedShards.length > 0 && (
                <Box mt="md">
                  <Text size="sm" fw={600} mb="xs" c="red">
                    Unassigned Shards ({unassignedShards.length})
                  </Text>
                  <Card padding="md" withBorder>
                    <Group gap={4} wrap="wrap">
                      {unassignedShards.map((shard) => (
                        <ShardIndicator
                          key={`unassigned-${shard.index}-${shard.shard}-${shard.primary}`}
                          shard={shard}
                        />
                      ))}
                    </Group>
                  </Card>
                </Box>
              )}
            </>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
