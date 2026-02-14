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
  Select,
  Badge,
  ScrollArea,
  Progress,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconArrowRight } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { ShardInfo, NodeInfo } from '../types/api';

/**
 * ShardManagement component displays and manages shard allocation
 * 
 * Features:
 * - Display shard allocation
 * - Shard relocation UI
 * - Show available target nodes
 * - Display relocation progress
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
 */
export function ShardManagement() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [relocateModalOpen, setRelocateModalOpen] = useState(false);
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);

  // Fetch shards
  const {
    data: shards,
    isLoading: shardsLoading,
    error: shardsError,
  } = useQuery({
    queryKey: ['cluster', id, 'shards'],
    queryFn: () => apiClient.getShards(id!),
    enabled: !!id,
  });

  // Fetch nodes for relocation targets
  const {
    data: nodes,
    isLoading: nodesLoading,
  } = useQuery({
    queryKey: ['cluster', id, 'nodes'],
    queryFn: () => apiClient.getNodes(id!),
    enabled: !!id,
  });

  // Relocate shard mutation
  const relocateMutation = useMutation({
    mutationFn: ({ index, shard, fromNode, toNode }: { index: string; shard: number; fromNode: string; toNode: string }) =>
      apiClient.proxyRequest(id!, 'POST', '/_cluster/reroute', {
        commands: [
          {
            move: {
              index,
              shard,
              from_node: fromNode,
              to_node: toNode,
            },
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'shards'] });
      notifications.show({
        title: 'Success',
        message: 'Shard relocation initiated successfully',
        color: 'green',
      });
      setRelocateModalOpen(false);
      setSelectedShard(null);
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to relocate shard: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleRelocateShard = (shard: ShardInfo) => {
    setSelectedShard(shard);
    setRelocateModalOpen(true);
  };

  if (!id) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </Container>
    );
  }

  if (shardsLoading || nodesLoading) {
    return (
      <Container size="xl">
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (shardsError) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load shards: {(shardsError as Error).message}
        </Alert>
      </Container>
    );
  }

  // Group shards by state
  const shardsByState = shards?.reduce((acc, shard) => {
    if (!acc[shard.state]) {
      acc[shard.state] = [];
    }
    acc[shard.state].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>) || {};

  // Group shards by node
  const shardsByNode = shards?.reduce((acc, shard) => {
    const node = shard.node || 'UNASSIGNED';
    if (!acc[node]) {
      acc[node] = [];
    }
    acc[node].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>) || {};

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Shard Management</Title>
          <Text size="sm" c="dimmed">
            View and manage shard allocation across nodes
          </Text>
        </div>
      </Group>

      {/* Shard state summary */}
      <Group mb="md" grow>
        {Object.entries(shardsByState).map(([state, stateShards]) => (
          <Card key={state} shadow="sm" padding="md">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">{state}</Text>
              <Text size="xl" fw={700}>{stateShards.length}</Text>
              <Badge
                size="sm"
                color={
                  state === 'STARTED'
                    ? 'green'
                    : state === 'UNASSIGNED'
                    ? 'red'
                    : 'yellow'
                }
              >
                {state}
              </Badge>
            </Stack>
          </Card>
        ))}
      </Group>

      {/* Shard allocation by node */}
      <Card shadow="sm" padding="lg" mb="md">
        <Title order={3} mb="md">Shard Allocation by Node</Title>
        <Stack gap="md">
          {Object.entries(shardsByNode).map(([node, nodeShards]) => {
            const nodeInfo = nodes?.find(n => n.name === node);
            const primaryShards = nodeShards.filter(s => s.primary).length;
            const replicaShards = nodeShards.filter(s => !s.primary).length;

            return (
              <Card key={node} shadow="xs" padding="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>{node}</Text>
                      {nodeInfo && (
                        <Text size="xs" c="dimmed">{nodeInfo.ip}</Text>
                      )}
                    </div>
                    <Group gap="xs">
                      <Badge size="sm" variant="light" color="blue">
                        {primaryShards}p
                      </Badge>
                      <Badge size="sm" variant="light" color="gray">
                        {replicaShards}r
                      </Badge>
                      <Badge size="sm" variant="light">
                        {nodeShards.length} total
                      </Badge>
                    </Group>
                  </Group>

                  {nodeInfo && (
                    <Group gap="md">
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Heap</Text>
                        <Progress
                          value={Math.round((nodeInfo.heapUsed / nodeInfo.heapMax) * 100)}
                          color={nodeInfo.heapUsed / nodeInfo.heapMax > 0.9 ? 'red' : 'blue'}
                          size="sm"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Disk</Text>
                        <Progress
                          value={Math.round((nodeInfo.diskUsed / nodeInfo.diskTotal) * 100)}
                          color={nodeInfo.diskUsed / nodeInfo.diskTotal > 0.9 ? 'red' : 'blue'}
                          size="sm"
                        />
                      </div>
                    </Group>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Card>

      {/* Detailed shard list */}
      <Card shadow="sm" padding="lg">
        <Title order={3} mb="md">All Shards</Title>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Index</Table.Th>
                <Table.Th>Shard</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th>Node</Table.Th>
                <Table.Th>Documents</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shards?.slice(0, 100).map((shard, idx) => (
                <Table.Tr key={`${shard.index}-${shard.shard}-${idx}`}>
                  <Table.Td>
                    <Text size="sm">{shard.index}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{shard.shard}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={shard.primary ? 'blue' : 'gray'}>
                      {shard.primary ? 'Primary' : 'Replica'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      color={
                        shard.state === 'STARTED'
                          ? 'green'
                          : shard.state === 'UNASSIGNED'
                          ? 'red'
                          : 'yellow'
                      }
                    >
                      {shard.state}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{shard.node || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{shard.docs?.toLocaleString() || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{shard.store ? formatBytes(shard.store) : 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {shard.state === 'STARTED' && shard.node && (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconArrowRight size={14} />}
                        onClick={() => handleRelocateShard(shard)}
                      >
                        Relocate
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {shards && shards.length > 100 && (
            <Text size="sm" c="dimmed" ta="center" mt="md">
              Showing first 100 of {shards.length} shards
            </Text>
          )}
        </ScrollArea>
      </Card>

      {selectedShard && (
        <RelocateShardModal
          opened={relocateModalOpen}
          onClose={() => {
            setRelocateModalOpen(false);
            setSelectedShard(null);
          }}
          shard={selectedShard}
          nodes={nodes || []}
          onRelocate={(toNode) => {
            if (selectedShard.node) {
              relocateMutation.mutate({
                index: selectedShard.index,
                shard: selectedShard.shard,
                fromNode: selectedShard.node,
                toNode,
              });
            }
          }}
          isLoading={relocateMutation.isPending}
        />
      )}
    </Container>
  );
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * RelocateShardModal component for relocating shards
 * 
 * Requirements: 10.2, 10.3, 10.4
 */
interface RelocateShardModalProps {
  opened: boolean;
  onClose: () => void;
  shard: ShardInfo;
  nodes: NodeInfo[];
  onRelocate: (toNode: string) => void;
  isLoading: boolean;
}

function RelocateShardModal({
  opened,
  onClose,
  shard,
  nodes,
  onRelocate,
  isLoading,
}: RelocateShardModalProps) {
  const form = useForm({
    initialValues: {
      targetNode: '',
    },
    validate: {
      targetNode: (value: string) => (!value ? 'Target node is required' : null),
    },
  });

  // Filter out the current node from available targets
  const availableNodes = nodes
    .filter(node => node.name !== shard.node)
    .map(node => ({
      value: node.name,
      label: `${node.name} (${node.roles.join(', ')})`,
    }));

  const handleSubmit = form.onSubmit((values) => {
    onRelocate(values.targetNode);
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Relocate Shard"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} title="Shard Information" color="blue">
            <Stack gap="xs">
              <Text size="sm">
                <strong>Index:</strong> {shard.index}
              </Text>
              <Text size="sm">
                <strong>Shard:</strong> {shard.shard}
              </Text>
              <Text size="sm">
                <strong>Type:</strong> {shard.primary ? 'Primary' : 'Replica'}
              </Text>
              <Text size="sm">
                <strong>Current Node:</strong> {shard.node}
              </Text>
            </Stack>
          </Alert>

          <Select
            label="Target Node"
            placeholder="Select target node"
            data={availableNodes}
            searchable
            required
            {...form.getInputProps('targetNode')}
          />

          <Alert icon={<IconAlertCircle size={16} />} title="Warning" color="yellow">
            <Text size="sm">
              Relocating shards can impact cluster performance. Ensure the target node has sufficient resources.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              Relocate Shard
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
