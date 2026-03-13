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
  Menu,
  Button,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  IconDashboard,
  IconPin,
  IconPinFilled,
  IconAlertCircle,
  IconChevronRight,
  IconChevronDown,
  IconMap,
  IconPackage,
  IconDatabase,
  IconBox,
  IconTerminal,
  IconChartLine,
  IconPlayerPlay,
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
import { getHealthColorValue } from '../utils/colors';
import { APP_VERSION, getAppVersion } from '../utils/version';
import { extractSectionFromPath } from '../utils/urlBuilders';
import { defaultSection, isValidClusterSection, type ClusterSection } from '../routes/clusterRoutes';
import type { ClusterInfo, ClusterStats } from '../types/api';

/**
 * Section configuration for cluster navigation
 */
const CLUSTER_SECTIONS = [
  { value: 'overview', label: 'Overview', icon: <IconDashboard size={16} /> },
  { value: 'topology', label: 'Topology', icon: <IconMap size={16} /> },
  { value: 'statistics', label: 'Statistics', icon: <IconChartLine size={16} /> },
  { value: 'nodes', label: 'Nodes', icon: <IconDatabase size={16} /> },
  { value: 'indices', label: 'Indices', icon: <IconPackage size={16} /> },
  { value: 'shards', label: 'Shards', icon: <IconBox size={16} /> },
  { value: 'tasks', label: 'Tasks', icon: <IconPlayerPlay size={16} /> },
  { value: 'console', label: 'Console', icon: <IconTerminal size={16} /> },
];

/**
 * Individual cluster health display component used in dropdown menu
 */
function ClusterDropdownItem({
  cluster,
  isActive,
  refreshInterval,
  onSelect,
}: {
  cluster: ClusterInfo;
  isActive: boolean;
  refreshInterval: number | false;
  onSelect: () => void;
}) {
  // Fetch health stats for this cluster
  const { data: stats } = useQuery({
    queryKey: ['cluster', cluster.id, 'stats'],
    queryFn: () => apiClient.getClusterStats(cluster.id),
    refetchInterval: refreshInterval || undefined,
    staleTime: 30 * 1000,
  });

  const healthColor = stats ? getHealthColorValue(stats.health) : 'var(--mantine-color-gray-5)';

  return (
    <Menu.Item onClick={onSelect}>
      <Group gap="xs" justify="space-between" style={{ width: '100%' }}>
        <Group gap="xs" wrap="nowrap">
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: healthColor,
              flexShrink: 0,
            }}
            aria-label={`Health: ${stats?.health || 'unknown'}`}
          />
          <Text size="sm">{cluster.name}</Text>
        </Group>
        {isActive && (
          <div
            style={{
              width: '4px',
              height: '16px',
              backgroundColor: 'var(--mantine-color-orange-6)',
              borderRadius: '2px',
              flexShrink: 0,
            }}
          />
        )}
      </Group>
    </Menu.Item>
  );
}

/**
 * Cluster selection dropdown component
 * Fetches health data for each cluster in real-time
 */
