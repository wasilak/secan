import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  Text,
  NavLink,
  Drawer,
  Stack,
  Divider,
  Loader,
  Alert,
  ActionIcon as PinButton,
  Tooltip,
  Badge,
  Anchor,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  IconDashboard,
  IconPin,
  IconPinFilled,
  IconAlertCircle,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { SpotlightSearch } from './SpotlightSearch';
import { RefreshControl } from './RefreshControl';
import { DrawerControls } from './DrawerControls';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useDrawer } from '../contexts/DrawerContext';
import { useClusterName } from '../hooks/useClusterName';
import { useAuth } from '../contexts/AuthContext';
import { getHealthColor, getHealthColorValue } from '../utils/colors';
import { APP_VERSION, getAppVersion } from '../utils/version';

/**
 * Header title component - shows app name or cluster context
 */
function HeaderTitle() {
  const location = useLocation();
  const navigate = useNavigate();
  const refreshInterval = useRefreshInterval();

  // Check if we're in a cluster view
  const clusterMatch = location.pathname.match(/^\/cluster\/([^/]+)/);
  const clusterId = clusterMatch ? clusterMatch[1] : null;

  // Get resolved cluster name
  const clusterName = useClusterName(clusterId || '');

  // Fetch cluster stats if we're viewing a cluster
  const { data: clusterStats } = useQuery({
    queryKey: ['cluster', clusterId, 'stats'],
    queryFn: () => apiClient.getClusterStats(clusterId!),
    enabled: !!clusterId,
    refetchInterval: refreshInterval,
  });

  if (!clusterId) {
    // Not in a cluster view - show app name
    return (
      <Text size="xl" fw={700} component="h1" style={{ whiteSpace: 'nowrap' }}>
        Secan
      </Text>
    );
  }

  // In cluster view - show breadcrumb with cluster name and health
  return (
    <Group gap="xs" wrap="nowrap">
      <Anchor
        component="button"
        onClick={() => navigate('/')}
        size="lg"
        fw={700}
        c="dimmed"
        style={{
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        Secan
      </Anchor>
      <IconChevronRight size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
      <Group gap={6} wrap="nowrap">
        <Text size="lg" fw={600} component="h1" style={{ whiteSpace: 'nowrap' }}>
          {clusterName}
        </Text>
        {clusterStats?.health && (
          <Badge
            size="sm"
            color={getHealthColor(clusterStats.health)}
            variant="dot"
            style={{ textTransform: 'lowercase' }}
          >
            {clusterStats.health}
          </Badge>
        )}
      </Group>
    </Group>
  );
}

/**
 * Cluster navigation item with resolved name and health indicator
 * Persists the current tab when switching clusters
 */
function ClusterNavItem({
  clusterId,
  isActive,
  onClick,
  currentTab,
}: {
  clusterId: string;
  isActive: boolean;
  onClick: () => void;
  currentTab?: string;
}) {
  const clusterName = useClusterName(clusterId);
  const refreshInterval = useRefreshInterval();

  // Fetch cluster stats for health status (independent of useClusterName to ensure fresh data)
  const { data: clusterStats } = useQuery({
    queryKey: ['cluster', clusterId, 'stats'],
    queryFn: () => apiClient.getClusterStats(clusterId),
    refetchInterval: refreshInterval,
    staleTime: 30 * 1000,
  });

  const healthColor = clusterStats ? getHealthColorValue(clusterStats.health) : 'var(--mantine-color-gray-5)';

  // Build URL with tab parameter if switching clusters
  const clusterUrl = currentTab && !isActive ? `/cluster/${clusterId}?tab=${currentTab}` : `/cluster/${clusterId}`;

  return (
    <NavLink
      href={clusterUrl}
      label={clusterName}
      active={isActive}
      leftSection={
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: healthColor,
            transition: 'background-color 0.2s ease-in-out',
          }}
          aria-label={`Health status: ${clusterStats?.health || 'unknown'}`}
        />
      }
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-current={isActive ? 'page' : undefined}
    />
  );
}

/**
 * Navigation content component - shared between drawer and static navbar
 */
function NavigationContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const refreshInterval = useRefreshInterval();

  // Extract current tab from URL for persistence when switching clusters
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || undefined;

  // Fetch list of clusters
  const {
    data: clusters,
    isLoading: clustersLoading,
    error: clustersError,
  } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(),
    refetchInterval: refreshInterval,
  });

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <Stack gap="xs">
      <NavLink
        href="/"
        label="Dashboard"
        leftSection={<IconDashboard size={20} aria-hidden="true" />}
        active={isActive('/')}
        onClick={(e) => {
          e.preventDefault();
          handleNavigation('/');
        }}
        aria-current={isActive('/') ? 'page' : undefined}
      />

      {/* Cluster navigation */}
      <Text size="sm" fw={600} c="dimmed" mb="xs" mt="md">
        Clusters
      </Text>
      
      {clustersLoading && (
        <Group gap="xs" p="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Loading clusters...
          </Text>
        </Group>
      )}

      {clustersError && (
        <Alert
          icon={<IconAlertCircle size={14} />}
          color="red"
          p="xs"
          styles={{ message: { fontSize: '0.75rem' } }}
        >
          Failed to load clusters
        </Alert>
      )}

      {!clustersLoading && !clustersError && Array.isArray(clusters) && clusters.length === 0 && (
        <Text size="sm" c="dimmed" p="xs">
          No clusters configured
        </Text>
      )}

      {!clustersLoading && !clustersError && Array.isArray(clusters) && clusters.length > 0 && (
        <Stack gap={2}>
          {clusters.map((cluster) => (
            <ClusterNavItem
              key={cluster.id}
              clusterId={cluster.id}
              isActive={location.pathname.startsWith(`/cluster/${cluster.id}`)}
              onClick={() => handleNavigation(`/cluster/${cluster.id}`)}
              currentTab={currentTab}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * AppShell component provides the main layout structure for the application.
 *
 * Features:
 * - Header with app title
 * - Drawer navigation with burger menu toggle
 * - Pin/unpin drawer to switch between overlay and static modes
 * - Dynamic cluster list from API
 * - User controls and theme selector in drawer bottom
 * - Responsive design with mobile support
 * - Command palette for navigation (Cmd/Ctrl+K)
 */
export function AppShell() {
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
  const { isPinned, setIsPinned, drawerWidth } = useDrawer();
  const location = useLocation();
  const [appVersion, setAppVersion] = useState(APP_VERSION);

  // Fetch version from API on mount
  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

  // Determine refresh scope based on current route
  const getRefreshScope = (): string | string[] | undefined => {
    // Dashboard - only refresh clusters list
    if (location.pathname === '/') {
      return 'clusters';
    }

    // Cluster view - only refresh data for that specific cluster
    const clusterMatch = location.pathname.match(/^\/cluster\/([^/]+)/);
    if (clusterMatch) {
      const clusterId = clusterMatch[1];
      return ['cluster', clusterId];
    }

    // Default: refresh all (for other pages)
    return undefined;
  };

  // Get user from auth context
  const { user, isAuthenticated, logout } = useAuth();

  const togglePin = () => {
    setIsPinned(!isPinned);
  };

  return (
    <>
      <MantineAppShell
        header={{ height: { base: 56, sm: 60 } }}
        navbar={
          isPinned
            ? {
                width: { base: drawerWidth.base, md: drawerWidth.md },
                breakpoint: 'sm',
              }
            : undefined
        }
        padding="md"
      >
        {/* Header */}
        <MantineAppShell.Header>
          <Group
            h="100%"
            px={{ base: 'sm', sm: 'md' }}
            justify="space-between"
            component="header"
            role="banner"
            wrap="nowrap"
          >
            <Group gap="xs" wrap="nowrap">
              {!isPinned && (
                <Burger
                  opened={drawerOpened}
                  onClick={toggleDrawer}
                  size="sm"
                  aria-label={drawerOpened ? 'Close navigation menu' : 'Open navigation menu'}
                />
              )}
              <HeaderTitle />
            </Group>

            <Group gap="xs" wrap="nowrap">
              <RefreshControl scope={getRefreshScope()} />
            </Group>
          </Group>
        </MantineAppShell.Header>

        {/* Static Navbar (when pinned) */}
        {isPinned && (
          <MantineAppShell.Navbar
            p={{ base: 'sm', sm: 'md' }}
            component="nav"
            role="navigation"
            aria-label="Main navigation"
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <MantineAppShell.Section>
              <Group justify="space-between" mb="md">
                <Text size="sm" fw={500}>
                  Navigation
                </Text>
                <Tooltip label="Unpin navigation">
                  <PinButton
                    variant="subtle"
                    size="sm"
                    onClick={togglePin}
                    aria-label="Unpin navigation"
                  >
                    <IconPinFilled size={16} />
                  </PinButton>
                </Tooltip>
              </Group>
            </MantineAppShell.Section>

            <MantineAppShell.Section grow style={{ overflowY: 'auto' }}>
              <NavigationContent />
            </MantineAppShell.Section>

            <MantineAppShell.Section>
              <DrawerControls collapsed={false} user={isAuthenticated ? user : null} onLogout={logout} />
              <Divider my="sm" />
              <Text size="xs" c="dimmed" ta="center" role="contentinfo">
                {appVersion}
              </Text>
            </MantineAppShell.Section>
          </MantineAppShell.Navbar>
        )}

        {/* Main Content */}
        <MantineAppShell.Main component="main" role="main">
          <Outlet />
        </MantineAppShell.Main>

        {/* Spotlight Search - must be inside router context */}
        <SpotlightSearch />
      </MantineAppShell>

      {/* Drawer Navigation (when not pinned) */}
      <Drawer
        opened={drawerOpened && !isPinned}
        onClose={closeDrawer}
        title={
          <Group justify="space-between" style={{ width: '100%' }}>
            <Text fw={500}>Navigation</Text>
            <Tooltip label="Pin navigation">
              <PinButton
                variant="subtle"
                size="sm"
                onClick={() => {
                  togglePin();
                  closeDrawer();
                }}
                aria-label="Pin navigation"
              >
                <IconPin size={16} />
              </PinButton>
            </Tooltip>
          </Group>
        }
        padding="md"
        size="280px"
        styles={{
          title: { width: '100%' },
          body: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: 0,
          },
          content: {
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: 'var(--mantine-spacing-md)',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <NavigationContent onNavigate={closeDrawer} />
          </div>

          <div
            style={{ flexShrink: 0, marginTop: 'auto', paddingTop: 'var(--mantine-spacing-md)' }}
          >
            <DrawerControls collapsed={false} user={isAuthenticated ? user : null} onLogout={logout} />
          </div>
        </div>
      </Drawer>
    </>
  );
}
