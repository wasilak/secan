import { Alert, Collapse, Button, Code, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react';
import { ErrorDetails, formatErrorDetails, getUserFriendlyMessage } from '../lib/errorHandling';

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
  error: ErrorDetails | Error | unknown;
  title?: string;
  onDismiss?: () => void;
}

/**
 * ErrorDisplay component shows user-friendly error messages with expandable technical details
 *
 * Features:
 * - User-friendly error message
 * - Expandable technical details section
 * - Dismissible error alert
 * - Console logging for debugging
 *
 * Requirements: 29.6, 29.7
 */
export function ErrorDisplay({ error, title = 'Error', onDismiss }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Parse error into structured format
  const errorDetails: ErrorDetails =
    error instanceof Error
      ? {
          error: error.name,
          message: error.message,
          details: error.stack,
        }
      : typeof error === 'object' && error !== null && 'message' in error
        ? (error as ErrorDetails)
        : {
            error: 'unknown_error',
            message: String(error),
          };

  const userMessage = getUserFriendlyMessage(errorDetails);
  const technicalDetails = formatErrorDetails(errorDetails);

  return (
    <Alert
      icon={<IconAlertCircle size={18} />}
      title={title}
      color="red"
      withCloseButton={!!onDismiss}
      onClose={onDismiss}
    >
      <Stack gap="sm">
        <Text size="sm">{userMessage}</Text>

        {technicalDetails && (
          <>
            <Button
              variant="subtle"
              size="xs"
              leftSection={
                showDetails ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
              }
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} technical details
            </Button>

            <Collapse in={showDetails}>
              <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {technicalDetails}
              </Code>
            </Collapse>
          </>
        )}
      </Stack>
    </Alert>
  );
}

/**
 * Inline error display for smaller error messages
 */
export interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps) {
  return (
    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
      <Text size="sm">{message}</Text>
    </Alert>
  );
}
