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
  useMantineColorScheme,
  Popover,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IconDashboard,
  IconPin,
  IconPinFilled,
  IconAlertCircle,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback, memo } from 'react';
import { SpotlightSearch } from './SpotlightSearch';
import { RefreshControl } from './RefreshControl';
import { DrawerControls } from './DrawerControls';
import { ConsolePanel } from './ConsolePanel';
import { ConsolePanelProvider } from '../contexts/ConsolePanelContext';
import { ModalManagerProvider } from '../contexts/ModalManagerContext';
import { ConsoleModal } from './ConsoleModal';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useDrawer } from '../contexts/DrawerContext';
import { useClusterName } from '../hooks/useClusterName';
import { useAuth } from '../contexts/AuthContext';
import { getHealthColorValue } from '../utils/colors';
import { APP_VERSION, getAppVersion } from '../utils/version';
import { extractSectionFromPath } from '../utils/urlBuilders';
import { queryKeys } from '../utils/queryKeys';
import { DURATIONS, EASINGS } from '../lib/transitions';
import { defaultSection, isValidClusterSection, type ClusterSection, CLUSTER_NAV } from '../routes/clusterRoutes';
import type { ClusterInfo, ClusterStats } from '../types/api';

// CLUSTER_NAV is imported from routes and provides navigation metadata

/**
 * Determine whether a child nav entry (which may include a query string)
 * matches the current location. childPath is taken from CLUSTER_NAV and can
 * be something like "/topology?topologyView=shard-grid". We compare the
 * constructed pathname (/cluster/{clusterId}{pathPart}) to the current
 * pathname and ensure any query params present in the childPath are also
 * present with equal values in the current search string.
 */
function matchClusterChildPath(childPath: string, clusterId: string, pathname: string, search: string): boolean {
  const [pathPart, maybeQuery] = childPath.split('?');
  const expectedPath = `/cluster/${clusterId}${pathPart}`;
  if (pathname !== expectedPath) return false;
  if (!maybeQuery) return true;

  const expectedParams = new URLSearchParams(maybeQuery);
  const currentParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  for (const [key, value] of expectedParams.entries()) {
    if (currentParams.get(key) !== value) return false;
  }
  return true;
}

/**
 * Individual cluster health display component used in dropdown menu
 */
