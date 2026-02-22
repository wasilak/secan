import { useNavigate, useLocation } from 'react-router-dom';
import { Spotlight } from '@mantine/spotlight';
import {
  IconDashboard,
  IconServer,
  IconSearch,
  IconDatabase,
  IconChartBar,
  IconCopy,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useClusterName } from '../hooks/useClusterName';
import { useMemo } from 'react';

/**
 * SpotlightSearch component provides keyboard-driven navigation
 * 
 * Features:
 * - Cmd/Ctrl+K to open search
 * - Context-aware navigation items
 * - Dashboard view: Shows cluster tabs (Overview, Statistics, Nodes, Indices, Shards)
 * - Cluster view: Shows nodes, indices, and tabs for current cluster
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
    queryKey: ['clusters'],
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
  const { data: nodes } = useQuery({
    queryKey: ['cluster', currentClusterId, 'nodes'],
    queryFn: () => apiClient.getNodes(currentClusterId!),
    enabled: !!currentClusterId,
  });

  // Fetch indices for current cluster (only if in cluster view)
  const { data: indices } = useQuery({
    queryKey: ['cluster', currentClusterId, 'indices'],
    queryFn: () => apiClient.getIndices(currentClusterId!),
    enabled: !!currentClusterId,
  });

  // Build actions array based on context
  const actions = useMemo(() => {
    const items = [];

    // Always show dashboard
    items.push({
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View all clusters overview',
      onClick: () => navigate('/'),
      leftSection: <IconDashboard size={20} />,
      keywords: ['home', 'overview', 'clusters', 'dashboard'],
    });

    if (currentClusterId) {
      // In cluster view - show nodes, indices, and tabs for current cluster
      const clusterName = currentClusterName;

      // Cluster tabs
      const tabs = [
        { id: 'overview', label: 'Overview', icon: IconChartBar, path: '' },
        { id: 'statistics', label: 'Statistics', icon: IconChartBar, path: '?tab=statistics' },
        { id: 'nodes-tab', label: 'Nodes', icon: IconServer, path: '?tab=nodes' },
        { id: 'indices-tab', label: 'Indices', icon: IconDatabase, path: '?tab=indices' },
        { id: 'shards-tab', label: 'Shards', icon: IconCopy, path: '?tab=shards' },
      ];

      tabs.forEach(tab => {
        items.push({
          id: `cluster-${currentClusterId}-${tab.id}`,
          label: `${clusterName} - ${tab.label}`,
          description: `View ${tab.label.toLowerCase()} tab`,
          onClick: () => navigate(`/cluster/${currentClusterId}${tab.path}`),
          leftSection: <tab.icon size={20} />,
          keywords: ['cluster', tab.label.toLowerCase(), clusterName],
        });
      });

      // Individual nodes
      if (nodes && nodes.length > 0) {
        nodes.forEach(node => {
          items.push({
            id: `node-${node.id}`,
            label: `Node: ${node.name}`,
            description: `${node.ip} - ${node.roles.join(', ')}`,
            onClick: () => navigate(`/cluster/${currentClusterId}/nodes/${node.id}`),
            leftSection: <IconServer size={20} />,
            keywords: ['node', node.name, node.ip, ...node.roles, currentClusterName],
          });
        });
      }

      // Individual indices
      if (indices && indices.length > 0) {
        indices.forEach(index => {
          items.push({
            id: `index-${index.name}`,
            label: `Index: ${index.name}`,
            description: `${index.health} - ${index.docsCount?.toLocaleString() || 0} docs`,
            onClick: () => navigate(`/cluster/${currentClusterId}?tab=indices&index=${encodeURIComponent(index.name)}`),
            leftSection: <IconDatabase size={20} />,
            keywords: ['index', index.name, currentClusterName],
          });
        });
      }
    } else {
      // In dashboard view - show all clusters with their tabs
      // Ensure clusters is an array before iterating
      if (Array.isArray(clusters) && clusters.length > 0) {
        const tabs = [
          { id: 'overview', label: 'Overview', icon: IconChartBar },
          { id: 'statistics', label: 'Statistics', icon: IconChartBar },
          { id: 'nodes', label: 'Nodes', icon: IconServer },
          { id: 'indices', label: 'Indices', icon: IconDatabase },
          { id: 'shards', label: 'Shards', icon: IconCopy },
        ];

        clusters.forEach(cluster => {
          tabs.forEach(tab => {
            const path = tab.id === 'overview' 
              ? `/cluster/${cluster.id}` 
              : `/cluster/${cluster.id}?tab=${tab.id}`;
            
            items.push({
              id: `cluster-${cluster.id}-${tab.id}`,
              label: `${cluster.name} - ${tab.label}`,
              description: `View ${cluster.name} ${tab.label.toLowerCase()}`,
              onClick: () => navigate(path),
              leftSection: <tab.icon size={20} />,
              keywords: ['cluster', tab.label.toLowerCase(), cluster.name],
            });
          });
        });
      }
    }

    return items;
  }, [clusters, currentClusterId, currentClusterName, nodes, indices, navigate]);

  return (
    <Spotlight
      actions={actions}
      nothingFound="No results found"
      highlightQuery
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