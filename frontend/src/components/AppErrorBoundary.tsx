import React from 'react';
import { Alert, Button, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  /** Title shown in the error alert. Defaults to "Something went wrong". */
  fallbackTitle?: string;
  /** Optional callback invoked when the user clicks the reset button. Defaults to page reload. */
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React class component error boundary.
 *
 * Catches runtime errors thrown by any child component and renders a Mantine
 * Alert fallback with a "Reload page" button instead of crashing the whole UI.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Caught error:', error, info.componentStack);
  }

  private handleReset = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { fallbackTitle = 'Something went wrong' } = this.props;
      const message = this.state.error?.message ?? 'An unexpected error occurred.';

      return (
        <Stack p="md">
          <Alert
            color="red"
            title={fallbackTitle}
            icon={<IconAlertCircle />}
          >
            {message}
          </Alert>
          <Button color="red" variant="outline" onClick={this.handleReset}>
            Reload page
          </Button>
        </Stack>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
