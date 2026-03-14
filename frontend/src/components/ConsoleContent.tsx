import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
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
  Divider,
  Tabs,
} from '@mantine/core';
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
  IconPin,
  IconPinFilled,
  IconLayoutSidebarRight,
  IconLayoutSidebarRightFilled,
} from '@tabler/icons-react';
import { CodeEditor } from './CodeEditor';
import { apiClient } from '../api/client';
import { useConsoleHistory } from '../hooks/useConsoleHistory';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { RequestHistoryItem } from '../types/preferences';

/**
 * Example REST requests for common Elasticsearch operations
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
  let path = parts.slice(1).join(' ');

  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
  if (!validMethods.includes(method)) return null;

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const body = lines.slice(1).join('\n').trim();

  return {
    method,
    path,
    body: body || undefined,
  };
}

/**
 * Format response for display based on content type
 */
function formatResponse(
  data: unknown,
  contentType: string | null
): { text: string; language: string } {
  const isJson =
    contentType?.includes('application/json') ||
    contentType?.includes('application/vnd.elasticsearch+json');

  const looksLikeJson = typeof data === 'object' && data !== null;

  if (isJson || looksLikeJson) {
    try {
      return {
        text: JSON.stringify(data, null, 2),
        language: 'json',
      };
    } catch {
      return {
        text: String(data),
        language: 'plaintext',
      };
    }
  }

  return {
    text: String(data),
    language: 'plaintext',
  };
}

/**
 * Props for ConsoleContent component
 */
export interface ConsoleContentProps {
  /** Cluster ID for executing requests */
  clusterId: string;
}

/**
 * Imperative handle for ConsoleContent
 */
export interface ConsoleContentHandle {
  /** Get current request text */
  getRequest: () => string;
  /** Get current response text */
  getResponse: () => string;
  /** Set request text */
  setRequest: (request: string) => void;
  /** Get scroll position */
  getScrollPosition: () => number;
  /** Set scroll position */
  setScrollPosition: (position: number) => void;
}

/**
 * ConsoleContent component provides the REST console UI for the panel.
 *
 * Features:
 * - Monaco editor with syntax highlighting for request input
 * - Execute requests against selected cluster
 * - Display response with syntax highlighting
 * - Store requests in local storage via useConsoleHistory hook
 * - Display history in dedicated tab with timestamps
 * - Populate request from history selection
 * - Export/import request collections
 * - Keyboard shortcuts (Ctrl+Enter, Ctrl+L)
 *
 * Requirements: 1, 2, 13.x
 */
