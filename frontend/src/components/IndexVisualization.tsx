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
import { getHealthColor } from '../utils/colors';
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
 * NodeCard Component
 * 
 * Renders a node card with name and shard count at the specified position.
 * Used for both primary and replica nodes in the visualization.
 * 
 * Requirements: 2.1, 2.2
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
            {/* Primary nodes (left side) - Requirements: 1.2, 2.3 */}
            {primaryNodes.map((node) => (
              <NodeCard key={`primary-${node.nodeId}`} node={node} onClick={onNodeClick} />
            ))}
            
            {/* Center index element - Requirements: 1.1, 4.4, 4.5 */}
            <Box
              style={{
                position: 'absolute',
                left: DEFAULT_POSITIONING_CONFIG.containerWidth / 2 - DEFAULT_POSITIONING_CONFIG.centerWidth / 2,
                top: DEFAULT_POSITIONING_CONFIG.containerHeight / 2 - 80,
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
