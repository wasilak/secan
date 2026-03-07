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
import type { HealthStatus } from '../types/api';

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
  onNodeClick: _onNodeClick,
  refreshInterval: _refreshInterval = 30000,
}: IndexVisualizationProps) {
  // TODO: Implement data fetching with useIndexShards hook (Task 2.1)
  // TODO: Implement data transformation logic (Task 3)
  // TODO: Implement SVG-based visualization rendering (Task 4)
  // TODO: Implement interactive elements (Task 6)
  // TODO: Implement responsive layout (Task 7)
  // TODO: Implement visualization controls (Task 8)
  
  // Placeholder loading state
  const isLoading = false;
  const error = null;
  
  // Placeholder data for center index element (Task 4.1)
  // This will be replaced with real data from useIndexShards hook in Task 2.1
  const placeholderHealth: HealthStatus = 'green';
  const placeholderPrimaryShards = 5;
  const placeholderReplicaShards = 1;
  
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
          
          {/* Visualization container */}
          <Box h={400} style={{ position: 'relative' }}>
            <Center h="100%">
              {/* Center index element (Task 4.1) */}
              <CenterIndexElement
                indexName={indexName}
                health={placeholderHealth}
                primaryShards={placeholderPrimaryShards}
                replicaShards={placeholderReplicaShards}
              />
            </Center>
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
