import { useState, useEffect } from 'react';
import {
  Container,
  Text,
  Card,
  Button,
  Stack,
  Group,
  Alert,
  Skeleton,
  Tabs,
  HoverCard,
  Code,
  ScrollArea,
  Loader,
  Box,
  Badge,
} from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertCircle, IconCheck, IconSettings, IconMap, IconInfoCircle, IconChartBar } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Editor from '@monaco-editor/react';
import { apiClient } from '../api/client';
import { useTheme } from '../hooks/useTheme';
import { parseError } from '../lib/errorHandling';

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
    return (error as Error).message;
  }
}

/**
 * Filter out read-only and static settings that cannot be updated on an open index
 */
function filterReadOnlySettings(settings: Record<string, unknown>): Record<string, unknown> {
  // System-managed read-only fields (never modifiable)
  const systemReadOnlyFields = [
    'creation_date',
    'provided_name',
    'uuid',
    'version',
  ];

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
export function IndexEdit() {
  const params = useParams<{ id?: string; indexName?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get cluster ID from route params (works in both modal and standalone mode)
  const clusterId = params.id;
  
  // Get index name from URL params (for modal mode) or route params (for standalone mode)
  const indexName = searchParams.get('index') || params.indexName;
  
  // Get active tab from URL or default to 'settings'
  const activeTab = searchParams.get('indexTab') || searchParams.get('tab') || 'settings';

  const [settings, setSettings] = useState('');
  const [mappings, setMappings] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [settingsModified, setSettingsModified] = useState(false);
  const [mappingsModified, setMappingsModified] = useState(false);

  // State for stats tab - fetch on demand
  const [statsData, setStatsData] = useState<unknown>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch stats when stats tab is opened
  useEffect(() => {
    if (activeTab === 'stats' && !statsData && !statsLoading) {
      setStatsLoading(true);
      setStatsError(null);
      
      apiClient
        .proxyRequest<Record<string, unknown>>(
          clusterId!,
          'GET',
          `/${indexName}/_stats`
        )
        .then((response) => {
          setStatsData(response);
        })
        .catch((error) => {
          setStatsError(error instanceof Error ? error.message : 'Failed to fetch stats');
        })
        .finally(() => {
          setStatsLoading(false);
        });
    }
  }, [activeTab, clusterId, indexName, statsData, statsLoading]);

  // Fetch current index settings
  const {
    data: currentSettings,
    isLoading: settingsLoading,
    error: settingsLoadError,
  } = useQuery({
    queryKey: ['cluster', clusterId, 'index', indexName, 'settings'],
    queryFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        `/${indexName}/_settings`
      );

      const indexData = response[indexName] as Record<string, unknown>;
      return indexData?.settings as Record<string, unknown>;
    },
    enabled: !!clusterId && !!indexName,
  });

  // Fetch current index mappings
  const {
    data: currentMappings,
    isLoading: mappingsLoading,
    error: mappingsLoadError,
  } = useQuery({
    queryKey: ['cluster', clusterId, 'index', indexName, 'mappings'],
    queryFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        `/${indexName}/_mapping`
      );

      const indexData = response[indexName] as Record<string, unknown>;
      return indexData?.mappings as Record<string, unknown>;
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
          apiClient.proxyRequest(
            clusterId,
            'PUT',
            `/${indexName}/_settings`,
            filteredSettings
          )
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
          apiClient.proxyRequest(
            clusterId,
            'PUT',
            `/${indexName}/_mapping`,
            parsedMappings
          )
        );
      }

      // Execute all updates
      await Promise.all(updates);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['cluster', clusterId, 'index', indexName],
      });
      queryClient.invalidateQueries({
        queryKey: ['cluster', clusterId, 'indices'],
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
      // Use indexTab for modal mode, tab for standalone mode
      if (searchParams.has('index')) {
        params.set('indexTab', value);
      } else {
        params.set('tab', value);
      }
      setSearchParams(params);
    }
  };

  const isLoading = settingsLoading || mappingsLoading;
  const loadError = settingsLoadError || mappingsLoadError;
  const isModified = settingsModified || mappingsModified;

  if (!clusterId || !indexName) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID and index name are required
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container size="xl" py="md">
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
      </Container>
    );
  }

  if (loadError) {
    const errorDetails = parseError(loadError);
    return (
      <Container size="xl" py="md">
        <Alert icon={<IconAlertCircle size={16} />} title="Error Loading Index" color="red">
          {errorDetails.message}
        </Alert>
        <Button
          variant="default"
          onClick={() => navigate(`/cluster/${clusterId}?tab=indices`)}
          mt="md"
        >
          Back to Indices
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Badge size="lg" variant="light" color="blue">{indexName}</Badge>
        </Group>
        {!searchParams.has('index') && (
          <Button
            variant="default"
            onClick={() => navigate(`/cluster/${clusterId}?tab=indices`)}
          >
            Back to Indices
          </Button>
        )}
      </Group>

      <Stack gap="md" style={{ flex: 1, overflow: 'auto' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
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
                          number_of_shards, codec, sort, store, routing_path, analysis (analyzers, tokenizers, filters), similarity, mapping, and others
                        </Text>
                      </HoverCard.Dropdown>
                    </HoverCard>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Edit the dynamic settings below
                  </Text>
                  <Box style={{ border: '1px solid var(--mantine-color-gray-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                    <Editor
                      height="500px"
                      defaultLanguage="json"
                      value={settings}
                      onChange={handleSettingsChange}
                      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </Box>
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
              <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Mapping Restrictions">
                <Text size="sm">
                  <strong>Important:</strong> Existing field mappings cannot be changed or deleted.
                  You can only <strong>add new fields</strong>. To change field types, you must reindex your data.
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
                    <Box style={{ border: '1px solid var(--mantine-color-gray-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                      <Editor
                        height="500px"
                        defaultLanguage="json"
                        value={mappings}
                        onChange={handleMappingsChange}
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </Box>
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
                      {statsError}
                    </Alert>
                  ) : statsData ? (
                    <ScrollArea h={500}>
                      <Code block>
                        {JSON.stringify(statsData, null, 2)}
                      </Code>
                    </ScrollArea>
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
          <Button
            onClick={handleSubmit}
            loading={updateMutation.isPending}
            disabled={!isModified}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
