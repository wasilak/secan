import { ListPageSkeleton } from './LoadingSkeleton';
import { ErrorAlert } from './ErrorAlert';
import { getErrorMessage } from '../lib/errorHandling';

interface PageSkeletonProps {
  isLoading: boolean;
  error?: unknown;
  missingId?: boolean;
  children: React.ReactNode;
}

export function PageSkeleton({ isLoading, error, missingId, children }: PageSkeletonProps) {
  if (isLoading) {
    return <ListPageSkeleton />;
  }

  if (missingId) {
    return <ErrorAlert message="Cluster ID is required" />;
  }

  if (error) {
    return <ErrorAlert message={getErrorMessage(error)} />;
  }

  return <>{children}</>;
}
