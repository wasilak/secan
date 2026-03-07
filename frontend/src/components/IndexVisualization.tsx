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
  const isLoading = true;
  const error = null;
  
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
              {indexName}
            </Badge>
          </Group>
          
          <Box h={400} style={{ position: 'relative' }}>
            <Center h="100%">
              <Text size="sm" c="dimmed">
                Visualization will be rendered here
              </Text>
            </Center>
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
