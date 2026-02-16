import { useState } from 'react';
import {
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
  Textarea,
  NumberInput,
  Switch,
  ActionIcon,
  Badge,
  ScrollArea,
  Tabs,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { CreateTemplateRequest } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';

/**
 * Templates component displays and manages index templates
 * 
 * Features:
 * - Display existing templates (legacy and composable)
 * - Create new templates
 * - Delete templates
 * - Show template priority and patterns
 * 
 * Requirements: 12.1, 12.2, 12.5, 12.6, 12.7, 12.8
 */
export function Templates() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch templates
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster', id, 'templates'],
    queryFn: () => apiClient.getTemplates(id!),
    enabled: !!id,
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: ({ name, composable }: { name: string; composable: boolean }) =>
      apiClient.deleteTemplate(id!, name, composable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'templates'] });
      notifications.show({
        title: 'Success',
        message: 'Template deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete template: ${error.message}`,
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
    return (
      <FullWidthContainer>
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </FullWidthContainer>
    );
  }

  if (error) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load templates: {(error as Error).message}
        </Alert>
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Index Templates</Title>
          <Text size="sm" c="dimmed">
            Manage index templates for consistent settings across indices
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create Template
        </Button>
      </Group>

      <Card shadow="sm" padding="lg">
        {!templates || templates.length === 0 ? (
          <Stack gap="md" align="center" py="xl">
            <Text c="dimmed">No templates found</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Template
            </Button>
          </Stack>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Index Patterns</Table.Th>
                  <Table.Th>Priority/Order</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {templates.map((template) => (
                  <Table.Tr key={template.name}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{template.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={template.composable ? 'blue' : 'gray'}>
                        {template.composable ? 'Composable' : 'Legacy'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {template.indexPatterns.map((pattern) => (
                          <Badge key={pattern} size="sm" variant="outline">
                            {pattern}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {template.priority !== undefined ? template.priority : template.order !== undefined ? template.order : 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{template.version || 'N/A'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => {
                          if (confirm(`Delete template "${template.name}"?`)) {
                            deleteMutation.mutate({ name: template.name, composable: template.composable || false });
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

      <CreateTemplateModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clusterId={id}
      />
    </FullWidthContainer>
  );
}

/**
 * CreateTemplateModal component for creating new templates
 * 
 * Requirements: 12.2, 12.3, 12.4, 12.5
 */
interface CreateTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
}

function CreateTemplateModal({ opened, onClose, clusterId }: CreateTemplateModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateTemplateRequest & { indexPatternsText: string; settingsText: string; mappingsText: string; aliasesText: string }>({
    initialValues: {
      name: '',
      indexPatterns: [],
      indexPatternsText: '',
      priority: undefined,
      order: undefined,
      version: undefined,
      settings: undefined,
      settingsText: '',
      mappings: undefined,
      mappingsText: '',
      aliases: undefined,
      aliasesText: '',
      composable: true,
    },
    validate: {
      name: (value: string) => {
        if (!value) return 'Template name is required';
        if (value.startsWith('_') || value.startsWith('-') || value.startsWith('+')) {
          return 'Template name cannot start with _, -, or +';
        }
        return null;
      },
      indexPatternsText: (value: string) => (!value ? 'At least one index pattern is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateTemplateRequest) => apiClient.createTemplate(clusterId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId, 'templates'] });
      notifications.show({
        title: 'Success',
        message: 'Template created successfully',
        color: 'green',
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to create template: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    try {
      // Parse index patterns
      const indexPatterns = values.indexPatternsText
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      if (indexPatterns.length === 0) {
        notifications.show({
          title: 'Error',
          message: 'At least one index pattern is required',
          color: 'red',
        });
        return;
      }

      // Parse JSON fields
      const request: CreateTemplateRequest = {
        name: values.name,
        indexPatterns,
        composable: values.composable,
      };

      if (values.composable && values.priority !== undefined) {
        request.priority = values.priority;
      }
      if (!values.composable && values.order !== undefined) {
        request.order = values.order;
      }
      if (values.version !== undefined) {
        request.version = values.version;
      }

      if (values.settingsText) {
        request.settings = JSON.parse(values.settingsText);
      }
      if (values.mappingsText) {
        request.mappings = JSON.parse(values.mappingsText);
      }
      if (values.aliasesText) {
        request.aliases = JSON.parse(values.aliasesText);
      }

      createMutation.mutate(request);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Invalid JSON: ${(error as Error).message}`,
        color: 'red',
      });
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Template"
      size="xl"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Template Name"
            placeholder="my-template"
            required
            {...form.getInputProps('name')}
          />

          <Switch
            label="Composable Template"
            description="Use composable template format (Elasticsearch 7.8+)"
            {...form.getInputProps('composable', { type: 'checkbox' })}
          />

          <TextInput
            label="Index Patterns"
            placeholder="logs-*, metrics-*"
            description="Comma-separated list of index patterns"
            required
            {...form.getInputProps('indexPatternsText')}
          />

          {form.values.composable ? (
            <NumberInput
              label="Priority"
              placeholder="100"
              description="Higher priority templates override lower priority ones"
              min={0}
              {...form.getInputProps('priority')}
            />
          ) : (
            <NumberInput
              label="Order"
              placeholder="0"
              description="Higher order templates override lower order ones"
              min={0}
              {...form.getInputProps('order')}
            />
          )}

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
              <Tabs.Tab value="aliases">Aliases</Tabs.Tab>
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

            <Tabs.Panel value="aliases" pt="md">
              <Textarea
                label="Aliases (JSON)"
                placeholder='{"my-alias": {}}'
                minRows={6}
                {...form.getInputProps('aliasesText')}
              />
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Template
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
