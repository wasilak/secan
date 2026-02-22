import { Container, Title, Text, Group } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { ThemeSelector } from './components/ThemeSelector';

function App() {
  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1}>Secan</Title>
          <Text size="lg" mt="md">
            Elasticsearch Cluster Management Tool
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Frontend initialization complete. Backend integration coming soon.
          </Text>
        </div>
        <ThemeSelector />
      </Group>

      {/* Router outlet for nested routes */}
      <Outlet />
    </Container>
  );
}

export default App;
