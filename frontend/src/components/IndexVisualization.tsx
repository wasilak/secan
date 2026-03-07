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
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { getHealthColor, getShardBorderColor } from '../utils/colors';
import {
  calculateNodePositions,
  DEFAULT_POSITIONING_CONFIG,
  type NodePosition,
} from '../utils/nodePositioning';
import type { HealthStatus, ShardInfo } from '../types/api';

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
 * Requirements: 2.1, 2.2
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
 * @param props - Component props
 * @returns Shard indicator element
 */
function ShardIndicator({ shard }: ShardIndicatorProps) {
  const borderColor = getShardBorderColor(shard.state);
  const cellSize = 32; // Smaller than ShardCell for compact display in node cards
  
  return (
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
        fontSize: '12px',
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
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2
 * 
 * @param props - Component props
 * @returns Node card element
 */
function NodeCard({ node, onClick }: NodeCardProps) {
  return (
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
        <Text size="sm" fw={600} truncate>
          {node.nodeName}
        </Text>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Shards:
          </Text>
          <Badge size="sm" variant="light">
            {node.shardCount}
          </Badge>
        </Group>
        
        {/* Individual shard indicators - Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2 */}
        <Group gap={4} wrap="wrap">
          {node.shards.map((shard) => (
            <ShardIndicator key={`${shard.index}-${shard.shard}-${shard.primary}`} shard={shard} />
          ))}
        </Group>
      </Stack>
    </Card>
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
        {/* Index name header */}
        <Text size="lg" fw={700} ta="center">
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
        
        {/* Shard counts */}
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Primary Shards:
            </Text>
            <Text size="sm" fw={600}>
              {primaryShards}
            </Text>
          </Group>
          
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Replica Shards:
            </Text>
            <Text size="sm" fw={600}>
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
  // TODO: Implement responsive layout (Task 7)
  // TODO: Implement visualization controls (Task 8)
  
  // Placeholder loading state
  const isLoading = false;
  const error = null;
  
  // Placeholder shard data for demonstration (Task 4.2)
  // This will be replaced with real data from useIndexShards hook in Task 2.1
  const placeholderShards: ShardInfo[] = [
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
  ];
  
  // Calculate node positions using the positioning logic (Task 4.2)
  const { primaryNodes, replicaNodes } = calculateNodePositions(
    placeholderShards,
    DEFAULT_POSITIONING_CONFIG
  );
  
  // Calculate shard counts for center element
  const placeholderHealth: HealthStatus = 'green';
  const placeholderPrimaryShards = placeholderShards.filter(s => s.primary).length;
  const placeholderReplicaShards = placeholderShards.filter(s => !s.primary).length;
  
  // Calculate center index position for connection lines
  const centerX = DEFAULT_POSITIONING_CONFIG.containerWidth / 2 - DEFAULT_POSITIONING_CONFIG.centerWidth / 2;
  const centerY = DEFAULT_POSITIONING_CONFIG.containerHeight / 2;
  const nodeWidth = 180; // Must match NodeCard width
  const nodeHeight = DEFAULT_POSITIONING_CONFIG.nodeHeight;
  
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
              APM-Style Layout
            </Badge>
          </Group>
          
          {/* Visualization container with absolute positioning */}
          <Box
            h={DEFAULT_POSITIONING_CONFIG.containerHeight}
            style={{
              position: 'relative',
              width: DEFAULT_POSITIONING_CONFIG.containerWidth,
              margin: '0 auto',
            }}
          >
            {/* Connection lines - Requirements: 1.4 */}
            <ConnectionLines
              primaryNodes={primaryNodes}
              replicaNodes={replicaNodes}
              centerX={centerX}
              centerY={centerY}
              centerWidth={DEFAULT_POSITIONING_CONFIG.centerWidth}
              nodeWidth={nodeWidth}
              nodeHeight={nodeHeight}
            />
            
            {/* Primary nodes (left side) - Requirements: 1.2, 2.3 */}
            {primaryNodes.map((node) => (
              <NodeCard key={`primary-${node.nodeId}`} node={node} onClick={onNodeClick} />
            ))}
            
            {/* Center index element - Requirements: 1.1, 4.4, 4.5 */}
            <Box
              style={{
                position: 'absolute',
                left: centerX,
                top: centerY - 80,
                zIndex: 2,
              }}
            >
              <CenterIndexElement
                indexName={indexName}
                health={placeholderHealth}
                primaryShards={placeholderPrimaryShards}
                replicaShards={placeholderReplicaShards}
              />
            </Box>
            
            {/* Replica nodes (right side) - Requirements: 1.3, 2.4 */}
            {replicaNodes.map((node) => (
              <NodeCard key={`replica-${node.nodeId}`} node={node} onClick={onNodeClick} />
            ))}
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
