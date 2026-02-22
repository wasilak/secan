import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Textarea,
  Select,
  Table,
  Loader,
  Alert,
  Badge,
  Code,
  Accordion,
  TextInput,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconSearch, IconRefresh } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import type { AnalyzeTextRequest, AnalysisToken } from '../types/api';
import { FullWidthContainer } from '../components/FullWidthContainer';

/**
 * Built-in Elasticsearch analyzers
 */
const BUILT_IN_ANALYZERS = [
  'standard',
  'simple',
  'whitespace',
  'stop',
  'keyword',
  'pattern',
  'language',
  'fingerprint',
];

/**
 * TextAnalysis component provides text analysis tools
 *
 * Features:
 * - Text input for analysis
 * - Analyzer dropdown
 * - Display analysis results (tokens, positions, attributes)
 * - Support analyzing by field
 * - Show analyzer chain
 * - Support custom analyzer definitions
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8
 */
export function TextAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [text, setText] = useState('');
  const [selectedAnalyzer, setSelectedAnalyzer] = useState<string>('standard');
  const [useField, setUseField] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [customTokenizer, setCustomTokenizer] = useState<string>('');
  const [customFilters, setCustomFilters] = useState<string>('');
  const [customCharFilters, setCustomCharFilters] = useState<string>('');

  // Fetch indices for field-based analysis
  const { data: indices } = useQuery({
    queryKey: ['cluster', id, 'indices'],
    queryFn: () => apiClient.getIndices(id!),
    enabled: !!id && useField,
  });

  // Fetch fields for selected index
  const { data: fieldsData } = useQuery({
    queryKey: ['cluster', id, 'index', selectedIndex, 'fields'],
    queryFn: () => apiClient.getIndexFields(id!, selectedIndex),
    enabled: !!id && !!selectedIndex && useField,
  });

  // Analyze text mutation
  const analyzeMutation = useMutation({
    mutationFn: (request: AnalyzeTextRequest) => apiClient.analyzeText(id!, request),
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to analyze text: ${error.message}`,
        color: 'red',
      });
    },
  });

  const handleAnalyze = () => {
    if (!text.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter text to analyze',
        color: 'red',
      });
      return;
    }

    const request: AnalyzeTextRequest = {
      text,
    };

    if (useField && selectedIndex && selectedField) {
      request.index = selectedIndex;
      request.field = selectedField;
    } else if (customTokenizer || customFilters || customCharFilters) {
      // Custom analyzer definition
      if (customTokenizer) {
        request.tokenizer = customTokenizer;
      }
      if (customFilters) {
        request.filter = customFilters
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      }
      if (customCharFilters) {
        request.charFilter = customCharFilters
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      }
    } else {
      request.analyzer = selectedAnalyzer;
    }

    analyzeMutation.mutate(request);
  };

  const handleReset = () => {
    setText('');
    setSelectedAnalyzer('standard');
    setUseField(false);
    setSelectedIndex('');
    setSelectedField('');
    setCustomTokenizer('');
    setCustomFilters('');
    setCustomCharFilters('');
    analyzeMutation.reset();
  };

  if (!id) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Text Analysis</Title>
          <Text size="sm" c="dimmed">
            Test and debug search analysis chains
          </Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={handleReset}>
          Reset
        </Button>
      </Group>

      <Stack gap="md">
        {/* Input Section */}
        <Card shadow="sm" padding="lg">
          <Stack gap="md">
            <Textarea
              label="Text to Analyze"
              placeholder="Enter text to analyze..."
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              minRows={4}
              maxRows={8}
              required
            />

            <Group grow align="flex-start">
              <Select
                label="Analyzer"
                placeholder="Select analyzer"
                value={selectedAnalyzer}
                onChange={(value) => setSelectedAnalyzer(value || 'standard')}
                data={BUILT_IN_ANALYZERS}
                disabled={useField || !!customTokenizer}
              />

              <Select
                label="Use Field Analyzer"
                placeholder="Select index"
                value={selectedIndex}
                onChange={(value) => {
                  setSelectedIndex(value || '');
                  setSelectedField('');
                  setUseField(!!value);
                }}
                data={indices?.map((idx) => ({ value: idx.name, label: idx.name })) || []}
                searchable
                clearable
                disabled={!!customTokenizer}
              />

              {selectedIndex && (
                <Select
                  label="Field"
                  placeholder="Select field"
                  value={selectedField}
                  onChange={(value) => setSelectedField(value || '')}
                  data={
                    fieldsData?.fields
                      .filter((f) => f.analyzer || f.type === 'text')
                      .map((f) => ({
                        value: f.name,
                        label: `${f.name} (${f.analyzer || 'default'})`,
                      })) || []
                  }
                  searchable
                  clearable
                />
              )}
            </Group>

            {/* Custom Analyzer Definition */}
            <Accordion variant="contained">
              <Accordion.Item value="custom">
                <Accordion.Control>
                  <Text size="sm" fw={500}>
                    Custom Analyzer Definition
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                      <Text size="sm">
                        Define a custom analyzer by specifying tokenizer and filters. This will
                        override the selected analyzer.
                      </Text>
                    </Alert>

                    <TextInput
                      label="Tokenizer"
                      placeholder="e.g., standard, whitespace, keyword"
                      value={customTokenizer}
                      onChange={(e) => setCustomTokenizer(e.currentTarget.value)}
                    />

                    <TextInput
                      label="Token Filters (comma-separated)"
                      placeholder="e.g., lowercase, stop, snowball"
                      value={customFilters}
                      onChange={(e) => setCustomFilters(e.currentTarget.value)}
                    />

                    <TextInput
                      label="Character Filters (comma-separated)"
                      placeholder="e.g., html_strip, mapping"
                      value={customCharFilters}
                      onChange={(e) => setCustomCharFilters(e.currentTarget.value)}
                    />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            <Group justify="flex-end">
              <Button
                leftSection={<IconSearch size={16} />}
                onClick={handleAnalyze}
                loading={analyzeMutation.isPending}
              >
                Analyze
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Results Section */}
        {analyzeMutation.data && (
          <Card shadow="sm" padding="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3}>Analysis Results</Title>
                <Badge size="lg" variant="light">
                  {analyzeMutation.data.tokens.length} tokens
                </Badge>
              </Group>

              {/* Analyzer Chain Info */}
              {(customTokenizer || customFilters || customCharFilters) && (
                <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      Analyzer Chain:
                    </Text>
                    {customCharFilters && (
                      <Text size="sm">
                        <strong>Char Filters:</strong> {customCharFilters}
                      </Text>
                    )}
                    {customTokenizer && (
                      <Text size="sm">
                        <strong>Tokenizer:</strong> {customTokenizer}
                      </Text>
                    )}
                    {customFilters && (
                      <Text size="sm">
                        <strong>Token Filters:</strong> {customFilters}
                      </Text>
                    )}
                  </Stack>
                </Alert>
              )}

              {/* Tokens Table */}
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Position</Table.Th>
                    <Table.Th>Token</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Start Offset</Table.Th>
                    <Table.Th>End Offset</Table.Th>
                    <Table.Th>Attributes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analyzeMutation.data.tokens.map((token: AnalysisToken, index: number) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Badge variant="light">{token.position}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Code>{token.token}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {token.type}
                        </Text>
                      </Table.Td>
                      <Table.Td>{token.startOffset}</Table.Td>
                      <Table.Td>{token.endOffset}</Table.Td>
                      <Table.Td>
                        {Object.entries(token)
                          .filter(
                            ([key]) =>
                              ![
                                'token',
                                'startOffset',
                                'endOffset',
                                'type',
                                'position',
                                'positionLength',
                              ].includes(key)
                          )
                          .map(([key, value]) => (
                            <Text key={key} size="xs" c="dimmed">
                              {key}: {JSON.stringify(value)}
                            </Text>
                          ))}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}

        {analyzeMutation.isPending && (
          <Card shadow="sm" padding="lg">
            <Group justify="center">
              <Loader size="lg" />
              <Text>Analyzing text...</Text>
            </Group>
          </Card>
        )}
      </Stack>
    </FullWidthContainer>
  );
}
