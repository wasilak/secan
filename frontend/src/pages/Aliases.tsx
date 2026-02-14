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
  MultiSelect,
  Textarea,
  Switch,
  ActionIcon,
  Badge,
  ScrollArea,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { AliasInfo, CreateAliasRequest } from '../types/api';

/**
 * Aliases component displays and manages index aliases
 * 
 * Features:
 * - Display existing aliases
 * - Create new aliases with multiple indices
 * - Support routing and filter parameters
 * - Delete aliases
 * - Atomic alias operations
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */
export function Aliases() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch aliases
  const {
    data: aliases,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster', id, 'aliases'],
    queryFn: () => apiClient.getAliases(id!),
    enabled: !!id,
  });

  // Fetch indices for the multi-select
  const { data: indices } = useQuery({
    queryKey: ['cluster', id, 'indices'],
    queryFn: () => apiClient.getIndices(id!),
    enabled: !!id,
  });

  // Delete alias mutation
  const deleteMutation = useMutation({
    mutationFn: ({ index, alias }: { index: string; alias: string }) =>
      apiClient.deleteAlias(id!, index, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'aliases'] });
      notifications.show({
        title: 'Success',
        message: 'Alias deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete alias: ${error.message}`,
        color: 'red',
      });
    },
  });

  if (!id) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
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
          Failed to load aliases: {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  // Group aliases by alias name
  const aliasesByName = aliases?.reduce((acc, alias) => {
    if (!acc[alias.alias]) {
      acc[alias.alias] = [];
    }
    acc[alias.alias].push(alias);
    return acc;
  }, {} as Record<string, AliasInfo[]>) || {};

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Index Aliases</Title>
          <Text size="sm" c="dimmed">
            Manage index aliases for zero-downtime migrations and logical groupings
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create Alias
        </Button>
      </Group>

      <Card shadow="sm" padding="lg">
        {Object.keys(aliasesByName).length === 0 ? (
          <Stack gap="md" align="center" py="xl">
            <Text c="dimmed">No aliases found</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Alias
            </Button>
          </Stack>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Alias</Table.Th>
                  <Table.Th>Indices</Table.Th>
                  <Table.Th>Filter</Table.Th>
                  <Table.Th>Routing</Table.Th>
                  <Table.Th>Write Index</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(aliasesByName).map(([aliasName, aliasInfos]) => (
                  <Table.Tr key={aliasName}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{aliasName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {aliasInfos.map((info) => (
                          <Badge key={info.index} size="sm" variant="light">
                            {info.index}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {aliasInfos[0].filter || 'None'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {aliasInfos[0].routing || 'None'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {aliasInfos.some(info => info.isWriteIndex) && (
                        <Badge size="sm" color="blue">
                          Yes
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {aliasInfos.map((info) => (
                          <ActionIcon
                            key={info.index}
                            color="red"
                            variant="subtle"
                            onClick={() => {
                              if (confirm(`Delete alias "${aliasName}" from index "${info.index}"?`)) {
                                deleteMutation.mutate({ index: info.index, alias: aliasName });
                              }
                            }}
                            loading={deleteMutation.isPending}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        ))}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      <CreateAliasModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clusterId={id}
        availableIndices={indices?.map(i => i.name) || []}
      />
    </Container>
  );
}

/**
 * CreateAliasModal component for creating new aliases
 * 
 * Requirements: 11.2, 11.3, 11.4, 11.5, 11.6
 */
interface CreateAliasModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
  availableIndices: string[];
}

function CreateAliasModal({ opened, onClose, clusterId, availableIndices }: CreateAliasModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateAliasRequest>({
    initialValues: {
      alias: '',
      indices: [],
      filter: undefined,
      routing: undefined,
      indexRouting: undefined,
      searchRouting: undefined,
      isWriteIndex: false,
    },
    validate: {
      alias: (value: string) => {
        if (!value) return 'Alias name is required';
        // Elasticsearch alias name validation
        if (value.startsWith('_') || value.startsWith('-') || value.startsWith('+')) {
          return 'Alias name cannot start with _, -, or +';
        }
        if (value.includes(' ') || value.includes(',') || value.includes('#')) {
          return 'Alias name cannot contain spaces, commas, or #';
        }
        return null;
      },
      indices: (value: string[]) => (value.length === 0 ? 'At least one index is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateAliasRequest) => {
      // Parse filter if provided
      const finalRequest = { ...request };
      if (request.filter) {
        try {
          finalRequest.filter = JSON.parse(request.filter as unknown as string);
        } catch {
          throw new Error('Invalid JSON in filter field');
        }
      }
      return apiClient.createAlias(clusterId, finalRequest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'aliases'] });
      notifications.show({
        title: 'Success',
        message: 'Alias created successfully',
        color: 'green',
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to create alias: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    createMutation.mutate(values);
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Alias"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Alias Name"
            placeholder="my-alias"
            required
            {...form.getInputProps('alias')}
          />

          <MultiSelect
            label="Indices"
            placeholder="Select indices"
            data={availableIndices}
            searchable
            required
            {...form.getInputProps('indices')}
          />

          <Textarea
            label="Filter (JSON)"
            placeholder='{"term": {"user": "kimchy"}}'
            description="Optional filter to apply to the alias"
            minRows={3}
            {...form.getInputProps('filter')}
          />

          <TextInput
            label="Routing"
            placeholder="1"
            description="Optional routing value for both index and search operations"
            {...form.getInputProps('routing')}
          />

          <TextInput
            label="Index Routing"
            placeholder="1"
            description="Optional routing value for index operations only"
            {...form.getInputProps('indexRouting')}
          />

          <TextInput
            label="Search Routing"
            placeholder="1,2"
            description="Optional routing value for search operations only"
            {...form.getInputProps('searchRouting')}
          />

          <Switch
            label="Is Write Index"
            description="Mark this as the write index for the alias"
            {...form.getInputProps('isWriteIndex', { type: 'checkbox' })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Alias
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
