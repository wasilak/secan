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
 * Requirements: 8.3
 */
function validateJSON(json: string): string | null {
  if (!json.trim()) {
    return 'Mappings cannot be empty';
  }

  try {
    JSON.parse(json);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * IndexMappings component displays and allows editing of index mappings
 * 
 * Features:
 * - Fetch and display current mappings as JSON
 * - JSON editor for adding/modifying fields with syntax highlighting
 * - JSON validation before submission
 * - Informational notes about mapping restrictions
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8
 */
export function IndexMappings() {
  const { id: clusterId, indexName } = useParams<{ id: string; indexName: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();

  const [mappings, setMappings] = useState('');
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);

  // Fetch current index mappings
  const {
    data: currentMappings,
    isLoading,
    error,
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

      return response;
    },
    enabled: !!clusterId && !!indexName,
  });

  // Initialize mappings editor when data is loaded
  useEffect(() => {
    if (currentMappings) {
      setMappings(JSON.stringify(currentMappings, null, 2));
      setIsModified(false);
    }
  }, [currentMappings]);

  // Update mappings mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      // Validate mappings JSON
      const validation = validateJSON(mappings);
      if (validation) {
        setMappingsError(validation);
        throw new Error(`Invalid mappings JSON: ${validation}`);
      }

      const parsedMappings = JSON.parse(mappings);

      // Update mappings via API
      await apiClient.proxyRequest(
        clusterId,
        'PUT',
        `/${indexName}/_mapping`,
        parsedMappings
      );
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['cluster', clusterId, 'index', indexName, 'mappings'],
      });
      queryClient.invalidateQueries({
        queryKey: ['cluster', clusterId, 'indices'],
      });

      // Show success notification
      notifications.show({
        title: 'Success',
        message: `Mappings for index "${indexName}" updated successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      setIsModified(false);
    },
    onError: (error: Error) => {
      // Show error notification
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update mappings',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    },
  });

  const handleMappingsChange = (value: string | undefined) => {
    setMappings(value || '');
    setMappingsError(null);
    setIsModified(true);
  };

  const handleSubmit = () => {
    setMappingsError(null);
    updateMutation.mutate();
  };

  const handleReset = () => {
    if (currentMappings) {
      setMappings(JSON.stringify(currentMappings, null, 2));
      setMappingsError(null);
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
          Failed to load index mappings: {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={1}>Index Mappings</Title>
          <Text size="sm" c="dimmed">
            {indexName}
          </Text>
        </div>
        <Button
          variant="default"
          onClick={() => navigate(`/cluster/${clusterId}/indices`)}
        >
          Back to Indices
        </Button>
      </Group>

      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Mapping Restrictions">
          <Text size="sm">
            <strong>Important:</strong> Existing field mappings cannot be changed or deleted.
            <br />
            • You can only <strong>add new fields</strong> to the mappings
            <br />
            • Field types cannot be changed once set (e.g., cannot change from "text" to "keyword")
            <br />
            • Fields cannot be removed from mappings
            <br />
            • To change field types, you must reindex your data into a new index with the correct mappings
          </Text>
        </Alert>

        <Card shadow="sm" padding="lg">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb="xs">
                Index Mappings (JSON)
              </Text>
              <Text size="xs" c="dimmed" mb="sm">
                Add new fields to the mappings below and click "Update Mappings" to apply changes
              </Text>
              <div style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
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
              </div>
              {mappingsError && (
                <Text size="sm" c="red" mt="xs">
                  {mappingsError}
                </Text>
              )}
            </div>

            <Alert color="blue" title="Common Field Types">
              <Text size="sm">
                • <strong>text</strong>: Full-text searchable fields (analyzed)
                <br />
                • <strong>keyword</strong>: Exact-value fields (not analyzed, used for filtering, sorting, aggregations)
                <br />
                • <strong>integer, long, short, byte</strong>: Numeric integer types
                <br />
                • <strong>float, double</strong>: Floating-point numeric types
                <br />
                • <strong>boolean</strong>: True/false values
                <br />
                • <strong>date</strong>: Date/time values
                <br />
                • <strong>object</strong>: JSON objects (nested fields)
                <br />• <strong>nested</strong>: Array of objects with independent querying
              </Text>
            </Alert>

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
                {updateMutation.isPending ? 'Updating...' : 'Update Mappings'}
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