function ClusterDropdown({
  clusterId,
  currentClusterName,
  currentClusterStats,
  allClusters,
  isOpen,
  onOpen,
  onSelectCluster,
}: {
  clusterId: string;
  currentClusterName: string;
  currentClusterStats: ClusterStats | undefined;
  allClusters: ClusterInfo[] | undefined;
  isOpen: boolean;
  onOpen: (open: boolean) => void;
  onSelectCluster: (id: string) => void;
}) {
  const refreshInterval = useRefreshInterval();

  return (
    <Menu opened={isOpen} onChange={onOpen} position="bottom-start" withArrow>
      <Menu.Target>
        <Button
          variant="subtle"
          size="xs"
          rightSection={<IconChevronDown size={12} />}
          p={0}
          h="auto"
          style={{ fontSize: 'var(--mantine-font-size-sm)', fontWeight: 500 }}
        >
          <Group gap={6} wrap="nowrap">
            {currentClusterStats?.health && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getHealthColorValue(currentClusterStats.health),
                  flexShrink: 0,
                }}
                aria-label={`Health: ${currentClusterStats.health}`}
              />
            )}
            <Text size="sm" fw={500} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {currentClusterName}
            </Text>
          </Group>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {allClusters && allClusters.length > 0 ? (
          allClusters.map((cluster) => (
            <ClusterDropdownItem
              key={cluster.id}
              cluster={cluster}
              isActive={cluster.id === clusterId}
              refreshInterval={refreshInterval}
              onSelect={() => onSelectCluster(cluster.id)}
            />
          ))
        ) : (
          <Menu.Item disabled>
            <Text size="sm" c="dimmed">
              No clusters available
            </Text>
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * Header title component with interactive breadcrumb navigation
 *
 * Features:
 * - App level dropdown (Secan > Dashboard)
 * - Cluster level dropdown (with health indicators and all clusters)
 * - Section level dropdown (with icons and all 8 cluster sections)
 * - Real-time breadcrumb updates based on URL params
 */
function HeaderTitle() {
  const navigate = useNavigate();
  const location = useLocation();
  const refreshInterval = useRefreshInterval();
  const { id: clusterId } = useParams<{ id: string }>();

  // Track which menus are open
  const [clusterMenuOpen, setClusterMenuOpen] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);

  // Get resolved cluster name
  const clusterName = useClusterName(clusterId || '');

  // Get current section from path parameter (defaults to 'overview')
  const activeSection = extractSectionFromPath(location.pathname) || defaultSection;
  const activeSectionLabel =
    CLUSTER_SECTIONS.find((s) => s.value === activeSection)?.label || 'Overview';

  // Fetch cluster stats if we're viewing a cluster
  const { data: clusterStats } = useQuery({
    queryKey: ['cluster', clusterId, 'stats'],
    queryFn: () => apiClient.getClusterStats(clusterId!),
    enabled: !!clusterId,
    refetchInterval: refreshInterval,
  });

  // Fetch list of all clusters for dropdown
  const { data: allClustersResponse } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(1, 100),
    refetchInterval: refreshInterval,
  });

  const allClusters = allClustersResponse?.items;

  // Handle navigation to dashboard
  const handleGoToDashboard = () => {
    navigate('/');
  };

  // Handle cluster selection - preserve current section
  const handleSelectCluster = (selectedClusterId: string) => {
    setClusterMenuOpen(false);
    // Use path-based URL with current section
    const url = `/cluster/${selectedClusterId}/${activeSection}`;
    navigate(url);
  };

  // Handle section selection - stay on same cluster
  const handleSelectSection = (sectionValue: string) => {
    setSectionMenuOpen(false);
    // Use path-based URL for section navigation
    if (isValidClusterSection(sectionValue)) {
      const url = `/cluster/${clusterId}/${sectionValue}`;
      navigate(url);
    }
  };

  if (!clusterId) {
    // Not in a cluster view - show app name
    return (
      <Text size="xl" fw={700} component="h1" style={{ whiteSpace: 'nowrap' }}>
        Secan
      </Text>
    );
  }

  // In cluster view - show interactive breadcrumb with Menu dropdowns
  return (
    <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
      {/* App Level - Simple link to Dashboard */}
      <Button
        variant="subtle"
        size="xs"
        p={0}
        h="auto"
        onClick={handleGoToDashboard}
        style={{
          fontSize: 'var(--mantine-font-size-sm)',
          fontWeight: 500,
          color: 'var(--mantine-color-dimmed)',
        }}
      >
        Secan
      </Button>

      <IconChevronRight size={16} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />

      {/* Cluster Level Dropdown */}
      <ClusterDropdown
        clusterId={clusterId}
        currentClusterName={clusterName}
        currentClusterStats={clusterStats}
        allClusters={allClusters}
        isOpen={clusterMenuOpen}
        onOpen={setClusterMenuOpen}
        onSelectCluster={handleSelectCluster}
      />

      <IconChevronRight size={16} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />

      {/* Section Level Dropdown */}
      <Menu
        opened={sectionMenuOpen}
        onChange={setSectionMenuOpen}
        position="bottom-start"
        withArrow
      >
        <Menu.Target>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconChevronDown size={12} />}
            p={0}
            h="auto"
            style={{ fontSize: 'var(--mantine-font-size-sm)' }}
          >
            <Text size="sm" fw={600} c="dimmed">
              {activeSectionLabel}
            </Text>
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {CLUSTER_SECTIONS.map((section) => (
            <Menu.Item
              key={section.value}
              onClick={() => handleSelectSection(section.value)}
              leftSection={
                section.value === activeSection ? (
                  <div
                    style={{
                      width: '4px',
                      height: '16px',
                      backgroundColor: 'var(--mantine-color-orange-6)',
                      borderRadius: '2px',
                    }}
                  />
                ) : null
              }
            >
              <Group gap="xs">
                {section.icon}
                <Text size="sm">{section.label}</Text>
              </Group>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

/**
 * Cluster navigation item with expandable sections
 * Persists the current tab when switching clusters
 */
function ClusterNavItem({
  clusterId,
  isActive,
  isExpanded,
  onToggle,
  currentSection,
  onSectionNavigate,
  currentTab,
}: {
  clusterId: string;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  currentSection: ClusterSection;
  onSectionNavigate: (clusterId: string, section: ClusterSection) => void;
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

  const healthColor = clusterStats
    ? getHealthColorValue(clusterStats.health)
    : 'var(--mantine-color-gray-5)';

  // Build URL with tab parameter if switching clusters
  const clusterUrl =
    currentTab && !isActive ? `/cluster/${clusterId}?tab=${currentTab}` : `/cluster/${clusterId}`;

  // Render section children when expanded
  const sectionChildren = isExpanded ? (
    <Stack gap={0} mt="xs">
      {CLUSTER_SECTIONS.map((section) => {
        const isSectionActive = currentSection === section.value;
        return (
          <NavLink
            key={section.value}
            href={`/cluster/${clusterId}/${section.value}`}
            label={section.label}
            leftSection={section.icon}
            active={isSectionActive}
            onClick={(e) => {
              e.preventDefault();
              onSectionNavigate(clusterId, section.value as ClusterSection);
            }}
            styles={(theme) => ({
              root: {
                '&:hover': {
                  backgroundColor: theme.colors.violet[0],
                },
              },
              label: {
                color: 'var(--mantine-color-gray-7)',
                fontWeight: 400,
                fontSize: '14px',
              },
            })}
            rightSection={
              isSectionActive ? (
                <div
                  style={{
                    width: '4px',
                    height: '16px',
                    backgroundColor: 'var(--mantine-color-orange-6)',
                    borderRadius: '2px',
                    flexShrink: 0,
                  }}
                />
              ) : null
            }
          />
        );
      })}
    </Stack>
  ) : null;

  return (
    <>
      <NavLink
        href={clusterUrl}
        label={clusterName}
        active={isActive}
        opened={isExpanded}
        leftSection={
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: healthColor,
              transition: 'background-color 0.2s ease-in-out',
              flexShrink: 0,
            }}
            aria-label={`Health status: ${clusterStats?.health || 'unknown'}`}
          />
        }
        rightSection={
          isActive ? (
            <div
              style={{
                width: '4px',
                height: '16px',
                backgroundColor: 'var(--mantine-color-orange-6)',
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
          ) : null
        }
        styles={(theme) => ({
          root: {
            '&:hover': {
              backgroundColor: theme.colors.violet[0],
            },
          },
          label: {
            color: 'var(--mantine-color-blue-6)',
            fontWeight: 700,
            fontSize: '16px',
          },
        })}
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={isExpanded}
      />
      {sectionChildren}
    </>
  );
}

/**
 * Navigation content component - shared between drawer and static navbar
 *
 * Features:
 * - Dashboard navigation link
 * - Expandable cluster list with nested sections
 * - Auto-expand current cluster based on URL
 * - Accordion behavior (only one cluster expanded at a time)
 */
function NavigationContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const refreshInterval = useRefreshInterval();
  const { id: currentClusterId } = useParams<{ id: string }>();

  // Track which cluster menu is expanded (accordion style - only one at a time)
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  // Extract current tab from URL for persistence when switching clusters
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || undefined;

  // Extract current section from URL
  const currentSection = (extractSectionFromPath(location.pathname, location.search) || 'overview') as ClusterSection;

  // Fetch list of clusters
  const {
    data: clustersResponse,
    isLoading: clustersLoading,
    error: clustersError,
  } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(1, 100),
    refetchInterval: refreshInterval,
  });

  const clusters = clustersResponse?.items;

  // Auto-expand current cluster when URL changes
  useEffect(() => {
    if (currentClusterId) {
      setExpandedClusterId(currentClusterId);
    }
  }, [currentClusterId]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  // Handle cluster expand/collapse toggle
  const handleClusterToggle = (clickedClusterId: string) => {
    setExpandedClusterId(expandedClusterId === clickedClusterId ? null : clickedClusterId);
  };

  // Handle section navigation within a cluster
  const handleSectionNavigate = (clusterId: string, section: ClusterSection) => {
    const url = `/cluster/${clusterId}/${section}`;
    navigate(url);
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
              isActive={cluster.id === currentClusterId}
              isExpanded={expandedClusterId === cluster.id}
              onToggle={() => handleClusterToggle(cluster.id)}
              currentSection={currentSection}
              onSectionNavigate={handleSectionNavigate}
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
              <DrawerControls
                collapsed={false}
                user={isAuthenticated ? user : null}
                onLogout={logout}
              />
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
            <DrawerControls
              collapsed={false}
              user={isAuthenticated ? user : null}
              onLogout={logout}
            />
          </div>
        </div>
      </Drawer>
    </>
  );
}
