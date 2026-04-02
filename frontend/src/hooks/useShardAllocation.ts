import { useMutationWithNotification } from './useMutationWithNotification';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { useQueryClient } from '@tanstack/react-query';

export type AllocationMode = 'all' | 'primaries' | 'new_primaries' | 'none';

interface ShardAllocationResult {
  enableAllocation: (options?: { onSuccess?: () => void }) => void;
  disableAllocation: (mode: AllocationMode, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
}

export function useShardAllocation(clusterId: string): ShardAllocationResult {
  const queryClient = useQueryClient();

  const enableAllocationMutation = useMutationWithNotification<
    void,
    unknown,
    void
  >({
    mutationFn: async () => {
      await apiClient.proxyRequest(clusterId, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': 'all',
        },
      });
    },
    successTitle: 'Success',
    successMessage: 'Shard allocation enabled',
    errorTitle: 'Failed to enable shard allocation',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(clusterId).settings() });
    },
  });

  const disableAllocationMutation = useMutationWithNotification<
    void,
    unknown,
    AllocationMode
  >({
    mutationFn: async (mode) => {
      await apiClient.proxyRequest(clusterId, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': mode,
        },
      });
    },
    successTitle: 'Success',
    successMessage: 'Shard allocation disabled',
    errorTitle: 'Failed to disable shard allocation',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(clusterId).settings() });
    },
  });

  return {
    enableAllocation: (options) => enableAllocationMutation.mutate(undefined, options),
    disableAllocation: (mode: AllocationMode, options) => disableAllocationMutation.mutate(mode, options),
    isPending: enableAllocationMutation.isPending || disableAllocationMutation.isPending,
  };
}
