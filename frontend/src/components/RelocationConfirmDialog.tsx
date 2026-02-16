import React from 'react';
import { Modal, Text, Button, Group, Stack, Box, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { ShardInfo, NodeWithShards } from '../types/api';

/**
 * Props for RelocationConfirmDialog component
 */
interface RelocationConfirmDialogProps {
  shard: ShardInfo | null;
  sourceNode: NodeWithShards | null;
  destinationNode: NodeWithShards | null;
  opened: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * RelocationConfirmDialog component
 * 
 * Displays a confirmation dialog for shard relocation operations.
 * Shows source and destination node details, index and shard information,
 * and a warning about potential performance impact.
 * 
 * Requirements: 5.8, 5.9
 */
export function RelocationConfirmDialog({
  shard,
  sourceNode,
  destinationNode,
  opened,
  onClose,
  onConfirm,
}: RelocationConfirmDialogProps): JSX.Element {
  const [loading, setLoading] = React.useState(false);
  
  // Handle confirm button click
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Failed to relocate shard:', error);
      // Error handling will be done by the parent component
    } finally {
      setLoading(false);
    }
  };
  
  // Don't render if required data is missing
  if (!shard || !sourceNode || !destinationNode) {
    return <></>;
  }
  
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Confirm Shard Relocation"
      size="md"
      centered
    >
      <Stack gap="md">
        {/* Index and shard information */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Shard Details
          </Text>
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Index:</Text>
              <Text size="sm" fw={500}>{shard.index}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Shard:</Text>
              <Text size="sm" fw={500}>
                {shard.shard} ({shard.primary ? 'primary' : 'replica'})
              </Text>
            </Group>
          </Stack>
        </Box>
        
        {/* Source node information */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            From
          </Text>
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Node:</Text>
              <Text size="sm" fw={500}>{sourceNode.name}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">IP:</Text>
              <Text size="sm">{sourceNode.ip || 'N/A'}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">ID:</Text>
              <Text size="sm" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                {sourceNode.id}
              </Text>
            </Group>
          </Stack>
        </Box>
        
        {/* Destination node information */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            To
          </Text>
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Node:</Text>
              <Text size="sm" fw={500}>{destinationNode.name}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">IP:</Text>
              <Text size="sm">{destinationNode.ip || 'N/A'}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">ID:</Text>
              <Text size="sm" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                {destinationNode.id}
              </Text>
            </Group>
          </Stack>
        </Box>
        
        {/* Warning message - Requirements: 5.9 */}
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Warning"
          color="yellow"
        >
          <Text size="sm">
            Shard relocation may impact cluster performance during the move.
            The shard will be copied to the destination node and then removed
            from the source node.
          </Text>
        </Alert>
        
        {/* Action buttons */}
        <Group justify="flex-end" gap="sm" mt="md">
          <Button
            variant="default"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleConfirm}
            loading={loading}
          >
            Relocate Shard
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
