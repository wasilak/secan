import { Modal, Stack, Group, Text, Badge, Table, Box } from '@mantine/core';
import type { ShardInfo } from '../types/api';

/**
 * Props for ShardStatsModal component
 */
interface ShardStatsModalProps {
  shard: ShardInfo | null;
  opened: boolean;
  onClose: () => void;
}

/**
 * ShardStatsModal component
 * 
 * Displays detailed shard information in a modal dialog.
 * Shows shard number, type, index name, node, state, document count, and size.
 * 
 * Requirements: 4.5, 4.6
 */
export function ShardStatsModal({
  shard,
  opened,
  onClose,
}: ShardStatsModalProps): JSX.Element {
  // Format size in bytes to human-readable format
  const formatSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  // Format number with commas
  const formatNumber = (value?: number): string => {
    if (value === undefined) return 'N/A';
    return value.toLocaleString();
  };
  
  // Get shard type label
  const getShardTypeLabel = (primary: boolean): string => {
    return primary ? 'Primary' : 'Replica';
  };
  
  // Get shard state color
  const getStateColor = (state: string): string => {
    switch (state) {
      case 'STARTED':
        return 'green';
      case 'INITIALIZING':
        return 'yellow';
      case 'RELOCATING':
        return 'orange';
      case 'UNASSIGNED':
        return 'red';
      default:
        return 'gray';
    }
  };
  
  if (!shard) {
    return <></>;
  }
  
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={600} size="lg">
            Shard Details
          </Text>
          <Badge color={shard.primary ? 'blue' : 'gray'} variant="light">
            {getShardTypeLabel(shard.primary)}
          </Badge>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Basic shard information - Requirements: 4.6 */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Basic Information
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              {/* Shard number and type - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500} w="40%">
                  Shard Number
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text>{shard.shard}</Text>
                    <Badge color={shard.primary ? 'blue' : 'gray'} size="sm" variant="light">
                      {getShardTypeLabel(shard.primary)}
                    </Badge>
                  </Group>
                </Table.Td>
              </Table.Tr>
              
              {/* Index name - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>Index Name</Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="sm">
                    {shard.index}
                  </Text>
                </Table.Td>
              </Table.Tr>
              
              {/* Node name and ID - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>Node</Table.Td>
                <Table.Td>
                  {shard.node ? (
                    <Text ff="monospace" size="sm">
                      {shard.node}
                    </Text>
                  ) : (
                    <Text c="dimmed" size="sm">
                      Unassigned
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
              
              {/* Shard state - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>State</Table.Td>
                <Table.Td>
                  <Badge color={getStateColor(shard.state)} variant="light">
                    {shard.state}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              
              {/* Relocating node (if applicable) */}
              {shard.relocatingNode && (
                <Table.Tr>
                  <Table.Td fw={500}>Relocating To</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {shard.relocatingNode}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
        
        {/* Shard statistics - Requirements: 4.6 */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Statistics
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              {/* Document count - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500} w="40%">
                  Document Count
                </Table.Td>
                <Table.Td>
                  <Text>{formatNumber(shard.docs)}</Text>
                </Table.Td>
              </Table.Tr>
              
              {/* Size in bytes - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>Size</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text>{formatSize(shard.store)}</Text>
                    {shard.store !== undefined && (
                      <Text size="xs" c="dimmed">
                        ({formatNumber(shard.store)} bytes)
                      </Text>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Box>
        
        {/* Note about detailed stats */}
        <Box
          p="sm"
          style={{
            backgroundColor: 'var(--mantine-color-blue-light)',
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        >
          <Text size="sm" c="dimmed">
            <strong>Note:</strong> Detailed shard statistics (segments, merges, refreshes, flushes) 
            will be fetched from the Elasticsearch API in the next subtask.
          </Text>
        </Box>
      </Stack>
    </Modal>
  );
}
