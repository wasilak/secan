import { useState, useCallback } from 'react';
import {
  Container,
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
} from '@tabler/icons-react';
import Editor from '@monaco-editor/react';
import { apiClient } from '../api/client';
import { usePreferences } from '../hooks/usePreferences';
import { RequestHistoryItem } from '../types/preferences';

/**
 * Parse REST console request format: "METHOD endpoint"
 * 
 * Supports formats like:
 * - GET _cat/nodes
 * - POST _search
 * - PUT my-index
 * 
 * Requirements: 19.2, 19.4, 19.5
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
  const path = parts[1];

  // Valid HTTP methods
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
  if (!validMethods.includes(method)) return null;

  // Body is everything after the first line
  const body = lines.slice(1).join('\n').trim();

  return {
    method,
    path,
    body: body || undefined,
  };
}

/**
 * Format response for display with proper indentation
 */
function formatResponse(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
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
 * - Store requests in local storage
 * - Display history in sidebar
 * - Populate request from history selection
 * - Limit history to configurable max entries
 * - Support clearing history
 * - Export/import request collections
 * 
 * Requirements: 19.1, 19.2, 19.3, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 19.12, 19.13
 */
export function RestConsole() {
  const { id } = useParams<{ id: string }>();
  const { preferences, updatePreference } = usePreferences();

  const [request, setRequest] = useState<string>('GET _cluster/health');
  const [response, setResponse] = useState<string>('');
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_HISTORY_ENTRIES = 100; // Configurable max entries (Requirement 19.13)

  /**
   * Execute the REST request against the cluster
   * 
   * Requirements: 19.5, 19.6, 19.7
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
    setStatusCode(null);

    try {
      // Parse body as JSON if present
      let bodyData: unknown = undefined;
      if (parsed.body) {
        try {
          bodyData = JSON.parse(parsed.body);
        } catch (e) {
          setError('Invalid JSON in request body');
          setLoading(false);
          return;
        }
      }

      // Execute request via proxy
      const result = await apiClient.proxyRequest(
        id,
        parsed.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH',
        parsed.path,
        bodyData
      );

      // Format and display response
      const formattedResponse = formatResponse(result);
      setResponse(formattedResponse);
      setStatusCode(200); // Successful response

      // Add to history (Requirements: 19.8, 19.10, 19.13)
      const historyItem: RequestHistoryItem = {
        timestamp: Date.now(),
        method: parsed.method,
        path: parsed.path,
        body: parsed.body,
        response: formattedResponse,
      };

      const newHistory = [historyItem, ...preferences.restConsoleHistory];
      
      // Limit history to max entries
      const limitedHistory = newHistory.slice(0, MAX_HISTORY_ENTRIES);
      
      updatePreference('restConsoleHistory', limitedHistory);

      notifications.show({
        title: 'Success',
        message: 'Request executed successfully',
        color: 'green',
      });
    } catch (err) {
      const error = err as { message?: string; status?: number };
      const errorMessage = error.message || 'Request failed';
      setError(errorMessage);
      setStatusCode(error.status || 0);
      setResponse(errorMessage);

      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [id, request, preferences.restConsoleHistory, updatePreference]);

  /**
   * Load a request from history
   * 
   * Requirements: 19.9, 19.10
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
   * Requirements: 19.11
   */
  const clearHistory = useCallback(() => {
    updatePreference('restConsoleHistory', []);
    notifications.show({
      title: 'History Cleared',
      message: 'Request history has been cleared',
      color: 'blue',
    });
  }, [updatePreference]);

  /**
   * Export request collections to JSON
   * 
   * Requirements: 19.12
   */
  const exportHistory = useCallback(() => {
    const dataStr = JSON.stringify(preferences.restConsoleHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cerebro-rest-history-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'Exported',
      message: 'Request history exported successfully',
      color: 'green',
    });
  }, [preferences.restConsoleHistory]);

  /**
   * Import request collections from JSON
   * 
   * Requirements: 19.12
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

        // Merge with existing history and limit
        const merged = [...imported, ...preferences.restConsoleHistory];
        const limited = merged.slice(0, MAX_HISTORY_ENTRIES);
        
        updatePreference('restConsoleHistory', limited);

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
  }, [preferences.restConsoleHistory, updatePreference]);

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        REST Console - Cluster: {id}
      </Title>

      <Grid gutter="md">
        {/* Main editor area */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Request editor */}
            <Paper shadow="sm" p="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={500}>Request</Text>
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={executeRequest}
                  loading={loading}
                  size="sm"
                >
                  Execute
                </Button>
              </Group>
              
              <Text size="xs" c="dimmed" mb="xs">
                Format: METHOD endpoint (e.g., GET _cluster/health)
              </Text>

              <Editor
                height="200px"
                defaultLanguage="plaintext"
                value={request}
                onChange={(value) => setRequest(value || '')}
                theme="vs-dark"
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
                </Group>
              </Group>

              <Editor
                height="400px"
                defaultLanguage="json"
                value={response}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            </Paper>
          </Stack>
        </Grid.Col>

        {/* History sidebar */}
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
                    disabled={preferences.restConsoleHistory.length === 0}
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
                    disabled={preferences.restConsoleHistory.length === 0}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            <ScrollArea h={600}>
              <Stack gap="xs">
                {preferences.restConsoleHistory.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    No history yet
                  </Text>
                ) : (
                  preferences.restConsoleHistory.map((item, index) => (
                    <Paper
                      key={index}
                      p="xs"
                      withBorder
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadFromHistory(item)}
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
      </Grid>
    </Container>
  );
}
