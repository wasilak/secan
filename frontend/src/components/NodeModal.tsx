import { Modal, Group, Text, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { MasterIndicator } from './MasterIndicator';
import { NodeDetailSkeleton } from './LoadingSkeleton';
import { NodeDetailContent } from './NodeDetailContent';
import type { NodeDetailStats } from '../types/api';

/**
 * Props for NodeModal component
 */
interface NodeModalProps {
  clusterId: string;
  nodeId: string | null;
  opened: boolean;
  onClose: () => void;
  context: 'topology' | 'nodes' | 'shards';
}

/**
 * NodeModal component displays detailed node information in a modal dialog.
 *
 * This modal can be opened from multiple contexts (topology view, nodes list, shards list)
 * and maintains URL synchronization for direct linking and sharing.
 *
 * Features:
 * - Modal dialog with node details
 * - URL synchronization for direct navigation
 * - Context-aware display (shows over correct view)
 * - Master indicator in title
 * - Scrollable body for long content
 *
 * Requirements: 8.1
 */
export function NodeModal({
  clusterId,
  nodeId,
  opened,
  onClose,
}: NodeModalProps): React.JSX.Element {
  const refreshInterval = useRefreshInterval();

  // Fetch node statistics with auto-refresh
  const {
    data: nodeStats,
    isLoading,
    error,
  } = useQuery<NodeDetailStats>({
    queryKey: ['cluster', clusterId, 'node', nodeId, 'stats'],
    queryFn: () => apiClient.getNodeStats(clusterId, nodeId!),
    refetchInterval: refreshInterval,
    enabled: !!nodeId && opened,
  });

  return (
    <Modal.Root opened={opened} onClose={onClose} size="90%">
      <Modal.Overlay />
      <Modal.Content
        style={{
          maxWidth: '100%',
        }}
      >
        <Modal.Header>
          <Modal.Title>
            <Group gap="xs">
              {nodeStats && (
                <MasterIndicator
                  isMaster={nodeStats.isMaster}
                  isMasterEligible={nodeStats.isMasterEligible}
                  size="lg"
                  showTooltip={true}
                />
              )}
              <Text size="lg" fw={600}>
                {nodeStats ? nodeStats.name : 'Node Details'}
              </Text>
            </Group>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body
          style={{
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
          }}
        >
      {isLoading && <NodeDetailSkeleton />}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load node statistics: {(error as Error).message}
        </Alert>
      )}

      {!isLoading && !error && nodeStats && (
        <NodeDetailContent nodeStats={nodeStats} loading={isLoading} />
      )}

      {!isLoading && !error && !nodeStats && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Node statistics not found
        </Alert>
      )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