function ClusterDropdownItemInner({
  cluster,
  isActive,
  refreshInterval,
  onSelect,
}: {
  cluster: ClusterInfo;
  isActive: boolean;
  refreshInterval: number | false;
  onSelect: (id: string) => void;
}) {
  // Fetch health stats for this cluster
  const { data: stats } = useQuery({
    queryKey: queryKeys.cluster(cluster.id).stats(),
    queryFn: () => apiClient.getClusterStats(cluster.id),
    enabled: !!cluster.id,
    refetchInterval: refreshInterval || undefined,
    staleTime: 30 * 1000,
  });

  const healthColor = stats ? getHealthColorValue(stats.health) : 'var(--mantine-color-gray-5)';

  return (
    <Menu.Item onClick={() => onSelect(cluster.id)}>
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
          <Text size="sm">{cluster.name ?? cluster.id}</Text>
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
const ClusterDropdownItem = memo(ClusterDropdownItemInner);

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
              onSelect={onSelectCluster}
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
  // Track which section's popover (nested submenu) is open in the header
  const [openSectionPopover, setOpenSectionPopover] = useState<string | null>(null);

  // Get resolved cluster name
  const clusterName = useClusterName(clusterId || '');

  // Get current section from path parameter (defaults to 'overview')
  const activeSection = extractSectionFromPath(location.pathname) || defaultSection;
  const activeSectionLabel = CLUSTER_NAV.find((s) => s.value === activeSection)?.label || 'Overview';

  // Fetch cluster stats if we're viewing a cluster
  const { data: clusterStats } = useQuery({
    queryKey: queryKeys.cluster(clusterId!).stats(),
    queryFn: () => apiClient.getClusterStats(clusterId!),
    enabled: !!clusterId,
    refetchInterval: refreshInterval,
  });

  // Fetch list of all clusters for dropdown
  const { data: allClustersResponse } = useQuery({
    queryKey: queryKeys.clusters.list(),
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
        onClick={() => {
          handleGoToDashboard();
        }}
        style={{
          fontSize: 'var(--mantine-font-size-sm)',
          fontWeight: 500,
          color: 'var(--mantine-color-dimmed)',
          padding: '0rem',
          height: 'auto',
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
            {CLUSTER_NAV.map((section) => {
              if (section.children && section.children.length > 0) {
                // Render parent item as a Popover.Target and show children in a Popover dropdown
                return (
                  <div key={section.value} style={{ display: 'inline-block' }}>
                    <Popover
                      opened={openSectionPopover === section.value}
                      onChange={(open) => setOpenSectionPopover(open ? section.value : null)}
                      position="right-start"
                      withArrow
                      closeOnClickOutside
                    >
                      <Popover.Target>
                        <div
                          onMouseEnter={() => setOpenSectionPopover(section.value)}
                          onMouseLeave={() => setOpenSectionPopover(null)}
                        >
                          <Menu.Item
                            // Parent items with children are toggle-only in the
                            // header: clicking should open/close the popover
                            // rather than navigate. Keep the active-section
                            // orange bar on the left to indicate the current
                            // active section while the chevron on the right
                            // signals expandability.
                            onClick={() => {
                              setOpenSectionPopover((prev) => (prev === section.value ? null : section.value));
                            }}
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
                            <Group style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Group gap="xs">
                                <section.icon size={16} />
                                <Text size="sm">{section.label}</Text>
                              </Group>
                              <IconChevronRight
                                size={12}
                                style={{
                                  color: openSectionPopover === section.value || section.value === activeSection
                                    ? 'var(--mantine-color-orange-6)'
                                    : 'var(--mantine-color-dimmed)',
                                  transform: openSectionPopover === section.value || section.value === activeSection ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 150ms ease, color 150ms ease',
                                }}
                              />
                            </Group>
                          </Menu.Item>
                        </div>
                      </Popover.Target>

                      <Popover.Dropdown
                        onMouseEnter={() => setOpenSectionPopover(section.value)}
                        onMouseLeave={() => setOpenSectionPopover(null)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 220 }}>
                          {section.children.map((child) => {
                            const isChildActive = matchClusterChildPath(child.path, clusterId!, location.pathname, location.search);
                            return (
                              <Menu.Item
                                key={child.path}
                                component="a"
                                href={`/cluster/${clusterId}${child.path}`}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey) return;
                                  e.preventDefault();
                                  navigate(`/cluster/${clusterId}${child.path}`);
                                  setSectionMenuOpen(false);
                                  setOpenSectionPopover(null);
                                }}
                                leftSection={
                                  isChildActive ? (
                                    <div
                                      style={{
                                        width: '4px',
                                        height: '16px',
                                        backgroundColor: 'var(--mantine-color-orange-6)',
                                        borderRadius: '2px',
                                        marginRight: 4,
                                      }}
                                    />
                                  ) : (
                                    <child.icon size={14} />
                                  )
                                }
                                style={{ paddingLeft: 8 }}
                              >
                                <Text size="sm">{child.label}</Text>
                              </Menu.Item>
                            );
                          })}
                        </div>
                      </Popover.Dropdown>
                    </Popover>
                  </div>
                );
              }

              return (
                <Menu.Item
                  key={section.value}
                  component="a"
                  href={`/cluster/${clusterId}/${section.value}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      // Let browser handle Cmd+Click/Ctrl+Click for new tab
                      return;
                    }
                    e.preventDefault();
                    handleSelectSection(section.value);
                  }}
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
                    {/* Render icon component at 16px */}
                    <section.icon size={16} />
                    <Text size="sm">{section.label}</Text>
                  </Group>
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

/**
 * Cluster navigation item with expandable sections
 * Persists the current tab when switching clusters
 */
function ClusterNavItemInner({
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
  onToggle: (id: string) => void;
  currentSection: ClusterSection;
  onSectionNavigate: (clusterId: string, section: ClusterSection) => void;
  currentTab?: string;
}) {
  const clusterName = useClusterName(clusterId);
  const refreshInterval = useRefreshInterval();
  useMantineColorScheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Local UI state: which section parents have their children expanded in the sidebar
  const [openChildSections, setOpenChildSections] = useState<Record<string, boolean>>({});

  // Fetch cluster stats for health status (independent of useClusterName to ensure fresh data)
  const { data: clusterStats } = useQuery({
    queryKey: queryKeys.cluster(clusterId!).stats(),
    queryFn: () => apiClient.getClusterStats(clusterId),
    enabled: !!clusterId,
    refetchInterval: refreshInterval,
    staleTime: 30 * 1000,
  });

  const healthColor = clusterStats
    ? getHealthColorValue(clusterStats.health)
    : 'var(--mantine-color-gray-5)';

  // Build URL with tab parameter if switching clusters
  const clusterUrl =
    currentTab && !isActive ? `/cluster/${clusterId}?tab=${currentTab}` : `/cluster/${clusterId}`;

  return (
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
          // Remove the solid background used previously for cluster items in
          // the sidebar/drawer. It created large gray blocks behind each
          // cluster entry which are visually noisy and unnecessary.
          backgroundColor: 'transparent',
          '&:hover': {
            backgroundColor: 'transparent',
          },
        },
        label: {
          color: theme.colors.blue[6],
          fontWeight: 500,
          fontSize: '16px',
        },
      })}
      onClick={(e) => {
        e.preventDefault();
        onToggle(clusterId);
      }}
      aria-current={isActive ? 'page' : undefined}
      aria-expanded={isExpanded}
    >
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATIONS.normal, ease: EASINGS.default }}
          >
            {CLUSTER_NAV.map((section, index) => {
              const isSectionActive = isActive && currentSection === section.value;
              return (
                <motion.div
                  key={section.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02, duration: DURATIONS.normal }}
                >
                  <NavLink
                    label={section.label}
                    leftSection={<section.icon size={16} />}
                    active={isSectionActive}
                    onClick={(e) => {
                      // If this section has children, clicking should toggle its children
                      // in the sidebar (not navigate). If it has no children, navigate.
                      if (section.children && section.children.length > 0) {
                        e.preventDefault();
                        if (e.metaKey || e.ctrlKey) return;
                        setOpenChildSections((prev) => ({
                          ...prev,
                          [section.value]: !prev[section.value],
                        }));
                        return;
                      }

                      if (e.metaKey || e.ctrlKey) {
                        // Let browser handle Cmd+Click/Ctrl+Click for new tab
                        return;
                      }
                      e.preventDefault();
                      onSectionNavigate(clusterId, section.value as ClusterSection);
                    }}
                    styles={(theme) => ({
                      root: {
                        // Keep entries visually minimal: no persistent or hover
                        // background to avoid the blocky gray bars in the nav.
                        backgroundColor: 'transparent',
                        '&:hover': {
                          backgroundColor: 'transparent',
                        },
                      },
                      label: {
                        color: theme.colors.gray[7],
                        fontWeight: 400,
                        fontSize: '14px',
                      },
                    })}
                    rightSection={
                      // If the section has children, show a small chevron that
                      // rotates when the section is active or its children are
                      // expanded. If it has no children, keep the existing
                      // orange active bar behavior.
                      section.children && section.children.length > 0 ? (
                        <IconChevronRight
                          size={12}
                          style={{
                            color: isSectionActive || openChildSections[section.value]
                              ? 'var(--mantine-color-orange-6)'
                              : 'var(--mantine-color-dimmed)',
                            transform: isSectionActive || openChildSections[section.value] ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 150ms ease, color 150ms ease',
                            flexShrink: 0,
                          }}
                        />
                      ) : isSectionActive ? (
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
                  {/* Render second-level nav for children (e.g. topology sub-tabs) */}
                  {/* Render second-level nav for children (e.g. topology sub-tabs).
                      Children are shown either when the section is active (route)
                      or when the user toggles the parent in the sidebar. */}
                  {(isSectionActive || openChildSections[section.value]) && section.children && section.children.length > 0 && (
                    <div style={{ paddingLeft: 16, marginTop: 6 }}>
                      {section.children.map((child) => {
                        const isChildActive = matchClusterChildPath(child.path, clusterId!, location.pathname, location.search);
                        return (
                          <NavLink
                            key={child.path}
                            href={`/cluster/${clusterId}${child.path}`}
                            label={child.label}
                            leftSection={<child.icon size={14} />}
                            active={isChildActive}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey) return;
                              e.preventDefault();
                              const url = `/cluster/${clusterId}${child.path}`;
                              navigate(url);
                            }}
                            styles={(theme) => ({
                              root: { backgroundColor: 'transparent' },
                              label: { color: theme.colors.gray[6], fontSize: '13px' },
                            })}
                            rightSection={
                              isChildActive ? (
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
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </NavLink>
  );
}
const ClusterNavItem = memo(ClusterNavItemInner);

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
    queryKey: queryKeys.clusters.list(),
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
  const handleClusterToggle = useCallback((clickedClusterId: string) => {
    setExpandedClusterId((prev) => (prev === clickedClusterId ? null : clickedClusterId));
    if (typeof window !== 'undefined') {
      // layout changed in the sidebar: trigger a measurement pass
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }, []);

  // Handle section navigation within a cluster
  const handleSectionNavigate = useCallback((clusterId: string, section: ClusterSection) => {
    const url = `/cluster/${clusterId}/${section}`;
    navigate(url);
    onNavigate?.();
  }, [navigate, onNavigate]);

  return (
    <Stack gap="xs">
      <NavLink
        href="/"
        label="Dashboard"
        leftSection={<IconDashboard size={20} aria-hidden="true" />}
        active={isActive('/')}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          // Let browser handle Cmd+Click/Ctrl+Click for new tab
          return;
        }
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
              onToggle={handleClusterToggle}
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
const NavigationContentMemo = memo(NavigationContent);

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
    // Trigger a window resize event so layout-measurements (charts) re-run.
    // We use requestAnimationFrame to schedule after React/DOM updates.
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  };

  return (
    <ModalManagerProvider>
      <ConsolePanelProvider>
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
            <Group gap="xs" wrap="nowrap" align="center">
              {!isPinned && (
                <Burger
                  opened={drawerOpened}
                  onClick={() => {
                    toggleDrawer();
                    // ensure charts re-measure after drawer open/close
                    if (typeof window !== 'undefined') {
                      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
                    }
                  }}
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
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
              <NavigationContentMemo />
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
        <MantineAppShell.Main
          component="main"
          role="main"
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <ConsolePanel>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  duration: DURATIONS.normal,
                  ease: EASINGS.default,
                }}
                style={{ overflow: 'hidden' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ConsolePanel>
        </MantineAppShell.Main>

        {/* Spotlight Search - must be inside router context */}
        <SpotlightSearch />
        
        {/* Console Modal - renders when console is in detached mode */}
        <ConsoleModal />
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
        transitionProps={{
          transition: 'slide-right',
          duration: 300,
          timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
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
            <NavigationContentMemo onNavigate={closeDrawer} />
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
      </ConsolePanelProvider>
    </ModalManagerProvider>
  );
}
