import { Container, Title, Text } from '@mantine/core';
import { Outlet } from 'react-router-dom';

function App() {
  return (
    <Container size="md" py="xl">
      <Title order={1}>Cerebro</Title>
      <Text size="lg" mt="md">
        Elasticsearch Web Administration Tool
      </Text>
      <Text size="sm" c="dimmed" mt="xs">
        Frontend initialization complete. Backend integration coming soon.
      </Text>
      
      {/* Router outlet for nested routes */}
      <Outlet />
    </Container>
  );
}

export default App;
