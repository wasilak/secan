import React from 'react';
import type { ReactElement } from 'react';
import { Box, Button, Group, Stack, CopyButton, Tooltip, Alert, useMantineColorScheme } from '@mantine/core';
import { IconCopy, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import Editor from '@monaco-editor/react';

/**
 * Props for JsonViewer component
 */
interface JsonViewerProps {
  /** The JSON data to display */
  data: unknown;
  /** Optional title for the viewer */
  title?: string;
  /** Optional height of the editor (default: 400px) */
  height?: string | number;
  /** Optional custom className */
  className?: string;
  /** Whether to show copy button (default: true) */
  showCopyButton?: boolean;
  /** Optional error message to display */
  error?: string | null;
  /** Optional loading state */
  isLoading?: boolean;
}

/**
 * JsonViewer component
 *
 * Displays JSON data in a Monaco editor with syntax highlighting and copy button.
 * Provides a read-only, formatted view of JSON with full-featured editor capabilities.
 *
 * Features:
 * - Syntax highlighting
 * - Copy to clipboard button
 * - Error handling
 * - Loading state
 * - Configurable height
 * - Pretty-printed JSON
 */
export function JsonViewer({
  data,
  title,
  height = 400,
  className,
  showCopyButton = true,
  error,
  isLoading,
}: JsonViewerProps): ReactElement {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
  const jsonString = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '{}';
    }
  }, [data]);

  return (
    <Stack gap="sm" className={className}>
      {title && (
        <Group justify="space-between">
          <h3 style={{ margin: 0 }}>{title}</h3>
          {showCopyButton && (
            <CopyButton value={jsonString} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied!' : 'Copy JSON'} withArrow position="left">
                  <Button
                    color={copied ? 'green' : 'blue'}
                    variant="light"
                    size="xs"
                    onClick={copy}
                    leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </Tooltip>
              )}
            </CopyButton>
          )}
        </Group>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      <Box
        style={{
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
        }}
      >
        <Editor
          height={height}
          language="json"
          value={jsonString}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            formatOnPaste: false,
            formatOnType: false,
            fontSize: 12,
            lineNumbersMinChars: 3,
            folding: true,
            foldingStrategy: 'indentation',
          }}
          loading={isLoading ? 'Loading...' : undefined}
          theme={isDark ? 'vs-dark' : 'light'}
        />
      </Box>
    </Stack>
  );
}
