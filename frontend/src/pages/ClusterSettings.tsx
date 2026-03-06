import { useState, useEffect } from 'react';
import { Title, Text, Card, Group, Stack, Button, Alert, Tabs, Badge, Box } from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconDeviceFloppy, IconX } from '@tabler/icons-react';
import { Editor } from '@monaco-editor/react';
import { apiClient } from '../api/client';
import type { UpdateClusterSettingsRequest } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { SettingsPageSkeleton } from '../components/LoadingSkeleton';

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
  const [persistentModified, setPersistentModified] = useState(false);
  const [transientModified, setTransientModified] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch cluster settings (don't refetch when showDefaults changes, only fetch defaults once)
  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: () => apiClient.getClusterSettings(id!, true), // Always fetch defaults for flexibility
    enabled: !!id,
  });

  // Initialize editor values when settings load (only once)
  useEffect(() => {
    if (settings?.persistent !== undefined || settings?.transient !== undefined) {
      setPersistentSettings(JSON.stringify(settings?.persistent || {}, null, 2));
      setTransientSettings(JSON.stringify(settings?.transient || {}, null, 2));
      setPersistentModified(false);
      setTransientModified(false);
    }
  }, [settings?.persistent, settings?.transient]);

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
      setPersistentModified(false);
      setTransientModified(false);
      setSaveError(null);
    },
    onError: (error: Error) => {
      const errorMsg = `Failed to update cluster settings: ${error.message}`;
      setSaveError(errorMsg);
      notifications.show({
        title: 'Error',
        message: errorMsg,
        color: 'red',
      });
    },
  });

  const handlePersistentChange = (value: string | undefined) => {
    setPersistentSettings(value || '');
    setSaveError(null);
    setPersistentModified(true);
  };

  const handleTransientChange = (value: string | undefined) => {
    setTransientSettings(value || '');
    setSaveError(null);
    setTransientModified(true);
  };

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

  const handleReset = () => {
    if (settings) {
      setPersistentSettings(JSON.stringify(settings?.persistent || {}, null, 2));
      setTransientSettings(JSON.stringify(settings?.transient || {}, null, 2));
      setPersistentModified(false);
      setTransientModified(false);
      setSaveError(null);
    }
  };

  if (!id) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </FullWidthContainer>
    );
  }

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (error) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load cluster settings: {(error as Error).message}
        </Alert>
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
            <strong>Persistent settings:</strong> Survive cluster restarts and apply across all
            nodes
          </Text>
          <Text size="sm">
            <strong>Transient settings:</strong> Do not survive cluster restarts
          </Text>
          <Text size="sm">Transient settings take precedence over persistent settings.</Text>
        </Stack>
      </Alert>

      {saveError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Save Failed"
          color="red"
          mb="md"
          withCloseButton
          onClose={() => setSaveError(null)}
        >
          <Text size="sm">{saveError}</Text>
        </Alert>
      )}

      <Card shadow="sm" padding="lg" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
            <Stack gap="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Persistent Settings (JSON)
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Edit the persistent settings below
                </Text>
                <Box
                  style={{
                    border: '1px solid var(--mantine-color-gray-4)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <Editor
                    height="500px"
                    defaultLanguage="json"
                    value={persistentSettings}
                    onChange={handlePersistentChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: 'on',
                    }}
                  />
                </Box>
              </Box>
              <Group justify="flex-end">
                <Button
                  variant="default"
                  onClick={handleReset}
                  disabled={!persistentModified || updateMutation.isPending}
                >
                  Reset
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSavePersistent}
                  loading={updateMutation.isPending}
                  disabled={!persistentModified || showDefaults}
                >
                  Save Persistent Settings
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="transient" pt="md">
            <Stack gap="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Transient Settings (JSON)
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Edit the transient settings below
                </Text>
                <Box
                  style={{
                    border: '1px solid var(--mantine-color-gray-4)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <Editor
                    height="500px"
                    defaultLanguage="json"
                    value={transientSettings}
                    onChange={handleTransientChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: 'on',
                    }}
                  />
                </Box>
              </Box>
              <Group justify="flex-end">
                <Button
                  variant="default"
                  onClick={handleReset}
                  disabled={!transientModified || updateMutation.isPending}
                >
                  Reset
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveTransient}
                  loading={updateMutation.isPending}
                  disabled={!transientModified || showDefaults}
                >
                  Save Transient Settings
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          {showDefaults && (
            <Tabs.Panel value="defaults" pt="md">
              <Card shadow="sm" padding="lg">
                <Box
                  style={{
                    border: '1px solid var(--mantine-color-gray-4)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <Editor
                    height="500px"
                    defaultLanguage="json"
                    value={JSON.stringify(settings?.defaults || {}, null, 2)}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: 'on',
                    }}
                  />
                </Box>
              </Card>
            </Tabs.Panel>
          )}
        </Tabs>
      </Card>
    </FullWidthContainer>
  );
}
