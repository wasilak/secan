import { useState, useCallback, useEffect } from 'react';
import {
  Title,
  Grid,
  Paper,
  Button,
  Group,
  Text,
  Stack,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Badge,
  FileButton,
  Alert,
  Menu,
  CopyButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import {
  IconPlayerPlay,
  IconTrash,
  IconDownload,
  IconUpload,
  IconClock,
  IconAlertCircle,
  IconBook,
  IconEraser,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import Editor from '@monaco-editor/react';
import { apiClient } from '../api/client';
import { useConsoleHistory } from '../hooks/useConsoleHistory';
import { RequestHistoryItem } from '../types/preferences';
import { FullWidthContainer } from '../components/FullWidthContainer';

/**
 * Example REST requests for common Elasticsearch operations
 * 
 * Requirements: 13.20
 */
const EXAMPLE_REQUESTS = [
  {
    label: 'Cluster Health',
    request: 'GET _cluster/health',
  },
  {
    label: 'Cluster Settings',
    request: 'GET _cluster/settings?include_defaults',
  },
  {
    label: 'List Indices',
    request: 'GET _cat/indices?v&h=index,pri,rep,store.size&s=index:asc',
  },
  {
    label: 'List Nodes',
    request: 'GET _cat/nodes?full_id=true&h=id,name&v&s=name:asc',
  },
  {
    label: 'Update Cluster Settings',
    request: `PUT _cluster/settings
{
  "persistent": {
    "cluster.routing.allocation.node_concurrent_recoveries": 5
  }
}`,
  },
  {
    label: 'Create Index',
    request: `POST my-index
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  }
}`,
  },
  {
    label: 'Update Index Settings (Wildcard)',
    request: `PUT service-live-2026.02.*/_settings
{
  "index": {
    "number_of_replicas": 1
  }
}`,
  },
  {
    label: 'Search Documents',
    request: `POST my-index/_search
{
  "query": {
    "match_all": {}
  }
}`,
  },
  {
    label: 'Rollover Index',
    request: 'POST ds-invalid-file/_rollover',
  },
];

/**
 * Parse REST console request format: "METHOD endpoint"
 * 
 * Supports formats like:
 * - GET _cat/nodes
 * - GET /_cat/nodes (with leading slash)
 * - POST _search
 * - PUT my-index
 * - GET _cluster/settings?include_defaults (with query params)
 * - PUT service-live-2026.02.WILDCARD/_settings (with wildcards)
 * 
 * Requirements: 13.3, 13.4, 13.21, 13.22, 13.23, 13.24
 */
function parseRequest(input: string): {
  method: string;
  path: string;
  body?: string;
} | null {
  const lines = input.trim().split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();
  const parts = firstLine.split(/\s+/);

  if (parts.length < 2) return null;

  const method = parts[0].toUpperCase();
  let path = parts.slice(1).join(' '); // Rejoin in case path has spaces (shouldn't, but be safe)

  // Valid HTTP methods
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
  if (!validMethods.includes(method)) return null;

  // Normalize path: ensure it starts with /
  // Support both /_cluster/settings and _cluster/settings formats
  // Preserve query parameters and wildcards
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Body is everything after the first line
  const body = lines.slice(1).join('\n').trim();

  return {
    method,
    path,
    body: body || undefined,
  };
}

/**
 * Format response for display based on content type
 * 
 * Handles JSON and plain text responses appropriately:
 * - JSON: Pretty-printed with 2-space indentation
 * - Plain text: Returned as-is without quotes
 */
function formatResponse(data: unknown, contentType: string | null): { text: string; language: string } {
  // Check if content-type indicates JSON
  const isJson = contentType?.includes('application/json') || contentType?.includes('application/vnd.elasticsearch+json');
  
  // Try to detect if data is JSON even without content-type header
  const looksLikeJson = typeof data === 'object' && data !== null;
  
  if (isJson || looksLikeJson) {
    try {
      return {
        text: JSON.stringify(data, null, 2),
        language: 'json',
      };
    } catch {
      // If JSON.stringify fails, treat as plain text
      return {
        text: String(data),
        language: 'plaintext',
      };
    }
  }
  
  // Plain text response - return as-is without quotes
  return {
    text: String(data),
    language: 'plaintext',
  };
}

/**
 * RestConsole component provides a Kibana-style console for executing REST requests.
 * 
 * Features:
 * - Monaco editor with syntax highlighting for request input
 * - Parse "METHOD endpoint" format
 * - Support request body editing
 * - Execute requests against selected cluster
 * - Display response with syntax highlighting
 * - Show status code and headers
 * - Store requests in local storage via useConsoleHistory hook
 * - Display history in sidebar with timestamps
 * - Populate request from history selection
 * - Limit history to configurable max entries (100)
 * - Support clearing history
 * - Export/import request collections
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10,
 *               13.11, 13.12, 13.13, 13.14, 13.15, 13.16, 13.17, 13.18, 13.19, 13.20
 */
export function RestConsole() {
  const { id } = useParams<{ id: string }>();
  const { addEntry, getHistory, clearHistory: clearHistoryHook } = useConsoleHistory();
  const { colorScheme } = useMantineColorScheme();

  const [request, setRequest] = useState<string>('GET _cluster/health');
  const [response, setResponse] = useState<string>('');
  const [responseLanguage, setResponseLanguage] = useState<string>('json');
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);

  // Get history from the hook
  const history = getHistory();

  /**
   * Clear the request editor
   * 
   * Requirements: 13.1
   */
  const clearRequest = useCallback(() => {
    setRequest('');
    setResponse('');
    setStatusCode(null);
    setExecutionTime(null);
    setError(null);
  }, []);

  /**
   * Toggle history panel visibility
   * 
   * Requirements: 13.17
   */
  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  /**
   * Load an example request
   * 
   * Requirements: 13.20
   */
  const loadExample = useCallback((exampleRequest: string) => {
    setRequest(exampleRequest);
    setResponse('');
    setStatusCode(null);
    setExecutionTime(null);
    setError(null);
  }, []);

  /**
   * Execute the REST request against the cluster
   * 
   * Requirements: 13.7, 13.8, 13.9, 13.10, 13.11
   */
  const executeRequest = useCallback(async () => {
    if (!id) return;

    const parsed = parseRequest(request);
    if (!parsed) {
      setError('Invalid request format. Use: METHOD endpoint');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse('');
    setResponseLanguage('json');
    setStatusCode(null);
    setExecutionTime(null);

    const startTime = performance.now();

    try {
      // Parse body as JSON if present
      let bodyData: unknown = undefined;
      if (parsed.body) {
        try {
          bodyData = JSON.parse(parsed.body);
        } catch {
          setError('Invalid JSON in request body');
          setLoading(false);
          return;
        }
      }

      // Execute request via proxy - now returns data and contentType
      const result = await apiClient.proxyRequest(
        id,
        parsed.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH',
        parsed.path,
        bodyData
      );

      const endTime = performance.now();
      const timeTaken = endTime - startTime;

      // Format and display response based on content type
      const formatted = formatResponse(result.data, result.contentType);
      setResponse(formatted.text);
      setResponseLanguage(formatted.language);
      setStatusCode(200); // Successful response
      setExecutionTime(timeTaken);

      // Add to history using the hook (Requirements: 13.11, 13.14, 13.15)
      // The hook will handle deduplication
      addEntry({
        method: parsed.method,
        path: parsed.path,
        body: parsed.body,
        response: formatted.text,
      });

      notifications.show({
        title: 'Success',
        message: `Request executed in ${timeTaken.toFixed(0)}ms`,
        color: 'green',
      });
    } catch (err) {
      const endTime = performance.now();
      const timeTaken = endTime - startTime;
      
      const error = err as { message?: string; status?: number };
      const errorMessage = error.message || 'Request failed';
      setError(errorMessage);
      setStatusCode(error.status || 0);
      setResponse(errorMessage);
      setResponseLanguage('plaintext');
      setExecutionTime(timeTaken);

      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [id, request, addEntry]);

  /**
   * Load a request from history
   * 
   * Requirements: 13.12, 13.13
   */
  const loadFromHistory = useCallback((item: RequestHistoryItem) => {
    const requestText = item.body
      ? `${item.method} ${item.path}\n${item.body}`
      : `${item.method} ${item.path}`;
    
    setRequest(requestText);
    
    if (item.response) {
      setResponse(item.response);
    }
  }, []);

  /**
   * Clear request history
   * 
   * Requirements: 13.16
   */
  const clearHistory = useCallback(() => {
    clearHistoryHook();
    notifications.show({
      title: 'History Cleared',
      message: 'Request history has been cleared',
      color: 'blue',
    });
  }, [clearHistoryHook]);

  /**
   * Export request collections to JSON
   * 
   * Requirements: 13.20
   */
  const exportHistory = useCallback(() => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secan-rest-history-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'Exported',
      message: 'Request history exported successfully',
      color: 'green',
    });
  }, [history]);

  /**
   * Import request collections from JSON
   * 
   * Requirements: 13.20
   */
  const importHistory = useCallback((file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content) as RequestHistoryItem[];
        
        // Validate imported data
        if (!Array.isArray(imported)) {
          throw new Error('Invalid format: expected array');
        }

        // Add each imported item to history
        // The hook will handle limiting to max entries
        imported.forEach((item) => {
          addEntry({
            method: item.method,
            path: item.path,
            body: item.body,
            response: item.response,
          });
        });

        notifications.show({
          title: 'Imported',
          message: `Imported ${imported.length} requests`,
          color: 'green',
        });
      } catch (err) {
        const error = err as { message?: string };
        notifications.show({
          title: 'Import Failed',
          message: error.message || 'Failed to import history',
          color: 'red',
        });
      }
    };
    reader.readAsText(file);
  }, [addEntry]);

  /**
   * Keyboard shortcuts for REST Console
   * 
   * Ctrl+Enter / Cmd+Enter: Execute request
   * Ctrl+L / Cmd+L: Clear request editor
   * Ctrl+H / Cmd+H: Toggle history panel
   * 
   * Requirements: 13.17
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl (Windows/Linux) or Cmd (Mac)
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (!isModifierPressed) return;

      // Ctrl+Enter / Cmd+Enter: Execute request
      if (event.key === 'Enter') {
        event.preventDefault();
        executeRequest();
        return;
      }

      // Ctrl+L / Cmd+L: Clear request editor
      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        clearRequest();
        return;
      }

      // Ctrl+H / Cmd+H: Toggle history panel
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        toggleHistory();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeRequest, clearRequest, toggleHistory]);

  return (
    <FullWidthContainer>
      <Title order={2} mb="md">
        REST Console - Cluster: {id}
      </Title>

      <Text size="sm" c="dimmed" mb="md">
        Keyboard shortcuts: Ctrl+Enter (Execute) • Ctrl+L (Clear) • Ctrl+H (Toggle History)
      </Text>

      <Grid gutter="md">
        {/* Main editor area */}
        <Grid.Col span={{ base: 12, md: showHistory ? 8 : 12 }}>
          <Stack gap="md">
            {/* Request editor */}
            <Paper shadow="sm" p="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={500}>Request</Text>
                <Group gap="xs">
                  <CopyButton value={request} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied!' : 'Copy request'}>
                        <ActionIcon onClick={copy} variant="subtle" color={copied ? 'teal' : 'gray'}>
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>

                  <Menu shadow="md" width={250}>
                    <Menu.Target>
                      <Button
                        leftSection={<IconBook size={16} />}
                        variant="light"
                        size="sm"
                      >
                        Examples
                      </Button>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Label>Common Operations</Menu.Label>
                      {EXAMPLE_REQUESTS.map((example) => (
                        <Menu.Item
                          key={example.label}
                          onClick={() => loadExample(example.request)}
                        >
                          {example.label}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>

                  <Button
                    leftSection={<IconEraser size={16} />}
                    onClick={clearRequest}
                    variant="subtle"
                    size="sm"
                  >
                    Clear
                  </Button>

                  <Button
                    leftSection={<IconPlayerPlay size={16} />}
                    onClick={executeRequest}
                    loading={loading}
                    size="sm"
                  >
                    Execute
                  </Button>
                </Group>
              </Group>
              
              <Text size="xs" c="dimmed" mb="xs">
                Format: METHOD endpoint (e.g., GET _cluster/health)
              </Text>

              <Editor
                height="200px"
                defaultLanguage="plaintext"
                value={request}
                onChange={(value) => setRequest(value || '')}
                theme={colorScheme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            </Paper>

            {/* Error display */}
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Error"
                color="red"
                withCloseButton
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            {/* Response display */}
            <Paper shadow="sm" p="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text fw={500}>Response</Text>
                  {statusCode !== null && (
                    <Badge
                      color={statusCode >= 200 && statusCode < 300 ? 'green' : 'red'}
                      variant="light"
                    >
                      {statusCode}
                    </Badge>
                  )}
                  {executionTime !== null && (
                    <Badge color="blue" variant="light">
                      {executionTime.toFixed(0)}ms
                    </Badge>
                  )}
                </Group>
                {response && (
                  <CopyButton value={response} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied!' : 'Copy response'}>
                        <ActionIcon onClick={copy} variant="subtle" color={copied ? 'teal' : 'gray'}>
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                )}
              </Group>

              <Editor
                height="400px"
                defaultLanguage="json"
                language={responseLanguage}
                value={response}
                theme={colorScheme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'off',
                  scrollbar: {
                    horizontal: 'auto',
                    vertical: 'auto',
                  },
                }}
              />
            </Paper>
          </Stack>
        </Grid.Col>

        {/* History sidebar */}
        {showHistory && (
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper shadow="sm" p="md" withBorder>
              <Group justify="space-between" mb="md">
                <Text fw={500}>History</Text>
                <Group gap="xs">
                  <FileButton onChange={importHistory} accept="application/json">
                    {(props) => (
                      <Tooltip label="Import">
                        <ActionIcon {...props} variant="subtle" size="sm">
                          <IconUpload size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </FileButton>
                  
                  <Tooltip label="Export">
                    <ActionIcon
                      onClick={exportHistory}
                      variant="subtle"
                      size="sm"
                      disabled={history.length === 0}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="Clear History">
                    <ActionIcon
                      onClick={clearHistory}
                      variant="subtle"
                      size="sm"
                      color="red"
                      disabled={history.length === 0}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <ScrollArea h={600}>
                <Stack gap="xs">
                  {history.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      No history yet
                    </Text>
                  ) : (
                    history.map((item, index) => (
                      <Paper
                        key={index}
                        p="xs"
                        withBorder
                        onClick={() => loadFromHistory(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Group justify="space-between" gap="xs">
                          <Badge size="sm" variant="light">
                            {item.method}
                          </Badge>
                          <Group gap={4}>
                            <IconClock size={12} />
                            <Text size="xs" c="dimmed">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </Text>
                          </Group>
                        </Group>
                        <Text size="sm" mt={4} lineClamp={1}>
                          {item.path}
                        </Text>
                      </Paper>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Paper>
          </Grid.Col>
        )}
      </Grid>
    </FullWidthContainer>
  );
}
