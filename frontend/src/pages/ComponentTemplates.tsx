import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Table,
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  ActionIcon,
  ScrollArea,
  Tabs,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { getErrorMessage } from '../lib/errorHandling';
import { queryKeys } from '../utils/queryKeys';
import type { CreateComponentTemplateRequest } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageSkeleton } from '../components/PageSkeleton';

export function ComponentTemplates({ embedded = false }: { embedded?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.cluster(id!).componentTemplates(),
    queryFn: () => apiClient.getComponentTemplates(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => apiClient.deleteComponentTemplate(id!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).componentTemplates() });
      notifications.show({
        title: 'Success',
        message: 'Component template deleted successfully',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete component template: ${err.message}`,
        color: 'red',
      });
    },
  });

  if (!id) {
    const errEl = <ErrorAlert message="Cluster ID is required" />;
    return embedded ? errEl : <FullWidthContainer>{errEl}</FullWidthContainer>;
  }

  const loadError = error
    ? new Error(`Failed to load component templates: ${getErrorMessage(error)}`)
    : undefined;

  const inner = <>
    <PageSkeleton isLoading={isLoading} error={loadError}>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>Component Templates</Title>
            <Text size="sm" c="dimmed">
              Manage reusable component templates for composable index templates
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
            Create Component Template
          </Button>
        </Group>

        <Card shadow="sm" padding="lg">
          {!templates || templates.length === 0 ? (
            <Stack gap="md" align="center" py="xl">
              <Text c="dimmed">No component templates found</Text>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
                Create Component Template
              </Button>
            </Stack>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {templates.map((template) => (
                    <Table.Tr key={template.name}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {template.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{template.version ?? 'N/A'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => {
                            if (confirm(`Delete component template "${template.name}"?`)) {
                              deleteMutation.mutate(template.name);
                            }
                          }}
                          loading={deleteMutation.isPending}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>

        <CreateComponentTemplateModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          clusterId={id}
        />
      </PageSkeleton>
    </>;
  return embedded ? inner : <FullWidthContainer>{inner}</FullWidthContainer>;
}

interface CreateComponentTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
}

function CreateComponentTemplateModal({
  opened,
  onClose,
  clusterId,
}: CreateComponentTemplateModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<{
    name: string;
    version: number | undefined;
    settingsText: string;
    mappingsText: string;
  }>({
    initialValues: {
      name: '',
      version: undefined,
      settingsText: '',
      mappingsText: '',
    },
    validate: {
      name: (value) => (!value ? 'Component template name is required' : null),
      settingsText: (value) => {
        if (!value) return null;
        try {
          JSON.parse(value);
          return null;
        } catch {
          return 'Settings must be valid JSON';
        }
      },
      mappingsText: (value) => {
        if (!value) return null;
        try {
          JSON.parse(value);
          return null;
        } catch {
          return 'Mappings must be valid JSON';
        }
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateComponentTemplateRequest) =>
      apiClient.putComponentTemplate(clusterId, request.name, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(clusterId).componentTemplates() });
      notifications.show({
        title: 'Success',
        message: 'Component template created successfully',
        color: 'green',
      });
      form.reset();
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to create component template: ${err.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    const request: CreateComponentTemplateRequest = {
      name: values.name,
    };

    if (values.version !== undefined) {
      request.version = values.version;
    }
    if (values.settingsText) {
      request.settings = JSON.parse(values.settingsText) as Record<string, unknown>;
    }
    if (values.mappingsText) {
      request.mappings = JSON.parse(values.mappingsText) as Record<string, unknown>;
    }

    createMutation.mutate(request);
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create Component Template" size="xl">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Template Name"
            placeholder="my-component-template"
            required
            {...form.getInputProps('name')}
          />

          <NumberInput
            label="Version"
            placeholder="1"
            description="Optional version number"
            min={1}
            {...form.getInputProps('version')}
          />

          <Tabs defaultValue="settings">
            <Tabs.List>
              <Tabs.Tab value="settings">Settings</Tabs.Tab>
              <Tabs.Tab value="mappings">Mappings</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="settings" pt="md">
              <Textarea
                label="Settings (JSON)"
                placeholder='{"number_of_shards": 1, "number_of_replicas": 1}'
                minRows={6}
                {...form.getInputProps('settingsText')}
              />
            </Tabs.Panel>

            <Tabs.Panel value="mappings" pt="md">
              <Textarea
                label="Mappings (JSON)"
                placeholder='{"properties": {"field1": {"type": "text"}}}'
                minRows={6}
                {...form.getInputProps('mappingsText')}
              />
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Component Template
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
