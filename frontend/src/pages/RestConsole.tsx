import { Container, Title, Text } from '@mantine/core';
import { useParams } from 'react-router-dom';

/**
 * RestConsole component provides a Kibana-style console for executing REST requests.
 * 
 * Features (to be implemented):
 * - Code editor with syntax highlighting
 * - Parse "METHOD endpoint" format
 * - Execute requests against selected cluster
 * - Display responses with formatting
 * - Manage request history in local storage
 * - Export/import request collections
 */
export function RestConsole() {
  const { id } = useParams<{ id: string }>();

  return (
    <Container size="xl">
      <Title order={1} mb="md">
        REST Console - Cluster: {id}
      </Title>
      <Text c="dimmed">
        REST console interface will be displayed here.
      </Text>
      <Text size="sm" c="dimmed" mt="xs">
        This component will provide a code editor for executing arbitrary REST requests against the cluster.
      </Text>
    </Container>
  );
}
