import { Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export interface ErrorAlertProps {
  title?: string;
  message: string;
  color?: string;
}

/**
 * Reusable error alert component
 * Used for displaying error messages consistently across the application
 */
export function ErrorAlert({ title = 'Error', message, color = 'red' }: ErrorAlertProps) {
  return (
    <Alert icon={<IconAlertCircle size={16} />} title={title} color={color}>
      {message}
    </Alert>
  );
}
