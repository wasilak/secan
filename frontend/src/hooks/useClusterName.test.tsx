import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClusterName } from './useClusterName';
import { apiClient } from '../api/client';
import type { ClusterInfo, ClusterStats } from '../types/api';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    getClusters: vi.fn(),
    getClusterStats: vi.fn(),
  },
}));

describe('useClusterName', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should use cluster name when no config name override exists', async () => {
    const mockClusters: ClusterInfo[] = [
      {
        id: 'test-cluster',
        name: 'test-cluster',
        nodes: [],
        accessible: true,
      },
    ];

    const mockStats: ClusterStats = {
      health: 'green',
      clusterName: 'my-elasticsearch-cluster',
      numberOfNodes: 3,
      numberOfDataNodes: 2,
      numberOfIndices: 10,
      numberOfDocuments: 1000,
      activePrimaryShards: 5,
      activeShards: 10,
      relocatingShards: 0,
      initializingShards: 0,
      unassignedShards: 0,
    };

    vi.mocked(apiClient.getClusters).mockResolvedValue(mockClusters);
    vi.mocked(apiClient.getClusterStats).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useClusterName('test-cluster'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe('my-elasticsearch-cluster');
    });
  });

  it('should use config name when it differs from cluster name', async () => {
    const mockClusters: ClusterInfo[] = [
      {
        id: 'test-cluster',
        name: 'Production Cluster',
        nodes: [],
        accessible: true,
      },
    ];

    const mockStats: ClusterStats = {
      health: 'green',
      clusterName: 'my-elasticsearch-cluster',
      numberOfNodes: 3,
      numberOfDataNodes: 2,
      numberOfIndices: 10,
      numberOfDocuments: 1000,
      activePrimaryShards: 5,
      activeShards: 10,
      relocatingShards: 0,
      initializingShards: 0,
      unassignedShards: 0,
    };

    vi.mocked(apiClient.getClusters).mockResolvedValue(mockClusters);
    vi.mocked(apiClient.getClusterStats).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useClusterName('test-cluster'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe('Production Cluster');
    });
  });

  it('should fall back to cluster ID when data is not yet loaded', () => {
    vi.mocked(apiClient.getClusters).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(apiClient.getClusterStats).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useClusterName('test-cluster'), { wrapper });

    expect(result.current).toBe('test-cluster');
  });

  it('should use config name if cluster stats not yet loaded', async () => {
    const mockClusters: ClusterInfo[] = [
      {
        id: 'test-cluster',
        name: 'Production Cluster',
        nodes: [],
        accessible: true,
      },
    ];

    vi.mocked(apiClient.getClusters).mockResolvedValue(mockClusters);
    vi.mocked(apiClient.getClusterStats).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useClusterName('test-cluster'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe('Production Cluster');
    });
  });

  it('should use cluster name if config name matches cluster name', async () => {
    const mockClusters: ClusterInfo[] = [
      {
        id: 'test-cluster',
        name: 'my-elasticsearch-cluster',
        nodes: [],
        accessible: true,
      },
    ];

    const mockStats: ClusterStats = {
      health: 'green',
      clusterName: 'my-elasticsearch-cluster',
      numberOfNodes: 3,
      numberOfDataNodes: 2,
      numberOfIndices: 10,
      numberOfDocuments: 1000,
      activePrimaryShards: 5,
      activeShards: 10,
      relocatingShards: 0,
      initializingShards: 0,
      unassignedShards: 0,
    };

    vi.mocked(apiClient.getClusters).mockResolvedValue(mockClusters);
    vi.mocked(apiClient.getClusterStats).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useClusterName('test-cluster'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe('my-elasticsearch-cluster');
    });
  });
});
