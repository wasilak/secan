import React from 'react';
import type { ReactElement } from 'react';
import { Box, Group, Stack, CopyButton, Tooltip, Button, useMantineColorScheme } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import Editor from '@monaco-editor/react';

/**
 * Common Monaco editor options used across the application
 */
export const MONACO_COMMON_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on' as const,
};

/**
 * Props for CodeEditor component
 */
interface CodeEditorProps {
  /** The code/text value to display */
  value: string;
  /** Callback when value changes (required for editable mode) */
  onChange?: (value: string | undefined) => void;
  /** Programming language for syntax highlighting (default: 'json') */
  language?: string;
  /** Height of the editor (default: '400px') */
  height?: string | number;
  /** Whether the editor is read-only (default: false) */
  readOnly?: boolean;
  /** Whether to show the copy button (default: false) */
  showCopyButton?: boolean;
  /** Whether to show border around editor (default: true) */
  showBorder?: boolean;
  /** Optional title displayed above the editor */
  title?: string;
  /** Optional custom className */
  className?: string;
  /** Additional Monaco editor options to override defaults */
  options?: Record<string, unknown>;
}

/**
 * CodeEditor component
 *
 * A reusable Monaco editor wrapper with consistent styling and theme support.
 * Provides a "dumb" presentation component that handles UI rendering only.
 * Parent components are responsible for save buttons, API calls, and validation.
 *
 * Features:
 * - Automatic theme switching (dark/light)
 * - Consistent styling across the app
 * - Optional copy button
 * - Configurable language and height
 * - Read-only or editable mode
 * - Common Monaco options pre-configured
 *
 * @example
 * // Editable JSON editor
 * <CodeEditor
 *   language="json"
 *   value={settings}
 *   onChange={setSettings}
 *   height="500px"
 *   showCopyButton
 * />
 *
 * @example
 * // Read-only plaintext editor
 * <CodeEditor
 *   language="plaintext"
 *   value={response}
 *   height="300px"
 *   readOnly
 *   showCopyButton
 * />
 */
export function CodeEditor({
  value,
  onChange,
  language = 'json',
  height = '400px',
  readOnly = false,
  showCopyButton = false,
  showBorder = true,
  title,
  className,
  options = {},
}: CodeEditorProps): ReactElement {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Merge common options with custom options
  const editorOptions = {
    ...MONACO_COMMON_OPTIONS,
    readOnly,
    ...options,
  };

  return (
    <Stack gap="sm" className={className}>
      {(title || showCopyButton) && (
        <Group justify="space-between">
          {title && (
            <h3 style={{ margin: 0, fontSize: 'var(--mantine-font-size-md)', fontWeight: 500 }}>
              {title}
            </h3>
          )}
          {showCopyButton && (
            <CopyButton value={value} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied!' : 'Copy code'} withArrow position="left">
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

      <Box
        style={{
          border: showBorder ? '1px solid var(--mantine-color-gray-4)' : 'none',
          borderRadius: showBorder ? 'var(--mantine-radius-sm)' : 0,
          overflow: 'hidden',
        }}
      >
        <Editor
          height={height}
          language={language}
          value={value}
          onChange={onChange}
          theme={isDark ? 'vs-dark' : 'light'}
          options={editorOptions}
        />
      </Box>
    </Stack>
  );
}
