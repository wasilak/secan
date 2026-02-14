import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query client configuration
 * 
 * Handles server state management for API calls:
 * - Cluster health data
 * - Index information
 * - Node statistics
 * - etc.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
