import { useState, useMemo } from 'react';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Select,
  Table,
  Loader,
  Alert,
  Badge,
  TextInput,
  Accordion,
  Code,
  ScrollArea,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconRefresh,
  IconSearch,
  IconHelp,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { FullWidthContainer } from '../components/FullWidthContainer';

/**
 * Cat API endpoint descriptions
 */
const CAT_ENDPOINT_DESCRIPTIONS: Record<string, string> = {
  aliases: 'Show alias information',
  allocation: 'Show shard allocation across nodes',
  count: 'Show document counts',
  fielddata: 'Show fielddata memory usage',
  health: 'Show cluster health',
  indices: 'Show index information',
  master: 'Show master node',
  nodeattrs: 'Show node attributes',
  nodes: 'Show node information',
  pending_tasks: 'Show pending cluster tasks',
  plugins: 'Show installed plugins',
  recovery: 'Show index recovery information',
  repositories: 'Show snapshot repositories',
  segments: 'Show segment information',
  shards: 'Show shard information',
  snapshots: 'Show snapshots',
  tasks: 'Show running tasks',
  templates: 'Show index templates',
  thread_pool: 'Show thread pool statistics',
};

/**
 * CatApi component provides access to Elasticsearch Cat APIs
 *
 * Features:
 * - List available Cat API endpoints
 * - Display responses in formatted table
 * - Support sorting by column
 * - Support filtering results
 * - Show help text for endpoints
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.7
 */
export function CatApiPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showHelp, setShowHelp] = useState(false);

  // Fetch available Cat API endpoints
  const { data: endpoints } = useQuery({
    queryKey: ['cluster', id, 'cat-endpoints'],
    queryFn: () => apiClient.getCatEndpoints(id!),
    enabled: !!id,
  });

  // Execute Cat API request
  const executeMutation = useMutation({
    mutationFn: (endpoint: string) => apiClient.executeCatApi(id!, endpoint),
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to execute Cat API: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Fetch help text for selected endpoint
  const { data: helpText } = useQuery({
    queryKey: ['cluster', id, 'cat-help', selectedEndpoint],
    queryFn: () => apiClient.getCatApiHelp(id!, selectedEndpoint),
    enabled: !!id && !!selectedEndpoint && showHelp,
  });

  const handleExecute = () => {
    if (!selectedEndpoint) {
      notifications.show({
        title: 'Error',
        message: 'Please select a Cat API endpoint',
        color: 'red',
      });
      return;
    }

    executeMutation.mutate(selectedEndpoint);
  };

  const handleReset = () => {
    setSelectedEndpoint('');
    setFilterText('');
    setSortColumn(null);
    setSortDirection('asc');
    setShowHelp(false);
    executeMutation.reset();
  };

  const handleToggleHelp = () => {
    setShowHelp(!showHelp);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with ascending direction
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get columns from response data
  const columns = useMemo(() => {
    if (!executeMutation.data || executeMutation.data.length === 0) {
      return [];
    }
    return Object.keys(executeMutation.data[0]);
  }, [executeMutation.data]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!executeMutation.data) {
      return [];
    }

    let data = [...executeMutation.data];

    // Apply filter
    if (filterText.trim()) {
      const lowerFilter = filterText.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((value) => String(value).toLowerCase().includes(lowerFilter))
      );
    }

    // Apply sort
    if (sortColumn) {
      data.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle numeric values
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Handle string values
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return data;
  }, [executeMutation.data, filterText, sortColumn, sortDirection]);

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
          <Title order={2}>Cat API</Title>
          <Text size="sm" c="dimmed">
            Access Elasticsearch Cat APIs for compact, human-readable cluster information
          </Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={handleReset}>
          Reset
        </Button>
      </Group>

      <Stack gap="md">
        {/* Endpoint Selection */}
        <Card shadow="sm" padding="lg">
          <Stack gap="md">
            <Select
              label="Cat API Endpoint"
              placeholder="Select an endpoint"
              value={selectedEndpoint}
              onChange={(value) => {
                setSelectedEndpoint(value || '');
                executeMutation.reset();
                setShowHelp(false);
              }}
              data={
                endpoints?.map((endpoint) => ({
                  value: endpoint,
                  label: `${endpoint} - ${CAT_ENDPOINT_DESCRIPTIONS[endpoint] || 'No description'}`,
                })) || []
              }
              searchable
              required
            />

            <Group justify="space-between">
              <Button
                leftSection={<IconHelp size={16} />}
                variant="light"
                onClick={handleToggleHelp}
                disabled={!selectedEndpoint}
              >
                {showHelp ? 'Hide Help' : 'Show Help'}
              </Button>

              <Button
                leftSection={<IconSearch size={16} />}
                onClick={handleExecute}
                loading={executeMutation.isPending}
                disabled={!selectedEndpoint}
              >
                Execute
              </Button>
            </Group>

            {/* Help Text */}
            {showHelp && selectedEndpoint && (
              <Accordion variant="contained">
                <Accordion.Item value="help">
                  <Accordion.Control>
                    <Text size="sm" fw={500}>
                      Help for {selectedEndpoint}
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {helpText ? (
                      <ScrollArea h={200}>
                        <Code block>{helpText}</Code>
                      </ScrollArea>
                    ) : (
                      <Group justify="center">
                        <Loader size="sm" />
                        <Text size="sm">Loading help text...</Text>
                      </Group>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            )}
          </Stack>
        </Card>

        {/* Results Section */}
        {executeMutation.data && executeMutation.data.length > 0 && (
          <Card shadow="sm" padding="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Group>
                  <Title order={3}>Results</Title>
                  <Badge size="lg" variant="light">
                    {filteredAndSortedData.length} rows
                  </Badge>
                </Group>

                <TextInput
                  placeholder="Filter results..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.currentTarget.value)}
                  w={300}
                  leftSection={<IconSearch size={16} />}
                />
              </Group>

              {/* Results Table */}
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {columns.map((column) => (
                        <Table.Th
                          key={column}
                          onClick={() => handleSort(column)}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          <Group gap="xs">
                            <Text size="sm" fw={500}>
                              {column}
                            </Text>
                            {sortColumn === column &&
                              (sortDirection === 'asc' ? (
                                <IconSortAscending size={14} />
                              ) : (
                                <IconSortDescending size={14} />
                              ))}
                          </Group>
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredAndSortedData.map((row, index) => (
                      <Table.Tr key={index}>
                        {columns.map((column) => (
                          <Table.Td key={column}>
                            {typeof row[column] === 'number' ? (
                              <Badge variant="light">{row[column]}</Badge>
                            ) : (
                              <Text size="sm">{String(row[column])}</Text>
                            )}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {filteredAndSortedData.length === 0 && filterText && (
                <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                  No results match the filter "{filterText}"
                </Alert>
              )}
            </Stack>
          </Card>
        )}

        {executeMutation.data && executeMutation.data.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            No data returned from the Cat API endpoint
          </Alert>
        )}

        {executeMutation.isPending && (
          <Card shadow="sm" padding="lg">
            <Group justify="center">
              <Loader size="lg" />
              <Text>Executing Cat API request...</Text>
            </Group>
          </Card>
        )}
      </Stack>
    </FullWidthContainer>
  );
}
