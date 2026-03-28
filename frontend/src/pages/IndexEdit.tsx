import { useState, useEffect } from 'react';
import {
  Text,
  Card,
  Button,
  Stack,
  Group,
  Alert,
  Skeleton,
  Tabs,
  HoverCard,
  Loader,
  Box,
  Badge,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { IndexVisualization } from '../components/IndexVisualization';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconAlertCircle,
  IconCheck,
  IconSettings,
  IconMap,
  IconInfoCircle,
  IconChartBar,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { parseError, getErrorMessage } from '../lib/errorHandling';
import { CodeEditor } from '../components/CodeEditor';
import type { ShardInfo } from '../types/api';

/**
 * Validate JSON string
 */
function validateJSON(json: string, fieldName: string): string | null {
  if (!json.trim()) {
    return `${fieldName} cannot be empty`;
  }

  try {
    JSON.parse(json);
    return null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

/**
 * Filter out read-only and static settings that cannot be updated on an open index
 */
function filterReadOnlySettings(settings: Record<string, unknown>): Record<string, unknown> {
  // System-managed read-only fields (never modifiable)
  const systemReadOnlyFields = ['creation_date', 'provided_name', 'uuid', 'version'];

  // Static settings (can only be set at index creation or on closed index)
  const staticFields = [
    'number_of_shards',
    'number_of_routing_shards',
    'codec',
    'mode',
    'routing_partition_size',
    'soft_deletes',
    'load_fixed_bitset_filters_eagerly',
    'shard',
    'sort',
    'store',
    'time_series',
    'routing_path',
    'analysis', // All analysis settings (analyzers, tokenizers, filters, etc.)
    'similarity', // Similarity algorithms
    'mapping', // Mapping settings
  ];

  const allFilteredFields = [...systemReadOnlyFields, ...staticFields];

  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (key === 'index') {
      // Filter nested index settings
      const indexSettings = value as Record<string, unknown>;
      const filteredIndex: Record<string, unknown> = {};

      for (const [indexKey, indexValue] of Object.entries(indexSettings)) {
        // Skip read-only and static fields
        if (!allFilteredFields.includes(indexKey)) {
          filteredIndex[indexKey] = indexValue;
        }
      }

      if (Object.keys(filteredIndex).length > 0) {
        filtered[key] = filteredIndex;
      }
    } else if (!allFilteredFields.includes(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * IndexEdit component - unified interface for editing index settings and mappings
 *
 * Features:
 * - Tabbed interface for Settings and Mappings
 * - Shared save button that updates both if modified
 * - JSON editor for modifications with syntax highlighting
 * - JSON validation before submission
 * - Informational notes about restrictions
 *
 * Requirements: 7.1-7.8, 8.1-8.8
 */
interface IndexEditProps {
  /**
   * If true, constrains width to parent container (useful in modals)
   */
  constrainToParent?: boolean;
  /**
   * If true, hides the header with index name badge (for modal use)
   */
  hideHeader?: boolean;
  /**
   * Optional callback when a shard is clicked
   * Only triggers for assigned shards (shard.node !== null)
   */
  onShardClick?: (shard: ShardInfo) => void;
  /**
   * If true, there's a modal layered above this one
   * When true, ESC and click-outside should NOT close this modal
   */
  hasModalAbove?: boolean;
}

export function IndexEdit({ constrainToParent = false, hideHeader = false, onShardClick }: IndexEditProps) {
  const params = useParams<{ id?: string; indexName?: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get cluster ID from route params (works in both modal and standalone mode)
  const clusterId = params.id;

  // Get index name from URL params (for modal mode) or route params (for standalone mode)
  // ?indexModal is used by the query-param modal system in ClusterView
  // ?index is the legacy param name kept for backwards compatibility
  const indexName = searchParams.get('indexModal') || searchParams.get('index') || params.indexName;

  // Get active tab from URL or default to 'visualization'
  const activeTab = searchParams.get('indexTab') || searchParams.get('tab') || 'visualization';

  // Ensure tab is set in URL when modal opens
  useEffect(() => {
    if ((searchParams.has('indexModal') || searchParams.has('index')) && !searchParams.has('indexTab')) {
      const params = new URLSearchParams(searchParams);
      params.set('indexTab', 'visualization');
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [settings, setSettings] = useState('');
  const [mappings, setMappings] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [settingsModified, setSettingsModified] = useState(false);
  const [mappingsModified, setMappingsModified] = useState(false);

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: queryKeys.cluster(clusterId ?? '').index(indexName ?? '').stats(),
    queryFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        `/${indexName}/_stats`
      );

      return response.data;
    },
    enabled: !!clusterId && !!indexName && activeTab === 'stats',
  });

  // Fetch current index settings
  const {
    data: currentSettings,
    isLoading: settingsLoading,
    error: settingsLoadError,
  } = useQuery({
    queryKey: queryKeys.cluster(clusterId!).index(indexName!).settings(),
    queryFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        `/${indexName}/_settings`
      );

      const responseData = (response.data || {}) as Record<string, unknown>;
      const indexData = responseData[indexName];
      
      // Handle case where index response is empty (empty index with 0 docs)
      if (!indexData || typeof indexData !== 'object') {
        return {} as Record<string, unknown>;
      }
      
      const settings = (indexData as Record<string, unknown>).settings;
      return (settings && typeof settings === 'object') ? (settings as Record<string, unknown>) : ({} as Record<string, unknown>);
    },
    enabled: !!clusterId && !!indexName,
  });

  // Fetch current index mappings
  const {
    data: currentMappings,
    isLoading: mappingsLoading,
    error: mappingsLoadError,
  } = useQuery({
    queryKey: queryKeys.cluster(clusterId!).index(indexName!).mappings(),
    queryFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        `/${indexName}/_mapping`
      );

      const responseData = (response.data || {}) as Record<string, unknown>;
      const indexData = responseData[indexName];
      
      // Handle case where index has no mappings (empty index with 0 docs)
      if (!indexData || typeof indexData !== 'object') {
        return {} as Record<string, unknown>;
      }
      
      const mappings = (indexData as Record<string, unknown>).mappings;
      return (mappings && typeof mappings === 'object') ? (mappings as Record<string, unknown>) : ({} as Record<string, unknown>);
    },
    enabled: !!clusterId && !!indexName,
  });

  // Initialize editors when data is loaded
  useEffect(() => {
    if (currentSettings) {
      const filteredSettings = filterReadOnlySettings(currentSettings);
      setSettings(JSON.stringify(filteredSettings, null, 2));
      setSettingsModified(false);
    }
  }, [currentSettings]);

  useEffect(() => {
    if (currentMappings) {
      setMappings(JSON.stringify(currentMappings, null, 2));
      setMappingsModified(false);
    }
  }, [currentMappings]);

  // Update mutation - handles both settings and mappings
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      const updates: Promise<void>[] = [];

      // Update settings if modified
      if (settingsModified) {
        const validation = validateJSON(settings, 'Settings');
        if (validation) {
          setSettingsError(validation);
          throw new Error(`Invalid settings JSON: ${validation}`);
        }

        const parsedSettings = JSON.parse(settings);
        const filteredSettings = filterReadOnlySettings(parsedSettings);

        updates.push(
          apiClient
            .proxyRequest(clusterId, 'PUT', `/${indexName}/_settings`, filteredSettings)
            .then(() => undefined)
        );
      }

      // Update mappings if modified
      if (mappingsModified) {
        const validation = validateJSON(mappings, 'Mappings');
        if (validation) {
          setMappingsError(validation);
          throw new Error(`Invalid mappings JSON: ${validation}`);
        }

        const parsedMappings = JSON.parse(mappings);

        updates.push(
          apiClient
            .proxyRequest(clusterId, 'PUT', `/${indexName}/_mapping`, parsedMappings)
            .then(() => undefined)
        );
      }

      // Execute all updates
      await Promise.all(updates);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.cluster(clusterId!).index(indexName!).all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.cluster(clusterId!).indices(),
      });

      // Show success notification
      const updated: string[] = [];
      if (settingsModified) updated.push('settings');
      if (mappingsModified) updated.push('mappings');

      notifications.show({
        title: 'Success',
        message: `Index ${updated.join(' and ')} updated successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      setSettingsModified(false);
      setMappingsModified(false);
      setUpdateError(null);
    },
    onError: (error: Error) => {
      const errorDetails = parseError(error);
      setUpdateError(errorDetails.message);
    },
  });

  const handleSettingsChange = (value: string | undefined) => {
    setSettings(value || '');
    setSettingsError(null);
    setUpdateError(null);
    setSettingsModified(true);
  };

  const handleMappingsChange = (value: string | undefined) => {
    setMappings(value || '');
    setMappingsError(null);
    setUpdateError(null);
    setMappingsModified(true);
  };

  const handleSubmit = () => {
    setSettingsError(null);
    setMappingsError(null);
    setUpdateError(null);
    updateMutation.mutate();
  };

  const handleReset = () => {
    if (currentSettings) {
      const filteredSettings = filterReadOnlySettings(currentSettings);
      setSettings(JSON.stringify(filteredSettings, null, 2));
      setSettingsModified(false);
    }
    if (currentMappings) {
      setMappings(JSON.stringify(currentMappings, null, 2));
      setMappingsModified(false);
    }
    setSettingsError(null);
    setMappingsError(null);
    setUpdateError(null);
  };

  const handleTabChange = (value: string | null) => {
    if (value) {
      const params = new URLSearchParams(searchParams);
      // Always use indexTab for consistency
      params.set('indexTab', value);
      // Remove old 'tab' param if it exists
      params.delete('tab');
      setSearchParams(params);
    }
  };

  const isLoading = settingsLoading || mappingsLoading;
  const loadError = settingsLoadError || mappingsLoadError;
  const isModified = settingsModified || mappingsModified;

  if (!clusterId || !indexName) {
    return (
      <FullWidthContainer constrainToParent={constrainToParent}>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID and index name are required
        </Alert>
      </FullWidthContainer>
    );
  }

  if (isLoading) {
    return (
      <FullWidthContainer constrainToParent={constrainToParent}>
        <Group justify="space-between" mb="md">
          <div>
            <Skeleton height={32} width={200} mb="xs" />
            <Skeleton height={20} width={150} />
          </div>
          <Skeleton height={36} width={120} />
        </Group>

        <Stack gap="md">
          <Skeleton height={48} width="100%" />
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Skeleton height={400} />
          </Card>
        </Stack>
      </FullWidthContainer>
    );
  }

  if (loadError) {
    const errorDetails = parseError(loadError);
    return (
      <FullWidthContainer constrainToParent={constrainToParent}>
        <Alert icon={<IconAlertCircle size={16} />} title="Error Loading Index" color="red">
          {errorDetails.message}
        </Alert>
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer constrainToParent={constrainToParent} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!hideHeader && (
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Badge size="lg" variant="light" color="blue">
              {indexName}
            </Badge>
          </Group>
        </Group>
      )}

      <Stack gap="md" style={{ flex: 1, overflow: 'auto' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab value="visualization" leftSection={<IconMap size={16} />}>
              Visualization
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
            <Tabs.Tab value="mappings" leftSection={<IconMap size={16} />}>
              Mappings
            </Tabs.Tab>
            <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>
              Stats
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="visualization" pt="md">
            <IndexVisualization
              clusterId={clusterId}
              indexName={indexName}
              onNodeClick={undefined}
              onShardClick={onShardClick}
            />
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="md">
            <Card shadow="sm" padding="lg">
              <Stack gap="md">
                <Box>
                  <Group gap="xs" mb="xs">
                    <Text size="sm" fw={500}>
                      Index Settings (JSON)
                    </Text>
                    <HoverCard width={320} shadow="md" withArrow>
                      <HoverCard.Target>
                        <Box component="span" style={{ cursor: 'help' }} c="blue.6">
                          <IconInfoCircle size={16} />
                        </Box>
                      </HoverCard.Target>
                      <HoverCard.Dropdown>
                        <Text size="sm" fw={500} mb="xs">
                          Filtered Settings
                        </Text>
                        <Text size="xs">
                          Static and read-only settings are automatically filtered from this editor.
                        </Text>
                        <Text size="xs" mt="xs">
                          <strong>System-managed (never modifiable):</strong>
                          <br />
                          creation_date, uuid, version, provided_name
                        </Text>
                        <Text size="xs" mt="xs">
                          <strong>Static (require closed index):</strong>
                          <br />
                          number_of_shards, codec, sort, store, routing_path, analysis (analyzers,
                          tokenizers, filters), similarity, mapping, and others
                        </Text>
                      </HoverCard.Dropdown>
                    </HoverCard>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Edit the dynamic settings below
                  </Text>
                  <CodeEditor
                    value={settings}
                    onChange={handleSettingsChange}
                    language="json"
                    height="500px"
                    showCopyButton
                  />
                  {settingsError && (
                    <Text size="sm" c="red" mt="xs">
                      {settingsError}
                    </Text>
                  )}
                </Box>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="mappings" pt="md">
            <Stack gap="md">
              <Alert
                icon={<IconInfoCircle size={16} />}
                color="yellow"
                title="Mapping Restrictions"
              >
                <Text size="sm">
                  <strong>Important:</strong> Existing field mappings cannot be changed or deleted.
                  You can only <strong>add new fields</strong>. To change field types, you must
                  reindex your data.
                </Text>
              </Alert>

              <Card shadow="sm" padding="lg">
                <Stack gap="md">
                  <Box>
                    <Text size="sm" fw={500} mb="xs">
                      Index Mappings (JSON)
                    </Text>
                    <Text size="xs" c="dimmed" mb="sm">
                      Add new fields to the mappings below
                    </Text>
                    <CodeEditor
                      value={mappings}
                      onChange={handleMappingsChange}
                      language="json"
                      height="500px"
                      showCopyButton
                    />
                    {mappingsError && (
                      <Text size="sm" c="red" mt="xs">
                        {mappingsError}
                      </Text>
                    )}
                  </Box>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="stats" pt="md">
            <Card shadow="sm" padding="lg">
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Index Statistics (Read-only)
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                     Detailed statistics for this index
                   </Text>
                   {statsLoading ? (
                     <Group justify="center" py="xl">
                       <Loader />
                     </Group>
                   ) : statsError ? (
                     <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
                       {getErrorMessage(statsError)}
                     </Alert>
                   ) : statsData ? (
                    <CodeEditor
                      value={JSON.stringify(statsData, null, 2)}
                      language="json"
                      height="500px"
                      readOnly
                      showCopyButton
                    />
                  ) : null}
                </div>
              </Stack>
            </Card>
          </Tabs.Panel>
        </Tabs>

        {updateError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Failed to Update Index"
            color="red"
            withCloseButton
            onClose={() => setUpdateError(null)}
          >
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {updateError}
            </Text>
          </Alert>
        )}

        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={handleReset}
            disabled={!isModified || updateMutation.isPending}
          >
            Reset
          </Button>
          <Button onClick={handleSubmit} loading={updateMutation.isPending} disabled={!isModified}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </Group>
      </Stack>
    </FullWidthContainer>
  );
}
