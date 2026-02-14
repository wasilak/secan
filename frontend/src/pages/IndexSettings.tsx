import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Button,
  Stack,
  Group,
  Alert,
  Loader,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertCircle, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Editor from '@monaco-editor/react';
import { apiClient } from '../api/client';
import { useTheme } from '../hooks/useTheme';

/**
 * Validate JSON string
 * 
 * Requirements: 7.3
 */
function validateJSON(json: string): string | null {
  if (!json.trim()) {
    return 'Settings cannot be empty';
  }

  try {
    JSON.parse(json);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * IndexSettings component displays and allows editing of index settings
 * 
 * Features:
 * - Fetch and display current settings as JSON
 * - JSON editor for modifications with syntax highlighting
 * - JSON validation before submission
 * - Informational notes about static vs dynamic settings
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8
 */
export function IndexSettings() {
  const { id: clusterId, indexName } = useParams<{ id: string; indexName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();

  const [settings, setSettings] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);

  // Fetch current index settings
  const {
    data: currentSettings,
    isLoading,
    error,
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

      // Extract settings from the response
      // Response format: { "index-name": { "settings": { ... } } }
      const indexData = response[indexName] as Record<string, unknown>;
      return indexData?.settings as Record<string, unknown>;
    },
    enabled: !!clusterId && !!indexName,
  });

  // Initialize settings editor when data is loaded
  useEffect(() => {
    if (currentSettings) {
      setSettings(JSON.stringify(currentSettings, null, 2));
      setIsModified(false);
    }
  }, [currentSettings]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      // Validate settings JSON
      const validation = validateJSON(settings);
      if (validation) {
        setSettingsError(validation);
        throw new Error(`Invalid settings JSON: ${validation}`);
      }

      const parsedSettings = JSON.parse(settings);

      // Update settings via API
      await apiClient.proxyRequest(
        clusterId,
        'PUT',
        `/${indexName}/_settings`,
        parsedSettings
      );
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['cluster', clusterId, 'index', indexName, 'settings'],
      });
      queryClient.invalidateQueries({
        queryKey: ['cluster', clusterId, 'indices'],
      });

      // Show success notification
      notifications.show({
        title: 'Success',
        message: `Settings for index "${indexName}" updated successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      setIsModified(false);
    },
    onError: (error: Error) => {
      // Show error notification
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update settings',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    },
  });

  const handleSettingsChange = (value: string | undefined) => {
    setSettings(value || '');
    setSettingsError(null);
    setIsModified(true);
  };

  const handleSubmit = () => {
    setSettingsError(null);
    updateMutation.mutate();
  };

  const handleReset = () => {
    if (currentSettings) {
      setSettings(JSON.stringify(currentSettings, null, 2));
      setSettingsError(null);
      setIsModified(false);
    }
  };

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
      <Container size="xl">
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load index settings: {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={1}>Index Settings</Title>
          <Text size="sm" c="dimmed">
            {indexName}
          </Text>
        </div>
        <Button
          variant="default"
          onClick={() => navigate(`/cluster/${clusterId}?tab=indices`)}
        >
          Back to Indices
        </Button>
      </Group>

      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" title="Settings Information">
          <Text size="sm">
            <strong>Dynamic settings</strong> can be updated on an open index (e.g., number_of_replicas, refresh_interval).
            <br />
            <strong>Static settings</strong> can only be set at index creation or on a closed index (e.g., number_of_shards, codec).
            <br />
            To update static settings, you must first close the index, update the settings, then reopen it.
          </Text>
        </Alert>

        <Card shadow="sm" padding="lg">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb="xs">
                Index Settings (JSON)
              </Text>
              <Text size="xs" c="dimmed" mb="sm">
                Edit the settings below and click "Update Settings" to apply changes
              </Text>
              <div style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
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
              </div>
              {settingsError && (
                <Text size="sm" c="red" mt="xs">
                  {settingsError}
                </Text>
              )}
            </div>

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
                {updateMutation.isPending ? 'Updating...' : 'Update Settings'}
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
