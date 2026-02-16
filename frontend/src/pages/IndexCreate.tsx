import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Button,
  TextInput,
  Stack,
  Group,
  Tabs,
  Alert,
  Box,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Editor from '@monaco-editor/react';
import { apiClient } from '../api/client';
import { useTheme } from '../hooks/useTheme';

/**
 * Validate index name format
 * 
 * Elasticsearch index name rules:
 * - Lowercase only
 * - Cannot include \, /, *, ?, ", <, >, |, ` ` (space), ,, #
 * - Cannot start with -, _, +
 * - Cannot be . or ..
 * - Cannot be longer than 255 bytes
 * 
 * Requirements: 6.2
 */
function validateIndexName(name: string): string | null {
  if (!name) {
    return 'Index name is required';
  }

  if (name === '.' || name === '..') {
    return 'Index name cannot be "." or ".."';
  }

  if (name.startsWith('-') || name.startsWith('_') || name.startsWith('+')) {
    return 'Index name cannot start with -, _, or +';
  }

  if (name !== name.toLowerCase()) {
    return 'Index name must be lowercase';
  }

  const invalidChars = ['\\', '/', '*', '?', '"', '<', '>', '|', ' ', ',', '#'];
  for (const char of invalidChars) {
    if (name.includes(char)) {
      return `Index name cannot contain "${char}"`;
    }
  }

  if (new Blob([name]).size > 255) {
    return 'Index name cannot be longer than 255 bytes';
  }

  return null;
}

/**
 * Validate JSON string
 * 
 * Requirements: 6.5
 */
function validateJSON(json: string): string | null {
  if (!json.trim()) {
    return null; // Empty is valid (will use defaults)
  }

  try {
    JSON.parse(json);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * IndexCreate component provides a form to create new indices
 * 
 * Features:
 * - Name field with validation
 * - JSON editors for settings and mappings with syntax highlighting
 * - JSON validation before submission
 * - Tabbed interface for organization
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.8
 */
export function IndexCreate() {
  const { id: clusterId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();

  const [indexName, setIndexName] = useState('');
  const [settings, setSettings] = useState('{\n  "number_of_shards": 1,\n  "number_of_replicas": 1\n}');
  const [mappings, setMappings] = useState('{\n  "properties": {\n    \n  }\n}');
  const [activeTab, setActiveTab] = useState<string | null>('basic');

  // Validation states
  const [nameError, setNameError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [mappingsError, setMappingsError] = useState<string | null>(null);

  // Create index mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clusterId) {
        throw new Error('Cluster ID is required');
      }

      // Validate index name
      const nameValidation = validateIndexName(indexName);
      if (nameValidation) {
        setNameError(nameValidation);
        throw new Error(nameValidation);
      }

      // Validate settings JSON
      const settingsValidation = validateJSON(settings);
      if (settingsValidation) {
        setSettingsError(settingsValidation);
        throw new Error(`Invalid settings JSON: ${settingsValidation}`);
      }

      // Validate mappings JSON
      const mappingsValidation = validateJSON(mappings);
      if (mappingsValidation) {
        setMappingsError(mappingsValidation);
        throw new Error(`Invalid mappings JSON: ${mappingsValidation}`);
      }

      // Build request body
      const body: Record<string, unknown> = {};

      if (settings.trim()) {
        body.settings = JSON.parse(settings);
      }

      if (mappings.trim()) {
        body.mappings = JSON.parse(mappings);
      }

      // Create index via API
      await apiClient.proxyRequest(
        clusterId,
        'PUT',
        `/${indexName}`,
        body
      );
    },
    onSuccess: () => {
      // Invalidate indices query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'indices'] });

      // Show success notification
      notifications.show({
        title: 'Success',
        message: `Index "${indexName}" created successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Navigate to the new index edit page
      navigate(`/cluster/${clusterId}/indices/${indexName}/edit`);
    },
    onError: (error: Error) => {
      // Show error notification
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create index',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    },
  });

  const handleSubmit = () => {
    // Clear previous errors
    setNameError(null);
    setSettingsError(null);
    setMappingsError(null);

    // Trigger mutation
    createMutation.mutate();
  };

  const handleNameChange = (value: string) => {
    setIndexName(value);
    setNameError(null);
  };

  const handleSettingsChange = (value: string | undefined) => {
    setSettings(value || '');
    setSettingsError(null);
  };

  const handleMappingsChange = (value: string | undefined) => {
    setMappings(value || '');
    setMappingsError(null);
  };

  if (!clusterId) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={1}>Create Index</Title>
          <Text size="sm" c="dimmed">
            Create a new index with custom settings and mappings
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="basic">Basic</Tabs.Tab>
            <Tabs.Tab value="settings">Settings</Tabs.Tab>
            <Tabs.Tab value="mappings">Mappings</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="basic" pt="md">
            <Stack gap="md">
              <TextInput
                label="Index Name"
                placeholder="my-index"
                description="Lowercase only, cannot contain special characters"
                value={indexName}
                onChange={(e) => handleNameChange(e.currentTarget.value)}
                error={nameError}
                required
              />

              <Alert color="blue" title="Index Naming Rules">
                <Text size="sm">
                  • Must be lowercase
                  <br />
                  • Cannot contain: \ / * ? " &lt; &gt; | (space) , #
                  <br />
                  • Cannot start with: - _ +
                  <br />
                  • Cannot be "." or ".."
                  <br />• Maximum 255 bytes
                </Text>
              </Alert>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="md">
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Index Settings (JSON)
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Configure index settings such as number of shards and replicas
                </Text>
                <Box style={{ border: '1px solid var(--mantine-color-gray-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                  <Editor
                    height="300px"
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
              </div>

              <Alert color="blue" title="Settings Information">
                <Text size="sm">
                  Settings define index behavior such as:
                  <br />
                  • number_of_shards: Number of primary shards (cannot be changed after creation)
                  <br />
                  • number_of_replicas: Number of replica shards (can be changed later)
                  <br />• analysis: Custom analyzers, tokenizers, and filters
                </Text>
              </Alert>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="mappings" pt="md">
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Index Mappings (JSON)
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Define field types and properties for your documents
                </Text>
                <Box style={{ border: '1px solid var(--mantine-color-gray-4)', borderRadius: 'var(--mantine-radius-sm)' }}>
                  <Editor
                    height="300px"
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
              </div>

              <Alert color="blue" title="Mappings Information">
                <Text size="sm">
                  Mappings define how documents and their fields are stored and indexed:
                  <br />
                  • Field types: text, keyword, integer, date, boolean, etc.
                  <br />
                  • Field properties: analyzer, index, store, etc.
                  <br />• Note: Field types cannot be changed after creation
                </Text>
              </Alert>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="xl">
          <Button
            variant="default"
            onClick={() => navigate(`/cluster/${clusterId}/indices`)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!indexName.trim()}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Index'}
          </Button>
        </Group>
      </Card>
    </FullWidthContainer>
  );
}
