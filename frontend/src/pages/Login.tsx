import { Container, Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Box, Alert } from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconAlertCircle } from '@tabler/icons-react';

/**
 * Login component provides authentication interface.
 */
export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get redirect_to from query params
  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect_to') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(username, password);
      // Redirect to original path or dashboard
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
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

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
              {error}
            </Alert>
          )}

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
          Local authentication (config.yaml)
        </Text>
      </Paper>
    </Container>
    </Box>
  );
}
