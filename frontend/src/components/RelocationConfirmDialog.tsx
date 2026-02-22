import React from 'react';
import { Modal, Text, Button, Group, Stack, Box, Alert } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle } from '@tabler/icons-react';
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
 * Validate relocation request before submission
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.7
 */
function validateRelocation(
  shard: ShardInfo | null,
  sourceNode: NodeWithShards | null,
  destinationNode: NodeWithShards | null
): string | null {
  if (!shard) {
    return 'No shard selected. Please select a shard to relocate.';
  }

  if (!sourceNode) {
    return 'Source node not found. Please try again.';
  }

  if (!destinationNode) {
    return 'Destination node not found. Please select a valid destination.';
  }

  // Validate source and destination are different
  if (sourceNode.id === destinationNode.id) {
    return `Source and destination nodes cannot be the same (${sourceNode.name}). Please select a different destination node.`;
  }

  // Validate shard state
  if (shard.state === 'UNASSIGNED') {
    return 'Cannot relocate an unassigned shard. Unassigned shards need allocation, not relocation.';
  }

  if (shard.state === 'RELOCATING') {
    return 'This shard is already being relocated. Please wait for the current relocation to complete.';
  }

  if (shard.state === 'INITIALIZING') {
    return 'Cannot relocate a shard that is still initializing. Please wait for initialization to complete.';
  }

  // Check if destination already has this shard
  const destShards = destinationNode.shards.get(shard.index) || [];
  const hasThisShard = destShards.some((s) => s.shard === shard.shard);
  if (hasThisShard) {
    return `Destination node ${destinationNode.name} already hosts shard ${shard.shard} of index ${shard.index}. Please select a different destination.`;
  }

  // Check if destination is a data node
  if (!destinationNode.roles.includes('data')) {
    return `Destination node ${destinationNode.name} is not a data node. Shards can only be relocated to data nodes.`;
  }

  return null;
}

/**
 * RelocationConfirmDialog component
 *
 * Displays a confirmation dialog for shard relocation operations.
 * Shows source and destination node details, index and shard information,
 * and a warning about potential performance impact.
 *
 * Requirements: 5.8, 5.9, 8.7
 */
export function RelocationConfirmDialog({
  shard,
  sourceNode,
  destinationNode,
  opened,
  onClose,
  onConfirm,
}: RelocationConfirmDialogProps): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Validate on mount and when props change
  React.useEffect(() => {
    if (opened) {
      const error = validateRelocation(shard, sourceNode, destinationNode);
      setValidationError(error);
    }
  }, [opened, shard, sourceNode, destinationNode]);

  // Handle confirm button click
  const handleConfirm = async () => {
    // Re-validate before confirming
    const error = validateRelocation(shard, sourceNode, destinationNode);
    if (error) {
      setValidationError(error);
      return;
    }

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
    <Modal opened={opened} onClose={onClose} title="Confirm Shard Relocation" size="md" centered>
      <Stack gap="md">
        {/* Validation error alert - Requirements: 8.7 */}
        {validationError && (
          <Alert icon={<IconAlertCircle size={16} />} title="Validation Error" color="red">
            <Text size="sm">{validationError}</Text>
          </Alert>
        )}

        {/* Index and shard information */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Shard Details
          </Text>
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Index:
              </Text>
              <Text size="sm" fw={500}>
                {shard.index}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Shard:
              </Text>
              <Text size="sm" fw={500}>
                {shard.shard} ({shard.primary ? 'primary' : 'replica'})
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                State:
              </Text>
              <Text size="sm" fw={500}>
                {shard.state}
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
              <Text size="sm" c="dimmed">
                Node:
              </Text>
              <Text size="sm" fw={500}>
                {sourceNode.name}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                IP:
              </Text>
              <Text size="sm">{sourceNode.ip || 'N/A'}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                ID:
              </Text>
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
              <Text size="sm" c="dimmed">
                Node:
              </Text>
              <Text size="sm" fw={500}>
                {destinationNode.name}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                IP:
              </Text>
              <Text size="sm">{destinationNode.ip || 'N/A'}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                ID:
              </Text>
              <Text size="sm" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                {destinationNode.id}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Roles:
              </Text>
              <Text size="sm">{destinationNode.roles.join(', ')}</Text>
            </Group>
          </Stack>
        </Box>

        {/* Warning message - Requirements: 5.9 */}
        {!validationError && (
          <Alert icon={<IconAlertTriangle size={16} />} title="Warning" color="yellow">
            <Text size="sm">
              Shard relocation may impact cluster performance during the move. The shard will be
              copied to the destination node and then removed from the source node.
            </Text>
          </Alert>
        )}

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleConfirm}
            loading={loading}
            disabled={!!validationError}
          >
            Relocate Shard
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
