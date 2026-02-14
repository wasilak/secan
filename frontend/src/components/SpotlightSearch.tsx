/* eslint-disable react-refresh/only-export-components */
import { useNavigate } from 'react-router-dom';
import { Spotlight, spotlight } from '@mantine/spotlight';
import {
  IconDashboard,
  IconServer,
  IconPlus,
  IconSearch,
  IconSettings,
  IconMap,
  IconDatabase,
  IconTerminal,
  IconFileText,
  IconPhoto,
  IconCopy,
  IconBolt,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * SpotlightSearch component provides keyboard-driven navigation
 * 
 * Features:
 * - Cmd/Ctrl+K to open search
 * - Navigate to clusters, indices, and features
 * - Keyboard navigation support
 * - Search filtering
 * 
 * Requirements: 32.3, 32.4
 */
export function SpotlightSearch() {
  const navigate = useNavigate();

  // Fetch clusters for dynamic actions
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(),
  });

  // Build actions array
  const actions = [
    // Dashboard
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View all clusters overview',
      onClick: () => navigate('/'),
      leftSection: <IconDashboard size={20} />,
      keywords: ['home', 'overview', 'clusters'],
    },
    
    // Cluster-specific actions
    ...(clusters?.flatMap((cluster) => [
      {
        id: `cluster-${cluster.id}`,
        label: `${cluster.name}`,
        description: 'View cluster overview',
        onClick: () => navigate(`/cluster/${cluster.id}`),
        leftSection: <IconServer size={20} />,
        keywords: ['cluster', 'overview', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-indices`,
        label: `${cluster.name} - Indices`,
        description: 'View cluster indices',
        onClick: () => navigate(`/cluster/${cluster.id}/indices`),
        leftSection: <IconDatabase size={20} />,
        keywords: ['cluster', 'indices', 'index', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-create-index`,
        label: `${cluster.name} - Create Index`,
        description: 'Create new index',
        onClick: () => navigate(`/cluster/${cluster.id}/indices/create`),
        leftSection: <IconPlus size={20} />,
        keywords: ['cluster', 'create', 'index', 'new', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-nodes`,
        label: `${cluster.name} - Nodes`,
        description: 'View cluster nodes',
        onClick: () => navigate(`/cluster/${cluster.id}/nodes`),
        leftSection: <IconServer size={20} />,
        keywords: ['cluster', 'nodes', 'servers', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-shards`,
        label: `${cluster.name} - Shards`,
        description: 'View shard allocation',
        onClick: () => navigate(`/cluster/${cluster.id}/shards`),
        leftSection: <IconCopy size={20} />,
        keywords: ['cluster', 'shards', 'allocation', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-rest`,
        label: `${cluster.name} - REST Console`,
        description: 'Open REST console',
        onClick: () => navigate(`/cluster/${cluster.id}/rest`),
        leftSection: <IconTerminal size={20} />,
        keywords: ['cluster', 'rest', 'console', 'api', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-aliases`,
        label: `${cluster.name} - Aliases`,
        description: 'Manage index aliases',
        onClick: () => navigate(`/cluster/${cluster.id}/aliases`),
        leftSection: <IconFileText size={20} />,
        keywords: ['cluster', 'aliases', 'alias', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-templates`,
        label: `${cluster.name} - Templates`,
        description: 'Manage index templates',
        onClick: () => navigate(`/cluster/${cluster.id}/templates`),
        leftSection: <IconFileText size={20} />,
        keywords: ['cluster', 'templates', 'template', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-snapshots`,
        label: `${cluster.name} - Snapshots`,
        description: 'Manage snapshots',
        onClick: () => navigate(`/cluster/${cluster.id}/snapshots`),
        leftSection: <IconPhoto size={20} />,
        keywords: ['cluster', 'snapshots', 'backup', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-repositories`,
        label: `${cluster.name} - Repositories`,
        description: 'Manage snapshot repositories',
        onClick: () => navigate(`/cluster/${cluster.id}/repositories`),
        leftSection: <IconDatabase size={20} />,
        keywords: ['cluster', 'repositories', 'repository', 'backup', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-settings`,
        label: `${cluster.name} - Cluster Settings`,
        description: 'View and edit cluster settings',
        onClick: () => navigate(`/cluster/${cluster.id}/settings`),
        leftSection: <IconSettings size={20} />,
        keywords: ['cluster', 'settings', 'configuration', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-shard-management`,
        label: `${cluster.name} - Shard Management`,
        description: 'Manage shard allocation',
        onClick: () => navigate(`/cluster/${cluster.id}/shard-management`),
        leftSection: <IconBolt size={20} />,
        keywords: ['cluster', 'shard', 'management', 'allocation', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-text-analysis`,
        label: `${cluster.name} - Text Analysis`,
        description: 'Analyze text with analyzers',
        onClick: () => navigate(`/cluster/${cluster.id}/text-analysis`),
        leftSection: <IconSearch size={20} />,
        keywords: ['cluster', 'text', 'analysis', 'analyzer', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-index-analyzers`,
        label: `${cluster.name} - Index Analyzers`,
        description: 'View index analyzers and fields',
        onClick: () => navigate(`/cluster/${cluster.id}/index-analyzers`),
        leftSection: <IconMap size={20} />,
        keywords: ['cluster', 'index', 'analyzers', 'fields', cluster.name],
      },
      {
        id: `cluster-${cluster.id}-cat-api`,
        label: `${cluster.name} - Cat API`,
        description: 'Access Cat API endpoints',
        onClick: () => navigate(`/cluster/${cluster.id}/cat-api`),
        leftSection: <IconTerminal size={20} />,
        keywords: ['cluster', 'cat', 'api', cluster.name],
      },
    ]) || []),
  ];

  return (
    <Spotlight
      actions={actions}
      nothingFound="No results found"
      highlightQuery
      searchProps={{
        leftSection: <IconSearch size={20} />,
        placeholder: 'Search for clusters, indices, and features...',
        'aria-label': 'Search navigation',
      }}
      shortcut={['mod + K', 'mod + P']}
      closeOnActionTrigger
    />
  );
}

/**
 * Hook to open spotlight programmatically
 */
export function useSpotlight() {
  return {
    open: spotlight.open,
    close: spotlight.close,
    toggle: spotlight.toggle,
  };
}
