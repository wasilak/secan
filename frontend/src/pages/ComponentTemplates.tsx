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
  NumberInput,
  ActionIcon,
  Badge,
  Box,
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
import type { ComponentTemplateInfo, CreateComponentTemplateRequest } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageSkeleton } from '../components/PageSkeleton';
import { CodeEditor } from '../components/CodeEditor';

export function ComponentTemplates() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: templates, isLoading, error } = useQuery({
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
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete component template: ${error.message}`,
        color: 'red',
      });
    },
  });

  if (!id) {
    return (
      <FullWidthContainer>
        <ErrorAlert message="Cluster ID is required" />
      </FullWidthContainer>
    );
  }

  const loadError = error
    ? new Error(`Failed to load component templates: ${getErrorMessage(error)}`)
    : undefined;

  const renderBadges = (template: ComponentTemplateInfo) => (
    <Group gap={4}>
      {template.settings && <Badge size="xs" color="blue">S</Badge>}
      {template.mappings && <Badge size="xs" color="green">M</Badge>}
      {template.aliases && <Badge size="xs" color="violet">A</Badge>}
    </Group>
  );

  return (
    <FullWidthContainer>
      <PageSkeleton isLoading={isLoading} error={loadError}>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>Component Templates</Title>
            <Text size="sm" c="dimmed">
              Manage reusable component templates for settings, mappings, and aliases
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
            <Box className="table-overflow">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Version</Table.Th>
                    <Table.Th>Contents</Table.Th>
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
                      <Table.Td>{renderBadges(template)}</Table.Td>
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
            </Box>
          )}
        </Card>

        <CreateComponentTemplateModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          clusterId={id}
        />
      </PageSkeleton>
    </FullWidthContainer>
  );
}

interface CreateComponentTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
}

function CreateComponentTemplateModal({ opened, onClose, clusterId }: CreateComponentTemplateModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<
    CreateComponentTemplateRequest & {
      settingsText: string;
      mappingsText: string;
      aliasesText: string;
    }
  >({
    initialValues: {
      name: '',
      version: undefined,
      settings: undefined,
      // initialize editors with empty JSON object for better UX
      settingsText: '{}',
      mappings: undefined,
      mappingsText: '{}',
      aliases: undefined,
      aliasesText: '{}',
    },
    validate: {
      name: (value: string) => {
        if (!value) return 'Component template name is required';
        if (value.startsWith('_') || value.startsWith('-') || value.startsWith('+')) {
          return 'Template name cannot start with _, -, or +';
        }
        return null;
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateComponentTemplateRequest) => apiClient.createComponentTemplate(clusterId, request),
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
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to create component template: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    try {
      const request: CreateComponentTemplateRequest = {
        name: values.name,
      };

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
        message: `Invalid JSON: ${getErrorMessage(error)}`,
        color: 'red',
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create Component Template" size={1100} styles={{ body: { overflowX: 'hidden' } }}>
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
              <Tabs.Tab value="aliases">Aliases</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="settings" pt="md">
            <CodeEditor
              title="Settings (JSON)"
              value={form.values.settingsText}
              onChange={(v) => form.setFieldValue('settingsText', v ?? '')}
              onBlur={() => {
                try {
                  if (form.values.settingsText && form.values.settingsText.trim() !== '') {
                    JSON.parse(form.values.settingsText);
                    form.setFieldError('settingsText', undefined);
                  } else {
                    form.setFieldError('settingsText', undefined);
                  }
                } catch (err: any) {
                  form.setFieldError('settingsText', (err && err.message) || 'Invalid JSON');
                }
              }}
              language="json"
              height="260px"
              showCopyButton
              onMount={(editor: any) => setTimeout(() => editor?.layout?.(), 0)}
            />
            </Tabs.Panel>

            <Tabs.Panel value="mappings" pt="md">
            <CodeEditor
              title="Mappings (JSON)"
              value={form.values.mappingsText}
              onChange={(v) => form.setFieldValue('mappingsText', v ?? '')}
              onBlur={() => {
                try {
                  if (form.values.mappingsText && form.values.mappingsText.trim() !== '') {
                    JSON.parse(form.values.mappingsText);
                    form.setFieldError('mappingsText', undefined);
                  } else {
                    form.setFieldError('mappingsText', undefined);
                  }
                } catch (err: any) {
                  form.setFieldError('mappingsText', (err && err.message) || 'Invalid JSON');
                }
              }}
              language="json"
              height="260px"
              showCopyButton
              onMount={(editor: any) => setTimeout(() => editor?.layout?.(), 0)}
            />
            </Tabs.Panel>

            <Tabs.Panel value="aliases" pt="md">
            <CodeEditor
              title="Aliases (JSON)"
              value={form.values.aliasesText}
              onChange={(v) => form.setFieldValue('aliasesText', v ?? '')}
              onBlur={() => {
                try {
                  if (form.values.aliasesText && form.values.aliasesText.trim() !== '') {
                    JSON.parse(form.values.aliasesText);
                    form.setFieldError('aliasesText', undefined);
                  } else {
                    form.setFieldError('aliasesText', undefined);
                  }
                } catch (err: any) {
                  form.setFieldError('aliasesText', (err && err.message) || 'Invalid JSON');
                }
              }}
              language="json"
              height="200px"
              showCopyButton
              onMount={(editor: any) => setTimeout(() => editor?.layout?.(), 0)}
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
