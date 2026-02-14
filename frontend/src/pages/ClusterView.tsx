import { Container, Title, Text } from '@mantine/core';
import { useParams } from 'react-router-dom';

/**
 * ClusterView component displays detailed information about a single cluster.
 * 
 * Features (to be implemented):
 * - Display cluster health and statistics
 * - Show nodes, indices, and shards
 * - Provide index operations (open, close, delete, etc.)
 * - Navigate to specialized views (aliases, templates, snapshots)
 * - Auto-refresh at configurable intervals
 */
export function ClusterView() {
  const { id } = useParams<{ id: string }>();

  return (
    <Container size="xl">
      <Title order={1} mb="md">
        Cluster: {id}
      </Title>
      <Text c="dimmed">
        Detailed cluster view will be displayed here.
      </Text>
      <Text size="sm" c="dimmed" mt="xs">
        This component will show cluster health, nodes, indices, shards, and provide management operations.
      </Text>
    </Container>
  );
}
