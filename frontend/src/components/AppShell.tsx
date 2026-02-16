import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Avatar, Menu, ActionIcon, Drawer, Stack, Divider, Loader, Alert, ActionIcon as PinButton, Tooltip } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  IconDashboard, 
  IconServer, 
  IconLogout, 
  IconUser,
  IconChevronDown,
  IconPin,
  IconPinFilled,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ThemeSelector } from './ThemeSelector';
import { SpotlightSearch } from './SpotlightSearch';
import { RefreshControl } from './RefreshControl';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';

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
              <NavLink
                key={cluster.id}
                href={`/cluster/${cluster.id}`}
                label={cluster.name}
                active={location.pathname.startsWith(`/cluster/${cluster.id}`)}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation(`/cluster/${cluster.id}`);
                }}
                aria-current={location.pathname.startsWith(`/cluster/${cluster.id}`) ? 'page' : undefined}
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
 * - Header with app title and user controls
 * - Drawer navigation with burger menu toggle
 * - Pin/unpin drawer to switch between overlay and static modes
 * - Dynamic cluster list from API
 * - User information display
 * - Logout button
 * - Theme selector integration
 * - Responsive design with mobile support
 * - Command palette for navigation (Cmd/Ctrl+K)
 */
export function AppShell() {
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
  const [isPinned, setIsPinned] = useLocalStorage({ key: 'nav-pinned', defaultValue: false });
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
    console.log('Logout clicked');
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
          width: { base: 250, md: 280 },
          breakpoint: 'sm',
        } : undefined}
        padding={{ base: 'sm', sm: 'md', lg: 'lg' }}
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
              <Text 
                size="xl"
                fw={700} 
                component="h1"
                style={{ whiteSpace: 'nowrap' }}
              >
                Secan
              </Text>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <RefreshControl scope={getRefreshScope()} />
              <ThemeSelector />
              
              {/* User menu */}
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    aria-label="User menu"
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Avatar size="sm" radius="xl" color="blue" aria-hidden="true">
                        {user.username.charAt(0).toUpperCase()}
                      </Avatar>
                      <IconChevronDown size={16} aria-hidden="true" style={{ display: 'none' }} className="hide-mobile" />
                    </Group>
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>
                    <Group gap="xs">
                      <IconUser size={16} aria-hidden="true" />
                      {user.username}
                    </Group>
                  </Menu.Label>
                  
                  <Menu.Item c="dimmed" disabled>
                    Roles: {user.roles.join(', ')}
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<IconLogout size={16} aria-hidden="true" />}
                    onClick={handleLogout}
                    color="red"
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
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
        }}
      >
        <Stack gap="md" style={{ height: '100%' }}>
          <NavigationContent onNavigate={closeDrawer} />
          
          <div style={{ marginTop: 'auto' }}>
            <Divider my="sm" />
            <Text size="xs" c="dimmed" ta="center" role="contentinfo">
              Secan v0.1.0
            </Text>
          </div>
        </Stack>
      </Drawer>
    </>
  );
}
