import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Loader,
  Alert,
  Tabs,
  Badge,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react';
import { Editor } from '@monaco-editor/react';
import { apiClient } from '../api/client';
import type { UpdateClusterSettingsRequest } from '../types/api';

/**
 * ClusterSettings component displays and manages cluster settings
 * 
 * Features:
 * - Display persistent and transient settings
 * - Distinguish visually between setting types
 * - JSON editor for modifications
 * - Show default settings
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.5, 13.6
 */
export function ClusterSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [persistentSettings, setPersistentSettings] = useState('');
  const [transientSettings, setTransientSettings] = useState('');
  const [showDefaults, setShowDefaults] = useState(false);

  // Fetch cluster settings
  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cluster', id, 'settings', showDefaults],
    queryFn: () => apiClient.getClusterSettings(id!, showDefaults),
    enabled: !!id,
  });

  // Initialize editor values when settings load
  useState(() => {
    if (settings) {
      setPersistentSettings(JSON.stringify(settings.persistent || {}, null, 2));
      setTransientSettings(JSON.stringify(settings.transient || {}, null, 2));
    }
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: (request: UpdateClusterSettingsRequest) =>
      apiClient.updateClusterSettings(id!, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Cluster settings updated successfully',
        color: 'green',
      });
      refetch();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to update cluster settings: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSavePersistent = () => {
    try {
      const parsed = JSON.parse(persistentSettings);
      updateMutation.mutate({ persistent: parsed });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Invalid JSON: ${(error as Error).message}`,
        color: 'red',
      });
    }
  };

  const handleSaveTransient = () => {
    try {
      const parsed = JSON.parse(transientSettings);
      updateMutation.mutate({ transient: parsed });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Invalid JSON: ${(error as Error).message}`,
        color: 'red',
      });
    }
  };

  if (!id) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
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
          Failed to load cluster settings: {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Cluster Settings</Title>
          <Text size="sm" c="dimmed">
            Configure cluster behavior and performance
          </Text>
        </div>
        <Button
          variant={showDefaults ? 'filled' : 'light'}
          onClick={() => setShowDefaults(!showDefaults)}
        >
          {showDefaults ? 'Hide' : 'Show'} Defaults
        </Button>
      </Group>

      <Alert icon={<IconAlertCircle size={16} />} title="Important" color="blue" mb="md">
        <Stack gap="xs">
          <Text size="sm">
            <strong>Persistent settings:</strong> Survive cluster restarts and apply across all nodes
          </Text>
          <Text size="sm">
            <strong>Transient settings:</strong> Do not survive cluster restarts
          </Text>
          <Text size="sm">
            Transient settings take precedence over persistent settings.
          </Text>
        </Stack>
      </Alert>

      <Card shadow="sm" padding="lg">
        <Tabs defaultValue="persistent">
          <Tabs.List>
            <Tabs.Tab value="persistent">
              <Group gap="xs">
                Persistent Settings
                <Badge size="sm" variant="light" color="blue">
                  Permanent
                </Badge>
              </Group>
            </Tabs.Tab>
            <Tabs.Tab value="transient">
              <Group gap="xs">
                Transient Settings
                <Badge size="sm" variant="light" color="orange">
                  Temporary
                </Badge>
              </Group>
            </Tabs.Tab>
            {showDefaults && (
              <Tabs.Tab value="defaults">
                <Group gap="xs">
                  Default Settings
                  <Badge size="sm" variant="light" color="gray">
                    Read-only
                  </Badge>
                </Group>
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="persistent" pt="md">
            <Stack gap="md">
              <Editor
                height="500px"
                defaultLanguage="json"
                value={persistentSettings}
                onChange={(value) => setPersistentSettings(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
              <Group justify="flex-end">
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSavePersistent}
                  loading={updateMutation.isPending}
                >
                  Save Persistent Settings
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="transient" pt="md">
            <Stack gap="md">
              <Editor
                height="500px"
                defaultLanguage="json"
                value={transientSettings}
                onChange={(value) => setTransientSettings(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
              <Group justify="flex-end">
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveTransient}
                  loading={updateMutation.isPending}
                >
                  Save Transient Settings
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          {showDefaults && (
            <Tabs.Panel value="defaults" pt="md">
              <Editor
                height="500px"
                defaultLanguage="json"
                value={JSON.stringify(settings?.defaults || {}, null, 2)}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  readOnly: true,
                }}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      </Card>
    </Container>
  );
}
