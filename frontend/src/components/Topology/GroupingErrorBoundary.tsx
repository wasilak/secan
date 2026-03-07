import { Component, type ReactNode } from 'react';
import { Alert, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

/**
 * Props for GroupingErrorBoundary component
 */
interface GroupingErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback UI to display on error */
  fallback?: ReactNode;
}

/**
 * State for GroupingErrorBoundary component
 */
interface GroupingErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught */
  error: Error | null;
}

/**
 * Error boundary component for grouping features
 * 
 * Catches errors in grouping components and displays a fallback UI
 * instead of crashing the entire topology view.
 * 
 * **Validates: Requirements 4.5**
 * 
 * @example
 * ```tsx
 * <GroupingErrorBoundary>
 *   <GroupingControl {...props} />
 * </GroupingErrorBoundary>
 * ```
 */
export class GroupingErrorBoundary extends Component<
  GroupingErrorBoundaryProps,
  GroupingErrorBoundaryState
> {
  constructor(props: GroupingErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): GroupingErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('Grouping component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Grouping Error"
          color="red"
          variant="light"
        >
          <Text size="sm">
            An error occurred while rendering the grouping controls.
            The topology view will display without grouping.
          </Text>
          {this.state.error && (
            <Text size="xs" c="dimmed" mt="xs">
              {this.state.error.message}
            </Text>
          )}
        </Alert>
      );
    }

    return this.props.children;
  }
}
