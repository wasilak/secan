import { useNavigate, useLocation } from 'react-router-dom';
import { Spotlight, type SpotlightActionData, type SpotlightActionGroupData } from '@mantine/spotlight';
import {
  IconDashboard,
  IconServer,
  IconSearch,
  IconDatabase,
  IconChartBar,
  IconCopy,
  IconTopologyFull,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { getPaginatedItems } from '../types/api';
import { useClusterName } from '../hooks/useClusterName';
import { queryKeys } from '../utils/queryKeys';
import { useClusterIndices } from '../hooks/useClusterIndices';
import { useClusterNodes } from '../hooks/useClusterNodes';
import { useMemo } from 'react';

/**
 * SpotlightSearch component provides keyboard-driven navigation
 *
 * Features:
 * - Cmd/Ctrl+K to open search
 * - Context-aware navigation items with grouped categories
 * - Dashboard view: Shows cluster tabs grouped by cluster
 * - Cluster view: Shows tabs, nodes, and indices in separate groups
 * - Keyboard navigation support
 * - Search filtering
 *
 * Requirements: 32.3, 32.4
 */
export function SpotlightSearch() {
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch clusters for dynamic actions
  const { data: clusters } = useQuery({
    queryKey: queryKeys.clusters.list(),
    queryFn: () => apiClient.getClusters(),
  });

  // Determine current context
  const currentClusterId = useMemo(() => {
    const match = location.pathname.match(/^\/cluster\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  // Get resolved cluster name for current cluster
  const currentClusterName = useClusterName(currentClusterId || '');

  // Fetch nodes for current cluster (only if in cluster view)
  const { data: nodesPaginated } = useClusterNodes(currentClusterId ?? undefined, {
    enabled: !!currentClusterId,
  });

  const nodes = getPaginatedItems(nodesPaginated);

  // Fetch indices for current cluster (only if in cluster view)
  const { data: indicesPaginated } = useClusterIndices(currentClusterId ?? undefined, {
    enabled: !!currentClusterId,
  });

  const indices = getPaginatedItems(indicesPaginated);

  // Tab definitions shared between cluster-view and dashboard-view groups
  const clusterTabs = [
    { id: 'overview', label: 'Overview', icon: IconChartBar, path: '/overview' },
    { id: 'statistics', label: 'Statistics', icon: IconChartBar, path: '/statistics' },
    { id: 'nodes', label: 'Nodes', icon: IconServer, path: '/nodes' },
    { id: 'indices', label: 'Indices', icon: IconDatabase, path: '/indices' },
    { id: 'shards', label: 'Shards', icon: IconCopy, path: '/shards' },
    { id: 'topology', label: 'Topology', icon: IconTopologyFull, path: '/topology' },
    { id: 'tasks', label: 'Tasks', icon: IconPlayerPlay, path: '/tasks' },
  ];

  // Build actions array with groups based on context
  const actions = useMemo(() => {
    const groups: (SpotlightActionGroupData | SpotlightActionData)[] = [];

    // Always show dashboard as a standalone action
    groups.push({
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View all clusters overview',
      onClick: () => navigate('/'),
      leftSection: <IconDashboard size={20} />,
      keywords: ['home', 'overview', 'clusters', 'dashboard'],
    });

    if (currentClusterId) {
      // In cluster view — show the current cluster's tabs, nodes, and indices
      const clusterName = currentClusterName;

      const tabActions: SpotlightActionData[] = clusterTabs.map((tab) => ({
        id: `cluster-${currentClusterId}-${tab.id}`,
        label: tab.label,
        description: `View ${clusterName ?? currentClusterId} ${tab.label.toLowerCase()}`,
        onClick: () => navigate(`/cluster/${currentClusterId}${tab.path}`),
        leftSection: <tab.icon size={20} />,
        keywords: ['cluster', tab.label.toLowerCase(), ...(clusterName ? [clusterName] : [])],
      }));

      groups.push({
        group: clusterName ?? currentClusterId,
        actions: tabActions,
      });

      // Group: Nodes (current cluster)
      if (nodes && nodes.length > 0) {
        const nodeActions: SpotlightActionData[] = nodes.map((node) => ({
          id: `node-${node.id}`,
          label: node.name,
          description: `${node.ip} - ${node.roles.join(', ')}`,
          onClick: () => navigate(`/cluster/${currentClusterId}/nodes/${node.id}`),
          leftSection: <IconServer size={20} />,
          keywords: ['node', node.name, ...(node.ip ? [node.ip] : []), ...node.roles, ...(clusterName ? [clusterName] : [])],
        }));

        groups.push({ group: 'Nodes', actions: nodeActions });
      }

      // Group: Indices (current cluster)
      if (indices && indices.length > 0) {
        const indexActions: SpotlightActionData[] = indices.map((index) => ({
          id: `index-${index.name}`,
          label: index.name,
          description: `${index.health} - ${index.docsCount?.toLocaleString() || 0} docs`,
          onClick: () =>
            navigate(`/cluster/${currentClusterId}/indices/${encodeURIComponent(index.name)}`),
          leftSection: <IconDatabase size={20} />,
          keywords: ['index', index.name, ...(clusterName ? [clusterName] : [])],
        }));

        groups.push({ group: 'Indices', actions: indexActions });
      }
    }

    // Always show all clusters so the user can navigate between them from any view.
    // In the cluster view, other clusters appear as "Switch to …" groups below the
    // current cluster's sections.
    if (clusters?.items && clusters.items.length > 0) {
      clusters.items
        .filter((c) => c.id !== currentClusterId) // skip current cluster (already shown above)
        .forEach((cluster) => {
          const clusterActions: SpotlightActionData[] = clusterTabs.map((tab) => ({
            id: `cluster-${cluster.id}-${tab.id}`,
            label: tab.label,
            description: `View ${cluster.name ?? cluster.id} ${tab.label.toLowerCase()}`,
            onClick: () => navigate(`/cluster/${cluster.id}${tab.path}`),
            leftSection: <tab.icon size={20} />,
            keywords: ['cluster', tab.label.toLowerCase(), cluster.name ?? cluster.id],
          }));

          groups.push({
            group: cluster.name ?? cluster.id,
            actions: clusterActions,
          });
        });
    }

    return groups;
  }, [clusters, currentClusterId, currentClusterName, nodes, indices, navigate]);

  return (
    <Spotlight
      actions={actions}
      nothingFound="No results found"
      highlightQuery
      scrollable
      maxHeight={400}
      searchProps={{
        leftSection: <IconSearch size={20} />,
        placeholder: currentClusterId
          ? 'Search nodes, indices, and tabs...'
          : 'Search clusters and tabs...',
        'aria-label': 'Search navigation',
      }}
      shortcut={['mod + K', 'mod + P']}
      closeOnActionTrigger
    />
  );
}
