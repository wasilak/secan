import { Container, Title, Text } from '@mantine/core';

/**
 * Dashboard component displays an overview of all configured clusters.
 * 
 * Features (to be implemented):
 * - Display all clusters in table format
 * - Show cluster health status (green, yellow, red, unreachable)
 * - Display cluster statistics (nodes, shards, indices, documents)
 * - Auto-refresh at configurable intervals
 * - Navigate to cluster detail view on click
 * - Sort clusters by various metrics
 */
export function Dashboard() {
  return (
    <Container size="xl">
      <Title order={1} mb="md">
        Dashboard
      </Title>
      <Text c="dimmed">
        Multi-cluster overview will be displayed here.
      </Text>
      <Text size="sm" c="dimmed" mt="xs">
        This component will show all configured Elasticsearch/OpenSearch clusters with their health status and statistics.
      </Text>
    </Container>
  );
}
