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
  Switch,
  ActionIcon,
  Badge,
  Tabs,
  Box,
  Alert,
  Divider,
  Paper,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconFlask } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { getErrorMessage } from '../lib/errorHandling';
import { queryKeys } from '../utils/queryKeys';
import type { CreateTemplateRequest, SimulateTemplateRequest } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageSkeleton } from '../components/PageSkeleton';
import { SortableTransferList, ComponentTemplate } from '../components/SortableTransferList';
import { CodeEditor } from '../components/CodeEditor';
import { useClusterIndices } from '../hooks/useClusterIndices';
import { getPaginatedItems } from '../types/api';
import { TagsInput } from '@mantine/core';
import { useEffect } from 'react';

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
  const [simulateModalOpen, setSimulateModalOpen] = useState(false);

  // Fetch templates
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.cluster(id!).templates(),
    queryFn: () => apiClient.getTemplates(id!),
    enabled: !!id,
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: ({ name, composable }: { name: string; composable: boolean }) =>
      apiClient.deleteTemplate(id!, name, composable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).templates() });
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
        <ErrorAlert message="Cluster ID is required" />
      </FullWidthContainer>
    );
  }

  const loadError = error
    ? new Error(`Failed to load templates: ${getErrorMessage(error)}`)
    : undefined;

  return (
    <FullWidthContainer>
      <PageSkeleton isLoading={isLoading} error={loadError}>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>Index Templates</Title>
            <Text size="sm" c="dimmed">
              Manage index templates for consistent settings across indices
            </Text>
          </div>
          <Group>
            <Button
              variant="light"
              leftSection={<IconFlask size={16} />}
              onClick={() => setSimulateModalOpen(true)}
            >
              Simulate
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
              Create Template
            </Button>
          </Group>
        </Group>

        <Card shadow="sm" padding="lg">
          {!templates || templates.length === 0 ? (
            <Stack gap="md" align="center" py="xl">
              <Text c="dimmed">No templates found</Text>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
                Create Template
              </Button>
            </Stack>
          ) : (
            <Box className="table-overflow">
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
                        <Text size="sm" fw={500}>
                          {template.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={template.composable ? 'blue' : 'gray'}
                        >
                          {template.composable ? 'Composable' : 'Legacy'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {(template.indexPatterns || []).map((pattern) => (
                            <Badge key={pattern} size="sm" variant="outline">
                              {pattern}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {template.priority !== undefined
                            ? template.priority
                            : template.order !== undefined
                              ? template.order
                              : 'N/A'}
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
                               deleteMutation.mutate({
                                 name: template.name,
                                 composable: template.composable || false,
                               });
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

        <CreateTemplateModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          clusterId={id}
        />

        <SimulateModal
          opened={simulateModalOpen}
          onClose={() => setSimulateModalOpen(false)}
          clusterId={id!}
        />
      </PageSkeleton>
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

  const form = useForm<
    CreateTemplateRequest & {
      indexPatterns: string[];
      settingsText: string;
      mappingsText: string;
      aliasesText: string;
      composedOf: string[];
    }
  >({
    initialValues: {
      name: '',
      indexPatterns: [],
      // indexPatterns is a TagsInput (array)
      priority: undefined,
      order: undefined,
      version: undefined,
      settings: undefined,
      settingsText: '{}',
      mappings: undefined,
      mappingsText: '{}',
      aliases: undefined,
      aliasesText: '{}',
      composable: true,
      composedOf: [],
    },
    validate: {
      name: (value: string) => {
        if (!value) return 'Template name is required';
        if (value.startsWith('_') || value.startsWith('-') || value.startsWith('+')) {
          return 'Template name cannot start with _, -, or +';
        }
        return null;
      },
      indexPatterns: (value: string[]) => (value.length === 0 ? 'At least one index pattern is required' : null),
    },
  });
  // fetch indices for suggestions in the tags input
  const { data: indicesPaginated } = useClusterIndices(clusterId, { enabled: !!clusterId });
  const indices = getPaginatedItems(indicesPaginated) ?? [];
  const [indexOptions, setIndexOptions] = useState<string[]>(indices.map((i) => i.name));

  useEffect(() => {
    setIndexOptions(indices.map((i) => i.name));
  }, [indices]);

  const createMutation = useMutation({
    mutationFn: (request: CreateTemplateRequest) => apiClient.createTemplate(clusterId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(clusterId!).templates() });
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
      // indexPatterns comes from TagsInput as an array
      const indexPatterns = values.indexPatterns || [];

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
      if (values.composable && values.composedOf.length > 0) {
        request.composedOf = values.composedOf;
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
    <Modal opened={opened} onClose={onClose} title="Create Template" size={1100} styles={{ body: { overflowX: 'hidden' } }}>
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

          <div>
            <TagsInput
              label="Index Patterns"
              placeholder="Type or select index patterns (e.g. logs-*)"
              data={indexOptions}
              value={form.values.indexPatterns}
              onChange={(val: string[]) => form.setFieldValue('indexPatterns', val)}
              maxTags={50}
            />
            <Text size="xs" c="dimmed" mt="xs">
              Provide one or more index patterns. Wildcards are supported (e.g. my-index-*).
            </Text>
          </div>

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
              {form.values.composable && <Tabs.Tab value="composed">Composed</Tabs.Tab>}
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

            {form.values.composable && (
              <Tabs.Panel value="composed" pt="md">
                <ComposedTab clusterId={clusterId} value={form.values.composedOf} onChange={(val) => form.setFieldValue('composedOf', val)} />
              </Tabs.Panel>
            )}
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

interface ComposedTabProps {
  clusterId: string;
  value: string[];
  onChange: (value: string[]) => void;
}

function ComposedTab({ clusterId, value, onChange }: ComposedTabProps) {
  const { data: componentTemplates, isLoading } = useQuery({
    queryKey: queryKeys.cluster(clusterId).componentTemplates(),
    queryFn: () => apiClient.getComponentTemplates(clusterId),
    enabled: !!clusterId,
  });

  const availableItems: ComponentTemplate[] = (componentTemplates || []).map((ct) => ({
    name: ct.name,
    hasSettings: !!ct.settings,
    hasMappings: !!ct.mappings,
    hasAliases: !!ct.aliases,
    fullJson: {
      version: ct.version,
      settings: ct.settings,
      mappings: ct.mappings,
      aliases: ct.aliases,
    },
  }));

  return (
    <Box>
      {isLoading ? (
        <Text c="dimmed">Loading component templates...</Text>
      ) : (
        <SortableTransferList
          availableItems={availableItems}
          selectedIds={value}
          onSelectedChange={onChange}
        />
      )}
    </Box>
  );
}

interface SimulateModalProps {
  opened: boolean;
  onClose: () => void;
  clusterId: string;
}

function SimulateModal({ opened, onClose, clusterId }: SimulateModalProps) {
  const form = useForm<{
    indexPatterns: string[];
    settingsText: string;
    mappingsText: string;
    aliasesText: string;
  }>({
    initialValues: {
      indexPatterns: [],
      settingsText: '{}',
      mappingsText: '{}',
      aliasesText: '{}',
    },
  });
  const { data: indicesPaginated } = useClusterIndices(clusterId, { enabled: !!clusterId });
  const indices = getPaginatedItems(indicesPaginated) ?? [];
  const [indexOptions, setIndexOptions] = useState<string[]>(indices.map((i) => i.name));

  useEffect(() => {
    setIndexOptions(indices.map((i) => i.name));
  }, [indices]);

  const [result, setResult] = useState<{
    template: { settings?: object; mappings?: object; aliases?: object };
    overlapping?: Array<{ name: string; index_patterns: string[] }>;
  } | null>(null);

  const simulateMutation = useMutation({
    mutationFn: async (data: typeof form.values) => {
      const request = {
        index_patterns: data.indexPatterns || [],
      };

      const template: Record<string, unknown> = {};
      if (data.settingsText) template.settings = JSON.parse(data.settingsText);
      if (data.mappingsText) template.mappings = JSON.parse(data.mappingsText);
      if (data.aliasesText) template.aliases = JSON.parse(data.aliasesText);

      if (Object.keys(template).length > 0) {
        (request as Record<string, unknown>).template = template;
      }

      return apiClient.simulateTemplate(clusterId, request as SimulateTemplateRequest);
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: `Simulation failed: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit(() => {
    setResult(null);
    simulateMutation.mutate(form.values);
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Simulate Index Template" size={1100} styles={{ body: { overflowX: 'hidden' } }}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <div>
            <TagsInput
              label="Index Patterns"
              placeholder="Type or select index patterns (e.g. logs-*)"
              data={indexOptions}
              value={form.values.indexPatterns}
              onChange={(val: string[]) => form.setFieldValue('indexPatterns', val)}
              maxTags={50}
            />
            <Text size="xs" c="dimmed" mt="xs">
              Provide one or more index patterns. Wildcards are supported (e.g. my-index-*).
            </Text>
          </div>

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
            height="180px"
            showCopyButton
            onMount={(editor: any) => setTimeout(() => editor?.layout?.(), 0)}
          />

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
            height="180px"
            showCopyButton
            onMount={(editor: any) => setTimeout(() => editor?.layout?.(), 0)}
          />

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
            height="140px"
            showCopyButton
            onMount={(editor: any) => setTimeout(() => editor?.layout?.(), 0)}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" loading={simulateMutation.isPending}>
              Simulate
            </Button>
          </Group>
        </Stack>
      </form>

      {result && (
        <Box mt="lg">
          <Divider label="Simulation Result" mb="md" />
          
          {result.overlapping && result.overlapping.length > 0 && (
            <Alert color="yellow" mb="md">
              <Text fw={500}>Overlapping Templates</Text>
              {result.overlapping.map((t) => (
                <Text key={t.name} size="sm">
                  {t.name} ({t.index_patterns.join(', ')})
                </Text>
              ))}
            </Alert>
          )}

          <Tabs defaultValue="settings">
            <Tabs.List>
              <Tabs.Tab value="settings">Settings</Tabs.Tab>
              <Tabs.Tab value="mappings">Mappings</Tabs.Tab>
              <Tabs.Tab value="aliases">Aliases</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="settings" pt="md">
              <Paper withBorder p="sm" style={{ background: 'var(--mantine-color-gray-0)' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(result.template.settings || {}, null, 2)}
                </pre>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="mappings" pt="md">
              <Paper withBorder p="sm" style={{ background: 'var(--mantine-color-gray-0)' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(result.template.mappings || {}, null, 2)}
                </pre>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="aliases" pt="md">
              <Paper withBorder p="sm" style={{ background: 'var(--mantine-color-gray-0)' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(result.template.aliases || {}, null, 2)}
                </pre>
              </Paper>
            </Tabs.Panel>
          </Tabs>
        </Box>
      )}
    </Modal>
  );
}
