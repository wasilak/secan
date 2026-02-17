import { Container, Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Box } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Login component provides authentication interface.
 * 
 * Features (to be implemented):
 * - Local user authentication with username/password
 * - OIDC authentication redirect
 * - Form validation
 * - Error handling
 * - Redirect to dashboard after successful login
 */
export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // TODO: Implement actual authentication
    
    // Simulate login
    setTimeout(() => {
      setLoading(false);
      navigate('/');
    }, 1000);
  };

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Container size="xs" py="xl">
        <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
          <Title order={2} ta="center" mb="md">
            Secan
          </Title>
          <Text size="sm" c="dimmed" ta="center" mb="xl">
            Elasticsearch Cluster Management Tool
          </Text>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />

            <Button type="submit" fullWidth loading={loading}>
              Sign In
            </Button>
          </Stack>
        </form>

        <Text size="xs" c="dimmed" ta="center" mt="xl">
          Authentication integration coming soon
        </Text>
      </Paper>
    </Container>
    </Box>
  );
}
