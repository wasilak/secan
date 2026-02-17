import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Drawer, Stack, Divider, Loader, Alert, ActionIcon as PinButton, Tooltip, Badge, Anchor } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  IconDashboard, 
  IconServer, 
  IconPin,
  IconPinFilled,
  IconAlertCircle,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { SpotlightSearch } from './SpotlightSearch';
import { RefreshControl } from './RefreshControl';
import { DrawerControls } from './DrawerControls';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useDrawer } from '../contexts/DrawerContext';
import { useClusterName } from '../hooks/useClusterName';
import type { HealthStatus } from '../types/api';

/**
 * Get color for health status badge
 */
function getHealthColor(health: HealthStatus): string {
  switch (health) {
    case 'green':
      return 'green';
    case 'yellow':
      return 'yellow';
    case 'red':
      return 'red';
    default:
      return 'gray';
  }
}

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
      <Tooltip 
        label="Secan - Secure Elasticsearch Admin" 
        position="bottom"
        withArrow
      >
        <Text 
          size="xl"
          fw={700} 
          component="h1"
          style={{ whiteSpace: 'nowrap', cursor: 'help' }}
        >
          Secan
        </Text>
      </Tooltip>
    );
  }
  
  // In cluster view - show breadcrumb with cluster name and health
  return (
    <Group gap="xs" wrap="nowrap">
      <Tooltip 
        label="Secan - Secure Elasticsearch Admin" 
        position="bottom"
        withArrow
      >
        <Anchor
          component="button"
          onClick={() => navigate('/')}
          size="lg"
          fw={700}
          c="dimmed"
          style={{ 
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            cursor: 'help',
            '&:hover': {
              textDecoration: 'underline',
            }
          }}
        >
          Secan
        </Anchor>
      </Tooltip>
      <IconChevronRight size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
      <Group gap={6} wrap="nowrap">
        <Text 
          size="lg"
          fw={600}
          component="h1"
          style={{ whiteSpace: 'nowrap' }}
        >
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
 * Cluster navigation item with resolved name
 */
function ClusterNavItem({ 
  clusterId, 
  isActive, 
  onClick 
}: { 
  clusterId: string; 
  isActive: boolean; 
  onClick: () => void;
}) {
  const clusterName = useClusterName(clusterId);
  
  return (
    <NavLink
      href={`/cluster/${clusterId}`}
      label={clusterName}
      active={isActive}
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
      <NavLink
        label="Clusters"
        leftSection={<IconServer size={20} aria-hidden="true" />}
        childrenOffset={28}
        defaultOpened={location.pathname.startsWith('/cluster')}
      >
        {clustersLoading && (
          <Group gap="xs" p="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">Loading clusters...</Text>
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
        
        {!clustersLoading && !clustersError && clusters && clusters.length === 0 && (
          <Text size="sm" c="dimmed" p="xs">
            No clusters configured
          </Text>
        )}
        
        {!clustersLoading && !clustersError && clusters && clusters.length > 0 && (
          <>
            {clusters.map((cluster) => (
              <ClusterNavItem
                key={cluster.id}
                clusterId={cluster.id}
                isActive={location.pathname.startsWith(`/cluster/${cluster.id}`)}
                onClick={() => handleNavigation(`/cluster/${cluster.id}`)}
              />
            ))}
          </>
        )}
      </NavLink>
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
  const navigate = useNavigate();
  const location = useLocation();

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

  // TODO: Replace with actual user data from auth context
  const user = {
    username: 'admin',
    roles: ['admin'],
  };

  const handleLogout = () => {
    // TODO: Implement actual logout logic
    navigate('/login');
  };

  const togglePin = () => {
    setIsPinned(!isPinned);
  };

  return (
    <>
      <MantineAppShell
        header={{ height: { base: 56, sm: 60 } }}
        navbar={isPinned ? {
          width: { base: drawerWidth.base, md: drawerWidth.md },
          breakpoint: 'sm',
        } : undefined}
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
              <Burger
                opened={drawerOpened}
                onClick={toggleDrawer}
                size="sm"
                aria-label={drawerOpened ? 'Close navigation menu' : 'Open navigation menu'}
              />
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
                <Text size="sm" fw={500}>Navigation</Text>
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
              <DrawerControls 
                collapsed={false} 
                user={user} 
                onLogout={handleLogout} 
              />
              <Divider my="sm" />
              <Text size="xs" c="dimmed" ta="center" role="contentinfo">
                Secan v0.1.0
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
          }
        }}
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          padding: 'var(--mantine-spacing-md)',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <NavigationContent onNavigate={closeDrawer} />
          </div>
          
          <div style={{ flexShrink: 0, marginTop: 'auto', paddingTop: 'var(--mantine-spacing-md)' }}>
            <DrawerControls 
              collapsed={false} 
              user={user} 
              onLogout={handleLogout} 
            />
            <Divider my="sm" />
            <Text size="xs" c="dimmed" ta="center" role="contentinfo">
              Secan v0.1.0
            </Text>
          </div>
        </div>
      </Drawer>
    </>
  );
}
