import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
  NumberInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconDots,
  IconFolderOpen,
  IconFolderOff,
  IconTrash,
  IconRefresh,
  IconBolt,
  IconEraser,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useScreenReader } from '../lib/accessibility';
import type { IndexInfo } from '../types/api';

interface IndexOperationsProps {
  clusterId: string;
  index: IndexInfo;
}

/**
 * IndexOperations component provides action buttons for index operations
 *
 * Features:
 * - Open/close index
 * - Delete index with confirmation
 * - Force merge with segment configuration
 * - Clear cache
 * - Refresh index
 * - Flush index
 * - Progress notifications
 * - Error handling
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export function IndexOperations({ clusterId, index }: IndexOperationsProps) {
  const queryClient = useQueryClient();
  const { announceSuccess, announceError } = useScreenReader();
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [forceMergeModalOpened, { open: openForceMergeModal, close: closeForceMergeModal }] =
    useDisclosure(false);
  const [confirmText, setConfirmText] = useState('');
  const [maxSegments, setMaxSegments] = useState<number | string>(1);

  // Open index mutation
  const openIndexMutation = useMutation({
    mutationFn: () => apiClient.openIndex(clusterId, index.name),
    onMutate: () => {
      notifications.show({
        id: `open-${index.name}`,
        title: 'Opening index',
        message: `Opening index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `open-${index.name}`,
        title: 'Success',
        message: `Index ${index.name} opened successfully`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
      announceSuccess(`Index ${index.name} opened successfully`);
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'indices'] });
    },
    onError: (error: Error) => {
      notifications.update({
        id: `open-${index.name}`,
        title: 'Error',
        message: `Failed to open index: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
      announceError(`Failed to open index: ${error.message}`);
    },
  });

  // Close index mutation
  const closeIndexMutation = useMutation({
    mutationFn: () => apiClient.closeIndex(clusterId, index.name),
    onMutate: () => {
      notifications.show({
        id: `close-${index.name}`,
        title: 'Closing index',
        message: `Closing index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `close-${index.name}`,
        title: 'Success',
        message: `Index ${index.name} closed successfully`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'indices'] });
    },
    onError: (error: Error) => {
      notifications.update({
        id: `close-${index.name}`,
        title: 'Error',
        message: `Failed to close index: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });

  // Delete index mutation
  const deleteIndexMutation = useMutation({
    mutationFn: () => apiClient.deleteIndex(clusterId, index.name),
    onMutate: () => {
      notifications.show({
        id: `delete-${index.name}`,
        title: 'Deleting index',
        message: `Deleting index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `delete-${index.name}`,
        title: 'Success',
        message: `Index ${index.name} deleted successfully`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'indices'] });
      closeDeleteModal();
      setConfirmText('');
    },
    onError: (error: Error) => {
      notifications.update({
        id: `delete-${index.name}`,
        title: 'Error',
        message: `Failed to delete index: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });

  // Force merge mutation
  const forceMergeMutation = useMutation({
    mutationFn: (segments: number) => apiClient.forceMergeIndex(clusterId, index.name, segments),
    onMutate: () => {
      notifications.show({
        id: `forcemerge-${index.name}`,
        title: 'Force merging index',
        message: `Force merging index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `forcemerge-${index.name}`,
        title: 'Success',
        message: `Index ${index.name} force merged successfully`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
      closeForceMergeModal();
      setMaxSegments(1);
    },
    onError: (error: Error) => {
      notifications.update({
        id: `forcemerge-${index.name}`,
        title: 'Error',
        message: `Failed to force merge index: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: () => apiClient.clearCacheIndex(clusterId, index.name),
    onMutate: () => {
      notifications.show({
        id: `clearcache-${index.name}`,
        title: 'Clearing cache',
        message: `Clearing cache for index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `clearcache-${index.name}`,
        title: 'Success',
        message: `Cache cleared for index ${index.name}`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
    },
    onError: (error: Error) => {
      notifications.update({
        id: `clearcache-${index.name}`,
        title: 'Error',
        message: `Failed to clear cache: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: () => apiClient.refreshIndex(clusterId, index.name),
    onMutate: () => {
      notifications.show({
        id: `refresh-${index.name}`,
        title: 'Refreshing index',
        message: `Refreshing index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `refresh-${index.name}`,
        title: 'Success',
        message: `Index ${index.name} refreshed successfully`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
    },
    onError: (error: Error) => {
      notifications.update({
        id: `refresh-${index.name}`,
        title: 'Error',
        message: `Failed to refresh index: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });

  // Flush mutation
  const flushMutation = useMutation({
    mutationFn: () => apiClient.flushIndex(clusterId, index.name),
    onMutate: () => {
      notifications.show({
        id: `flush-${index.name}`,
        title: 'Flushing index',
        message: `Flushing index ${index.name}...`,
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: () => {
      notifications.update({
        id: `flush-${index.name}`,
        title: 'Success',
        message: `Index ${index.name} flushed successfully`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
    },
    onError: (error: Error) => {
      notifications.update({
        id: `flush-${index.name}`,
        title: 'Error',
        message: `Failed to flush index: ${error.message}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });

  const handleDelete = () => {
    if (confirmText === index.name) {
      deleteIndexMutation.mutate();
    }
  };

  const handleForceMerge = () => {
    const segments = typeof maxSegments === 'number' ? maxSegments : parseInt(maxSegments, 10);
    if (!isNaN(segments) && segments > 0) {
      forceMergeMutation.mutate(segments);
    }
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Tooltip label="Index operations">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Operations for index ${index.name}`}
            >
              <IconDots size={16} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Index Operations</Menu.Label>

          {index.status === 'close' ? (
            <Menu.Item
              leftSection={<IconFolderOpen size={14} aria-hidden="true" />}
              onClick={() => openIndexMutation.mutate()}
              disabled={openIndexMutation.isPending}
            >
              Open Index
            </Menu.Item>
          ) : (
            <Menu.Item
              leftSection={<IconFolderOff size={14} aria-hidden="true" />}
              onClick={() => closeIndexMutation.mutate()}
              disabled={closeIndexMutation.isPending}
            >
              Close Index
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={<IconRefresh size={14} aria-hidden="true" />}
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            Refresh
          </Menu.Item>

          <Menu.Item
            leftSection={<IconDeviceFloppy size={14} aria-hidden="true" />}
            onClick={() => flushMutation.mutate()}
            disabled={flushMutation.isPending}
          >
            Flush
          </Menu.Item>

          <Menu.Item
            leftSection={<IconEraser size={14} aria-hidden="true" />}
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
          >
            Clear Cache
          </Menu.Item>

          <Menu.Item
            leftSection={<IconBolt size={14} aria-hidden="true" />}
            onClick={openForceMergeModal}
          >
            Force Merge
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconTrash size={14} aria-hidden="true" />}
            color="red"
            onClick={openDeleteModal}
          >
            Delete Index
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setConfirmText('');
        }}
        title="Delete Index"
        centered
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
      >
        <Stack gap="md">
          <Text size="sm" id="delete-modal-description">
            Are you sure you want to delete index{' '}
            <Text span fw={700}>
              {index.name}
            </Text>
            ? This action cannot be undone.
          </Text>
          <Text size="sm" c="dimmed">
            Type the index name to confirm:
          </Text>
          <TextInput
            placeholder={index.name}
            value={confirmText}
            onChange={(e) => setConfirmText(e.currentTarget.value)}
            data-autofocus
            aria-label="Confirm index name"
            aria-required="true"
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                closeDeleteModal();
                setConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              disabled={confirmText !== index.name || deleteIndexMutation.isPending}
              loading={deleteIndexMutation.isPending}
              aria-label={`Delete index ${index.name}`}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Force merge modal */}
      <Modal
        opened={forceMergeModalOpened}
        onClose={() => {
          closeForceMergeModal();
          setMaxSegments(1);
        }}
        title="Force Merge Index"
        centered
        aria-labelledby="forcemerge-modal-title"
        aria-describedby="forcemerge-modal-description"
      >
        <Stack gap="md">
          <Text size="sm" id="forcemerge-modal-description">
            Force merge index{' '}
            <Text span fw={700}>
              {index.name}
            </Text>{' '}
            to reduce the number of segments.
          </Text>
          <NumberInput
            label="Maximum number of segments"
            description="The number of segments to merge to. Set to 1 for a single segment."
            placeholder="1"
            value={maxSegments}
            onChange={setMaxSegments}
            min={1}
            max={100}
            aria-label="Maximum number of segments"
            aria-required="true"
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                closeForceMergeModal();
                setMaxSegments(1);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleForceMerge}
              disabled={forceMergeMutation.isPending}
              loading={forceMergeMutation.isPending}
              aria-label={`Force merge index ${index.name}`}
            >
              Force Merge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