export const ConsoleContent = forwardRef<ConsoleContentHandle, ConsoleContentProps>(
  function ConsoleContent({ clusterId }, ref) {
    const { addEntry, getHistory, clearHistory: clearHistoryHook } = useConsoleHistory();
    const {
      isSticky,
      isDetached,
      setSticky,
      setDetached,
      currentRequest: savedRequest,
      currentResponse: savedResponse,
      scrollPosition: savedScrollPosition,
      setCurrentRequest: saveRequest,
      setCurrentResponse: saveResponse,
      setScrollPosition: saveScrollPosition,
    } = useConsolePanel();

    // Use persisted state from context, with defaults
    const [request, setRequestState] = useState<string>(savedRequest ?? 'GET _cluster/health');
    const [response, setResponseState] = useState<string>(savedResponse ?? '');
    const [responseLanguage, setResponseLanguage] = useState<string>('json');
    const [statusCode, setStatusCode] = useState<number | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const history = getHistory();

    // Restore scroll position on mount
    useEffect(() => {
      if (scrollAreaRef.current && savedScrollPosition) {
        scrollAreaRef.current.scrollTop = savedScrollPosition;
      }
    }, [savedScrollPosition]);

    // Wrap state setters to also persist to context
    const setRequest = useCallback(
      (value: string) => {
        setRequestState(value);
        saveRequest(value);
      },
      [saveRequest]
    );

    const setResponse = useCallback(
      (value: string) => {
        setResponseState(value);
        saveResponse(value);
      },
      [saveResponse]
    );

    // Track scroll position
    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        const position = event.currentTarget.scrollTop;
        saveScrollPosition(position);
      },
      [saveScrollPosition]
    );

    /**
     * Clear the request editor
     */
    const clearRequest = useCallback(() => {
      setRequest('');
      setResponse('');
      setStatusCode(null);
      setExecutionTime(null);
      setError(null);
    }, []);



    /**
     * Load an example request
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
     */
    const executeRequest = useCallback(async () => {
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

        const result = await apiClient.proxyRequest(
          clusterId,
          parsed.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH',
          parsed.path,
          bodyData
        );

        const endTime = performance.now();
        const timeTaken = endTime - startTime;

        const formatted = formatResponse(result.data, result.contentType);
        setResponse(formatted.text);
        setResponseLanguage(formatted.language);
        setStatusCode(200);
        setExecutionTime(timeTaken);

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
    }, [clusterId, request, addEntry]);

    /**
     * Load a request from history
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
     */
    const importHistory = useCallback(
      (file: File | null) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const imported = JSON.parse(content) as RequestHistoryItem[];

            if (!Array.isArray(imported)) {
              throw new Error('Invalid format: expected array');
            }

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
      },
      [addEntry]
    );

    /**
     * Expose imperative methods for state persistence
     */
    useImperativeHandle(ref, () => ({
      getRequest: () => request,
      getResponse: () => response,
      setRequest: (req: string) => {
        setRequestState(req);
        saveRequest(req);
      },
      getScrollPosition: () => scrollAreaRef.current?.scrollTop ?? 0,
      setScrollPosition: (position: number) => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = position;
        }
        saveScrollPosition(position);
      },
    }));

    /**
     * Keyboard shortcuts for REST Console
     */
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const isModifierPressed = event.ctrlKey || event.metaKey;

        if (!isModifierPressed) return;

        if (event.key === 'Enter') {
          event.preventDefault();
          executeRequest();
          return;
        }

        if (event.key === 'l' || event.key === 'L') {
          event.preventDefault();
          clearRequest();
          return;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [executeRequest, clearRequest]);

    return (
      <Stack gap="sm" h="100%">
        {/* Header */}
        <Group justify="space-between" px="sm" py="xs">
          <Text fw={600} size="sm">
            REST Console
          </Text>
          <Group gap="xs">
            {/* Detach/Attach button */}
            <Tooltip label={isDetached ? 'Attach to drawer' : 'Detach to modal'}>
              <ActionIcon
                variant={isDetached ? 'filled' : 'subtle'}
                size="sm"
                onClick={() => setDetached(!isDetached)}
              >
                {isDetached ? <IconLayoutSidebarRightFilled size={16} /> : <IconLayoutSidebarRight size={16} />}
              </ActionIcon>
            </Tooltip>
            
            {/* Pin button - only show when not detached */}
            {!isDetached && (
              <Tooltip label={isSticky ? 'Unpin console' : 'Pin console'}>
                <ActionIcon
                  variant={isSticky ? 'filled' : 'subtle'}
                  size="sm"
                  onClick={() => setSticky(!isSticky)}
                >
                  {isSticky ? <IconPinFilled size={16} /> : <IconPin size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        <Divider />

        {/* Tabs */}
        <Tabs defaultValue="request-response" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs.List>
            <Tabs.Tab value="request-response">Request & Response</Tabs.Tab>
            <Tabs.Tab value="history">History</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="request-response" style={{ flex: 1, overflow: 'auto', paddingTop: 'var(--mantine-spacing-sm)' }}>
            <Stack gap="sm">
              {/* Request section */}
              <Paper shadow="sm" p="xs" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={500} size="sm">
                    Request
                  </Text>
                  <Group gap="xs">
                    <CopyButton value={request} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : 'Copy request'}>
                          <ActionIcon
                            onClick={copy}
                            variant="subtle"
                            color={copied ? 'teal' : 'gray'}
                            size="sm"
                          >
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>

                    <Menu shadow="md" width={250} position="bottom-end">
                      <Menu.Target>
                        <Button leftSection={<IconBook size={14} />} variant="light" size="xs">
                          Examples
                        </Button>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Label>Common Operations</Menu.Label>
                        {EXAMPLE_REQUESTS.map((example) => (
                          <Menu.Item key={example.label} onClick={() => loadExample(example.request)}>
                            {example.label}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>

                    <Button
                      leftSection={<IconEraser size={14} />}
                      onClick={clearRequest}
                      variant="subtle"
                      size="xs"
                    >
                      Clear
                    </Button>

                    <Button
                      leftSection={<IconPlayerPlay size={14} />}
                      onClick={executeRequest}
                      loading={loading}
                      size="xs"
                    >
                      Execute
                    </Button>
                  </Group>
                </Group>

                <Text size="xs" c="dimmed" mb="xs">
                  Format: METHOD endpoint (e.g., GET _cluster/health)
                </Text>

                <CodeEditor
                  language="plaintext"
                  value={request}
                  onChange={(value) => setRequest(value || '')}
                  height="200px"
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
                  py="xs"
                >
                  {error}
                </Alert>
              )}

              {/* Response section */}
              <Paper shadow="sm" p="xs" withBorder style={{ flex: 1, minHeight: '300px' }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <Text fw={500} size="sm">
                      Response
                    </Text>
                    {statusCode !== null && (
                      <Badge
                        color={statusCode >= 200 && statusCode < 300 ? 'green' : 'red'}
                        variant="light"
                        size="sm"
                      >
                        {statusCode}
                      </Badge>
                    )}
                    {executionTime !== null && (
                      <Badge color="blue" variant="light" size="sm">
                        {executionTime.toFixed(0)}ms
                      </Badge>
                    )}
                  </Group>
                  {response && (
                    <CopyButton value={response} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : 'Copy response'}>
                          <ActionIcon
                            onClick={copy}
                            variant="subtle"
                            color={copied ? 'teal' : 'gray'}
                            size="sm"
                          >
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  )}
                </Group>

                <CodeEditor
                  language={responseLanguage}
                  value={response}
                  height="400px"
                  readOnly
                  options={{
                    wordWrap: 'off',
                    scrollbar: {
                      horizontal: 'auto',
                      vertical: 'auto',
                    },
                  }}
                />
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="history" style={{ flex: 1, overflow: 'auto', paddingTop: 'var(--mantine-spacing-sm)' }}>
            <Paper shadow="sm" p="xs" withBorder style={{ height: '100%' }}>
              <Group justify="space-between" mb="xs">
                <Text fw={500} size="sm">
                  History
                </Text>
                <Group gap="xs">
                  <FileButton onChange={importHistory} accept="application/json">
                    {(props) => (
                      <Tooltip label="Import">
                        <ActionIcon {...props} variant="subtle" size="sm">
                          <IconUpload size={14} />
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
                      <IconDownload size={14} />
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
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <ScrollArea h="calc(100% - 40px)" ref={scrollAreaRef} onScroll={handleScroll}>
                <Stack gap="xs">
                  {history.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
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
          </Tabs.Panel>
        </Tabs>
      </Stack>
    );
  }
);
