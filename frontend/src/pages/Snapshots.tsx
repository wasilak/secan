import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Table,
  Loader,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActionIcon,
  Badge,
  ScrollArea,
  Progress,
  MultiSelect,
} from '@mantine/core';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconRestore,
  IconArrowLeft,
  IconClock,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type {
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
  SnapshotInfo,
  SnapshotState,
} from '../types/api';

/**
 * Snapshots component displays and manages snapshots in a repository
 * 
 * Features:
 * - Display snapshots in repository
 * - Create new snapshots
 * - Support index selection
 * - Support partial snapshots
 * - Display snapshot progress
 * - Delete snapshots
 * - Restore snapshots with options
 * - Show snapshot metadata
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10
 */
export function Snapshots() {
  const { id, repository } = useParams<{ id: string; repository: string }>();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotInfo | null>(null);

  // Fetch snapshots
  const {
    data: snapshots,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster', id, 'snapshots', repository],
    queryFn: () => apiClient.getSnapshots(id!, repository!),
    enabled: !!id && !!repository,
    refetchInterval: (query) => {
      // Refetch every 5 seconds if any snapshot is in progress
      const data = query.state.data;
      const hasInProgress = data?.some((s: SnapshotInfo) => s.state === 'IN_PROGRESS');
      return hasInProgress ? 5000 : false;
    },
  });

  // Fetch indices for snapshot creation
  const { data: indices } = useQuery({
    queryKey: ['cluster', id, 'indices'],
    queryFn: () => apiClient.getIndices(id!),
    enabled: !!id,
  });

  // Delete snapshot mutation
  const deleteMutation = useMutation({
    mutationFn: (snapshot: string) => apiClient.deleteSnapshot(id!, repository!, snapshot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'snapshots', repository] });
      notifications.show({
        title: 'Success',
        message: 'Snapshot deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete snapshot: ${error.message}`,
        color: 'red',
      });
    },
  });

  if (!id || !repository) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID and repository name are required
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
          Failed to load snapshots: {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  const getStateColor = (state: SnapshotState) => {
    switch (state) {
      case 'SUCCESS':
        return 'green';
      case 'IN_PROGRESS':
        return 'blue';
      case 'FAILED':
        return 'red';
      case 'PARTIAL':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getStateIcon = (state: SnapshotState) => {
    switch (state) {
      case 'SUCCESS':
        return <IconCheck size={16} />;
      case 'IN_PROGRESS':
        return <IconClock size={16} />;
      case 'FAILED':
        return <IconX size={16} />;
      case 'PARTIAL':
        return <IconAlertCircle size={16} />;
      default:
        return null;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Group gap="xs" mb="xs">
            <Button
              component={Link}
              to={`/cluster/${id}/repositories`}
              variant="subtle"
              size="xs"
              leftSection={<IconArrowLeft size={16} />}
            >
              Back to Repositories
            </Button>
          </Group>
          <Title order={2}>Snapshots in {repository}</Title>
          <Text size="sm" c="dimmed">
            Manage snapshots for backup and restore operations
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create Snapshot
        </Button>
      </Group>

      <Card shadow="sm" padding="lg">
        {!snapshots || snapshots.length === 0 ? (
          <Stack gap="md" align="center" py="xl">
            <Text c="dimmed">No snapshots found in this repository</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Snapshot
            </Button>
          </Stack>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Snapshot</Table.Th>
                  <Table.Th>State</Table.Th>
                  <Table.Th>Indices</Table.Th>
                  <Table.Th>Shards</Table.Th>
                  <Table.Th>Start Time</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {snapshots.map((snapshot) => (
                  <Table.Tr key={snapshot.snapshot}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{snapshot.snapshot}</Text>
                      <Text size="xs" c="dimmed">{snapshot.uuid}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={getStateColor(snapshot.state)}
                        leftSection={getStateIcon(snapshot.state)}
                      >
                        {snapshot.state}
                      </Badge>
                      {snapshot.state === 'IN_PROGRESS' && snapshot.shards && (
                        <Progress
                          value={(snapshot.shards.successful / snapshot.shards.total) * 100}
                          size="xs"
                          mt="xs"
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{snapshot.indices.length} indices</Text>
                    </Table.Td>
                    <Table.Td>
                      {snapshot.shards ? (
                        <Text size="sm">
                          {snapshot.shards.successful}/{snapshot.shards.total}
                          {snapshot.shards.failed > 0 && (
                            <Text component="span" c="red"> ({snapshot.shards.failed} failed)</Text>
                          )}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">N/A</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(snapshot.startTime).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDuration(snapshot.durationInMillis)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconRestore size={14} />}
                          onClick={() => {
                            setSelectedSnapshot(snapshot);
                            setRestoreModalOpen(true);
                          }}
                          disabled={snapshot.state !== 'SUCCESS' && snapshot.state !== 'PARTIAL'}
                        >
                          Restore
                        </Button>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => {
                            if (confirm(`Delete snapshot "${snapshot.snapshot}"?`)) {
                              deleteMutation.mutate(snapshot.snapshot);
                            }
                          }}
                          loading={deleteMutation.isPending}
                          disabled={snapshot.state === 'IN_PROGRESS'}
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

      <CreateSnapshotModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clusterId={id}
        repository={repository}
        availableIndices={indices?.map((i) => i.name) || []}
      />

      {selectedSnapshot && (
        <RestoreSnapshotModal
          opened={restoreModalOpen}
          onClose={() => {
            setRestoreModalOpen(false);
            setSelectedSnapshot(null);
          }}
          clusterId={id}
          repository={repository}
          snapshot={selectedSnapshot}
        />
      )}
    </Container>
  );
}

/**
 * CreateSnapshotModal component for creating new snapshots
 * 
 * Requirements: 18.2, 18.3, 18.4, 18.5
 */
interface CreateSnapshotModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
  repository: string;
  availableIndices: string[];
}

function CreateSnapshotModal({
  opened,
  onClose,
  clusterId,
  repository,
  availableIndices,
}: CreateSnapshotModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateSnapshotRequest>({
    initialValues: {
      snapshot: '',
      indices: [],
      ignoreUnavailable: false,
      includeGlobalState: true,
      partial: false,
    },
    validate: {
      snapshot: (value: string) => {
        if (!value) return 'Snapshot name is required';
        if (value.startsWith('_') || value.startsWith('-') || value.startsWith('+')) {
          return 'Snapshot name cannot start with _, -, or +';
        }
        return null;
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateSnapshotRequest) =>
      apiClient.createSnapshot(clusterId, repository, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'snapshots', repository] });
      notifications.show({
        title: 'Success',
        message: 'Snapshot creation started',
        color: 'green',
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to create snapshot: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    createMutation.mutate(values);
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create Snapshot" size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Snapshot Name"
            placeholder="snapshot-2024-01-01"
            required
            {...form.getInputProps('snapshot')}
          />

          <MultiSelect
            label="Indices"
            description="Select specific indices to snapshot (leave empty for all indices)"
            placeholder="Select indices"
            data={availableIndices}
            searchable
            clearable
            {...form.getInputProps('indices')}
          />

          <Switch
            label="Ignore Unavailable Indices"
            description="Continue snapshot even if some indices are unavailable"
            {...form.getInputProps('ignoreUnavailable', { type: 'checkbox' })}
          />

          <Switch
            label="Include Global State"
            description="Include cluster global state in the snapshot"
            {...form.getInputProps('includeGlobalState', { type: 'checkbox' })}
          />

          <Switch
            label="Allow Partial Snapshot"
            description="Allow snapshot to succeed even if some shards fail"
            {...form.getInputProps('partial', { type: 'checkbox' })}
          />

          <Alert color="blue" title="Snapshot Information">
            <Text size="sm">
              Snapshots are incremental and only store data that has changed since the last snapshot.
              The snapshot process runs in the background and does not block indexing or search operations.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Snapshot
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/**
 * RestoreSnapshotModal component for restoring snapshots
 * 
 * Requirements: 18.8, 18.9
 */
interface RestoreSnapshotModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
  repository: string;
  snapshot: SnapshotInfo;
}

function RestoreSnapshotModal({
  opened,
  onClose,
  clusterId,
  repository,
  snapshot,
}: RestoreSnapshotModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<RestoreSnapshotRequest>({
    initialValues: {
      indices: [],
      ignoreUnavailable: false,
      includeGlobalState: false,
      renamePattern: '',
      renameReplacement: '',
      includeAliases: true,
      partial: false,
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (request: RestoreSnapshotRequest) =>
      apiClient.restoreSnapshot(clusterId, repository, snapshot.snapshot, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'indices'] });
      notifications.show({
        title: 'Success',
        message: 'Snapshot restore started',
        color: 'green',
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to restore snapshot: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    restoreMutation.mutate(values);
  });

  return (
    <Modal opened={opened} onClose={onClose} title={`Restore Snapshot: ${snapshot.snapshot}`} size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Alert color="blue" title="Snapshot Contents">
            <Text size="sm">
              This snapshot contains {snapshot.indices.length} indices: {snapshot.indices.join(', ')}
            </Text>
          </Alert>

          <MultiSelect
            label="Indices to Restore"
            description="Select specific indices to restore (leave empty to restore all)"
            placeholder="Select indices"
            data={snapshot.indices}
            searchable
            clearable
            {...form.getInputProps('indices')}
          />

          <TextInput
            label="Rename Pattern (Regex)"
            placeholder="(.+)"
            description="Regular expression pattern to match index names"
            {...form.getInputProps('renamePattern')}
          />

          <TextInput
            label="Rename Replacement"
            placeholder="restored-$1"
            description="Replacement pattern for renamed indices (use $1, $2 for capture groups)"
            {...form.getInputProps('renameReplacement')}
          />

          <Switch
            label="Ignore Unavailable Indices"
            description="Continue restore even if some indices are unavailable"
            {...form.getInputProps('ignoreUnavailable', { type: 'checkbox' })}
          />

          <Switch
            label="Include Global State"
            description="Restore cluster global state from the snapshot"
            {...form.getInputProps('includeGlobalState', { type: 'checkbox' })}
          />

          <Switch
            label="Include Aliases"
            description="Restore index aliases from the snapshot"
            {...form.getInputProps('includeAliases', { type: 'checkbox' })}
          />

          <Switch
            label="Allow Partial Restore"
            description="Allow restore to succeed even if some shards fail"
            {...form.getInputProps('partial', { type: 'checkbox' })}
          />

          <Alert color="yellow" title="Warning">
            <Text size="sm">
              Restoring a snapshot will close and reopen the target indices. Ensure you understand the
              implications before proceeding. Use rename pattern to avoid conflicts with existing indices.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={restoreMutation.isPending} color="orange">
              Restore Snapshot
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
