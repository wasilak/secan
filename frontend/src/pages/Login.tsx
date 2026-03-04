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
import { IconAlertCircle, IconExternalLink } from '@tabler/icons-react';
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
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [countdown, setCountdown] = useState(4);

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
            const delay = status.oidc_redirect_delay || 4;
            setCountdown(delay);
            setOidcEnabled(true);
            
            // Start countdown timer
            const timer = setInterval(() => {
              setCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(timer);
                  window.location.href = '/api/auth/oidc/login';
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
            
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

  // Show OIDC redirect message if OIDC is enabled
  if (oidcEnabled) {
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

            <Stack gap="md" align="center">
              <Loader size="md" />
              <Text ta="center" size="sm">
                Redirecting to OIDC provider...
              </Text>
              <Text ta="center" size="xl" fw={700} c="blue">
                {countdown}
              </Text>
              <Text ta="center" size="xs" c="dimmed">
                seconds
              </Text>
              <Text ta="center" size="xs" c="dimmed">
                If you are not redirected automatically, click the button below
              </Text>
              <Button
                component="a"
                href="/api/auth/oidc/login"
                variant="outline"
                leftSection={<IconExternalLink size={16} />}
                fullWidth
              >
                Go to OIDC Provider
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Show regular login form for local authentication
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
