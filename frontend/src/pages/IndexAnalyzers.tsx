import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Tabs,
  Table,
  Alert,
  Badge,
  Code,
  TextInput,
  Select,
  Accordion,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { SettingsPageSkeleton } from '../components/LoadingSkeleton';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle, IconSearch, IconFilter } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { AnalyzerInfo, FieldInfo } from '../types/api';

/**
 * IndexAnalyzers component displays analyzers and fields configured for an index
 * 
 * Features:
 * - Display configured analyzers for index
 * - Show analyzer components
 * - Display all fields with types
 * - Show which analyzer is used per field
 * - Support field filtering
 * - Show field properties
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
export function IndexAnalyzersPage() {
  const { id, indexName } = useParams<{ id: string; indexName: string }>();
  const [fieldFilter, setFieldFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Fetch index analyzers
  const {
    data: analyzersData,
    isLoading: analyzersLoading,
    error: analyzersError,
  } = useQuery({
    queryKey: ['cluster', id, 'index', indexName, 'analyzers'],
    queryFn: () => apiClient.getIndexAnalyzers(id!, indexName!),
    enabled: !!id && !!indexName,
  });

  // Fetch index fields
  const {
    data: fieldsData,
    isLoading: fieldsLoading,
    error: fieldsError,
  } = useQuery({
    queryKey: ['cluster', id, 'index', indexName, 'fields'],
    queryFn: () => apiClient.getIndexFields(id!, indexName!),
    enabled: !!id && !!indexName,
  });

  if (!id || !indexName) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID and index name are required
        </Alert>
      </FullWidthContainer>
    );
  }

  const isLoading = analyzersLoading || fieldsLoading;
  const error = analyzersError || fieldsError;

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (error) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load index analyzers: {(error as Error).message}
        </Alert>
      </FullWidthContainer>
    );
  }

  // Filter fields
  const filteredFields = fieldsData?.fields.filter((field: FieldInfo) => {
    const matchesName = !fieldFilter || field.name.toLowerCase().includes(fieldFilter.toLowerCase());
    const matchesType = !typeFilter || field.type === typeFilter;
    return matchesName && matchesType;
  }) || [];

  // Get unique field types for filter
  const fieldTypes = Array.from(new Set(fieldsData?.fields.map((f: FieldInfo) => f.type) || [])).sort();

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Index Analyzers & Fields</Title>
          <Text size="sm" c="dimmed">
            {indexName}
          </Text>
        </div>
      </Group>

      <Tabs defaultValue="fields">
        <Tabs.List>
          <Tabs.Tab value="fields">
            <Group gap="xs">
              Fields
              <Badge size="sm" variant="light">
                {fieldsData?.fields.length || 0}
              </Badge>
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="analyzers">
            <Group gap="xs">
              Analyzers
              <Badge size="sm" variant="light">
                {Object.keys(analyzersData?.analyzers || {}).length}
              </Badge>
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="tokenizers">
            <Group gap="xs">
              Tokenizers
              <Badge size="sm" variant="light">
                {Object.keys(analyzersData?.tokenizers || {}).length}
              </Badge>
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="filters">
            <Group gap="xs">
              Filters
              <Badge size="sm" variant="light">
                {Object.keys(analyzersData?.filters || {}).length}
              </Badge>
            </Group>
          </Tabs.Tab>
        </Tabs.List>

        {/* Fields Tab */}
        <Tabs.Panel value="fields" pt="md">
          <Stack gap="md">
            <Card shadow="sm" padding="md">
              <Group grow>
                <TextInput
                  placeholder="Filter by field name..."
                  leftSection={<IconSearch size={16} />}
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.currentTarget.value)}
                />
                <Select
                  placeholder="Filter by type..."
                  leftSection={<IconFilter size={16} />}
                  value={typeFilter}
                  onChange={(value) => setTypeFilter(value || '')}
                  data={[
                    { value: '', label: 'All types' },
                    ...fieldTypes.map(type => ({ value: type, label: type })),
                  ]}
                  clearable
                />
              </Group>
            </Card>

            <Card shadow="sm" padding="lg">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Field Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Analyzer</Table.Th>
                    <Table.Th>Search Analyzer</Table.Th>
                    <Table.Th>Properties</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredFields.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text ta="center" c="dimmed">
                          No fields found
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredFields.map((field: FieldInfo) => (
                      <Table.Tr key={field.name}>
                        <Table.Td>
                          <Code>{field.name}</Code>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue">
                            {field.type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {field.analyzer ? (
                            <Badge variant="light" color="green">
                              {field.analyzer}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">
                              default
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {field.searchAnalyzer ? (
                            <Badge variant="light" color="orange">
                              {field.searchAnalyzer}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">
                              -
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {field.searchable && (
                              <Badge size="xs" variant="light" color="blue">
                                Searchable
                              </Badge>
                            )}
                            {field.aggregatable && (
                              <Badge size="xs" variant="light" color="green">
                                Aggregatable
                              </Badge>
                            )}
                            {field.stored && (
                              <Badge size="xs" variant="light" color="orange">
                                Stored
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Card>
          </Stack>
        </Tabs.Panel>

        {/* Analyzers Tab */}
        <Tabs.Panel value="analyzers" pt="md">
          <Card shadow="sm" padding="lg">
            {Object.keys(analyzersData?.analyzers || {}).length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                No custom analyzers configured for this index. The index uses built-in Elasticsearch analyzers.
              </Alert>
            ) : (
              <Accordion variant="contained">
                {Object.entries(analyzersData?.analyzers || {}).map(([name, analyzer]) => {
                  const analyzerInfo = analyzer as AnalyzerInfo;
                  return (
                    <Accordion.Item key={name} value={name}>
                      <Accordion.Control>
                        <Group justify="space-between">
                          <Code>{name}</Code>
                          {analyzerInfo.type && (
                            <Badge variant="light" color="blue">
                              {analyzerInfo.type}
                            </Badge>
                          )}
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          {analyzerInfo.tokenizer && (
                            <div>
                              <Text size="sm" fw={500} mb="xs">
                                Tokenizer:
                              </Text>
                              <Badge variant="light" color="green">
                                {analyzerInfo.tokenizer}
                              </Badge>
                            </div>
                          )}

                          {analyzerInfo.charFilter && analyzerInfo.charFilter.length > 0 && (
                            <div>
                              <Text size="sm" fw={500} mb="xs">
                                Character Filters:
                              </Text>
                              <Group gap="xs">
                                {analyzerInfo.charFilter.map((filter, idx) => (
                                  <Badge key={idx} variant="light" color="orange">
                                    {filter}
                                  </Badge>
                                ))}
                              </Group>
                            </div>
                          )}

                          {analyzerInfo.filter && analyzerInfo.filter.length > 0 && (
                            <div>
                              <Text size="sm" fw={500} mb="xs">
                                Token Filters:
                              </Text>
                              <Group gap="xs">
                                {analyzerInfo.filter.map((filter, idx) => (
                                  <Badge key={idx} variant="light" color="purple">
                                    {filter}
                                  </Badge>
                                ))}
                              </Group>
                            </div>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </Card>
        </Tabs.Panel>

        {/* Tokenizers Tab */}
        <Tabs.Panel value="tokenizers" pt="md">
          <Card shadow="sm" padding="lg">
            {Object.keys(analyzersData?.tokenizers || {}).length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                No custom tokenizers configured for this index.
              </Alert>
            ) : (
              <Accordion variant="contained">
                {Object.entries(analyzersData?.tokenizers || {}).map(([name, config]) => (
                  <Accordion.Item key={name} value={name}>
                    <Accordion.Control>
                      <Code>{name}</Code>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Code block>
                        {JSON.stringify(config, null, 2)}
                      </Code>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Card>
        </Tabs.Panel>

        {/* Filters Tab */}
        <Tabs.Panel value="filters" pt="md">
          <Card shadow="sm" padding="lg">
            {Object.keys(analyzersData?.filters || {}).length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                No custom token filters configured for this index.
              </Alert>
            ) : (
              <Accordion variant="contained">
                {Object.entries(analyzersData?.filters || {}).map(([name, config]) => (
                  <Accordion.Item key={name} value={name}>
                    <Accordion.Control>
                      <Code>{name}</Code>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Code block>
                        {JSON.stringify(config, null, 2)}
                      </Code>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>
    </FullWidthContainer>
  );
}
