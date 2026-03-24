import { LoadingOverlay } from '@mantine/core';
import { ErrorAlert } from './ErrorAlert';

interface PageSkeletonProps {
  isLoading: boolean;
  error?: unknown;
  missingId?: boolean;
  children: React.ReactNode;
}

export function PageSkeleton({ isLoading, error, missingId, children }: PageSkeletonProps) {
  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (missingId) {
    return <ErrorAlert message="Cluster ID is required" />;
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return <ErrorAlert message={errorMessage} />;
  }

  return <>{children}</>;
}
