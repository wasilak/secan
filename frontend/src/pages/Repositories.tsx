import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Table,
  Alert,
  Modal,
  TextInput,
  Select,
  Textarea,
  ActionIcon,
  Badge,
  ScrollArea,
  Code,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { ListPageSkeleton } from '../components/LoadingSkeleton';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconPlus, IconTrash, IconFolder } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { CreateRepositoryRequest, RepositoryType } from '../types/api';

/**
 * Repositories component displays and manages snapshot repositories
 *
 * Features:
 * - Display existing repositories
 * - Create new repositories (filesystem, S3, Azure, GCS, HDFS, URL)
 * - Delete repositories
 * - Show repository details
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11
 */
export function Repositories() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch repositories
  const {
    data: repositories,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster', id, 'repositories'],
    queryFn: () => apiClient.getRepositories(id!),
    enabled: !!id,
  });

  // Delete repository mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => apiClient.deleteRepository(id!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'repositories'] });
      notifications.show({
        title: 'Success',
        message: 'Repository deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete repository: ${error.message}`,
        color: 'red',
      });
    },
  });

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
    return <ListPageSkeleton rows={5} />;
  }

  if (error) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load repositories: {(error as Error).message}
        </Alert>
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Snapshot Repositories</Title>
          <Text size="sm" c="dimmed">
            Manage snapshot repositories for backup and restore operations
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          Create Repository
        </Button>
      </Group>

      <Card shadow="sm" padding="lg">
        {!repositories || repositories.length === 0 ? (
          <Stack gap="md" align="center" py="xl">
            <Text c="dimmed">No repositories found</Text>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
              Create Repository
            </Button>
          </Stack>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Settings</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {repositories.map((repo) => (
                  <Table.Tr key={repo.name}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconFolder size={16} />
                        <Text size="sm" fw={500}>
                          {repo.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">
                        {repo.type.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Code block>{JSON.stringify(repo.settings, null, 2)}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          component={Link}
                          to={`/cluster/${id}/snapshots/${repo.name}`}
                          size="xs"
                          variant="light"
                        >
                          View Snapshots
                        </Button>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete repository "${repo.name}"? This will not delete snapshots.`
                              )
                            ) {
                              deleteMutation.mutate(repo.name);
                            }
                          }}
                          loading={deleteMutation.isPending}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      <CreateRepositoryModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clusterId={id}
      />
    </FullWidthContainer>
  );
}

/**
 * CreateRepositoryModal component for creating new repositories
 *
 * Requirements: 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9
 */
interface CreateRepositoryModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
}

function CreateRepositoryModal({ opened, onClose, clusterId }: CreateRepositoryModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateRepositoryRequest & { settingsText: string }>({
    initialValues: {
      name: '',
      type: 'fs' as RepositoryType,
      settings: {},
      settingsText: '',
    },
    validate: {
      name: (value: string) => {
        if (!value) return 'Repository name is required';
        if (value.startsWith('_') || value.startsWith('-') || value.startsWith('+')) {
          return 'Repository name cannot start with _, -, or +';
        }
        return null;
      },
      settingsText: (value: string) => {
        if (!value) return 'Settings are required';
        try {
          JSON.parse(value);
          return null;
        } catch {
          return 'Invalid JSON format';
        }
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateRepositoryRequest) =>
      apiClient.createRepository(clusterId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'repositories'] });
      notifications.show({
        title: 'Success',
        message: 'Repository created successfully',
        color: 'green',
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to create repository: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    try {
      const settings = JSON.parse(values.settingsText);

      const request: CreateRepositoryRequest = {
        name: values.name,
        type: values.type,
        settings,
      };

      createMutation.mutate(request);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Invalid JSON: ${(error as Error).message}`,
        color: 'red',
      });
    }
  });

  // Update settings template when type changes
  const handleTypeChange = (value: string | null) => {
    if (!value) return;

    form.setFieldValue('type', value as RepositoryType);

    // Set default settings based on type
    let defaultSettings = {};
    switch (value) {
      case 'fs':
        defaultSettings = { location: '/mount/backups/my_backup' };
        break;
      case 's3':
        defaultSettings = {
          bucket: 'my-bucket',
          region: 'us-east-1',
          base_path: 'snapshots',
        };
        break;
      case 'azure':
        defaultSettings = {
          container: 'my-container',
          base_path: 'snapshots',
        };
        break;
      case 'gcs':
        defaultSettings = {
          bucket: 'my-bucket',
          base_path: 'snapshots',
        };
        break;
      case 'hdfs':
        defaultSettings = {
          uri: 'hdfs://namenode:8020',
          path: '/snapshots',
        };
        break;
      case 'url':
        defaultSettings = {
          url: 'http://example.com/snapshots',
        };
        break;
    }

    form.setFieldValue('settingsText', JSON.stringify(defaultSettings, null, 2));
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create Repository" size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Repository Name"
            placeholder="my-backup-repo"
            required
            {...form.getInputProps('name')}
          />

          <Select
            label="Repository Type"
            description="Select the storage backend for snapshots"
            required
            data={[
              { value: 'fs', label: 'Filesystem' },
              { value: 's3', label: 'Amazon S3' },
              { value: 'azure', label: 'Azure Blob Storage' },
              { value: 'gcs', label: 'Google Cloud Storage' },
              { value: 'hdfs', label: 'HDFS' },
              { value: 'url', label: 'URL (Read-only)' },
            ]}
            value={form.values.type}
            onChange={handleTypeChange}
          />

          <Textarea
            label="Settings (JSON)"
            description="Repository-specific configuration"
            placeholder='{"location": "/mount/backups/my_backup"}'
            required
            minRows={8}
            {...form.getInputProps('settingsText')}
          />

          <Alert color="blue" title="Repository Type Information">
            <Stack gap="xs">
              <Text size="sm">
                <strong>Filesystem:</strong> Requires shared filesystem accessible to all nodes
              </Text>
              <Text size="sm">
                <strong>S3/Azure/GCS:</strong> Requires appropriate credentials and permissions
              </Text>
              <Text size="sm">
                <strong>HDFS:</strong> Requires HDFS plugin installed
              </Text>
              <Text size="sm">
                <strong>URL:</strong> Read-only repository for accessing snapshots via HTTP/HTTPS
              </Text>
            </Stack>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Repository
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
