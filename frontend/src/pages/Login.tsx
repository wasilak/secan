import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Box,
  Alert,
  Loader,
} from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconAlertCircle } from '@tabler/icons-react';
import { APP_VERSION, getAppVersion } from '../utils/version';

/**
 * Login component provides authentication interface.
 */
export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [appVersion, setAppVersion] = useState(APP_VERSION);

  // Get redirect_to from query params, default to dashboard
  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect_to') || '/';

  // Check auth status and handle redirects, also fetch version
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Fetch version from API
        getAppVersion().then(setAppVersion);

        // If already authenticated, redirect to home
        if (isAuthenticated) {
          navigate('/', { replace: true });
          return;
        }

        // Fetch auth status
        const response = await fetch('/api/auth/status', {
          credentials: 'include',
        });

        if (response.ok) {
          const status = await response.json();

          // If in open mode, redirect to home
          if (status.mode === 'open') {
            navigate('/', { replace: true });
            return;
          }

          // If OIDC is enabled, redirect to OIDC login
          if (status.oidc_enabled) {
            window.location.href = '/api/auth/oidc/login';
            return;
          }
        }
      } catch (err) {
        // Continue to login form on error
        console.error('Failed to check auth status:', err);
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuthStatus();
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(username, password);
      // Redirect to original path or dashboard
      navigate(redirectPath, { replace: true });
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth status
  if (authChecking) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader />
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Container size="xs" py="xl">
        <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
          <Stack gap={0} align="center" mb="xl">
            <button
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <Title order={2} ta="center">
                Secan
              </Title>
            </button>
            <Text size="xs" c="dimmed">
              {appVersion}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Elasticsearch Cluster Management Tool
            </Text>
          </Stack>

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
        </Paper>
      </Container>
    </Box>
  );
}
