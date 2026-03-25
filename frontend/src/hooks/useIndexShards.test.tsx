import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIndexShards } from './useIndexShards';
import { apiClient } from '../api/client';
import { ShardInfo } from '../types/api';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    getShards: vi.fn(),
  },
}));

describe('useIndexShards', () => {
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

  it('should fetch and return shards for a specific index', async () => {
    const mockShards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 5000000,
      },
      {
        index: 'test-index',
        shard: 0,
        primary: false,
        state: 'STARTED',
        node: 'node-2',
        docs: 1000,
        store: 5000000,
      },
    ];

    vi.mocked(apiClient.getShards).mockResolvedValue({
      items: mockShards,
      total: 2,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    });

    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'test-index'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockShards);
    expect(apiClient.getShards).toHaveBeenCalledWith('cluster-1', 1, 1000, {
      index: 'test-index',
    });
  });

  it('should handle empty shard arrays', async () => {
    vi.mocked(apiClient.getShards).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 1000,
      totalPages: 0,
    });

    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'empty-index'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(result.current.data?.length).toBe(0);
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch shards';
    vi.mocked(apiClient.getShards).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'test-index'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe(errorMessage);
  });

  it('should not fetch when clusterId is undefined', () => {
    const { result } = renderHook(
      () => useIndexShards(undefined, 'test-index'),
      { wrapper }
    );

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.getShards).not.toHaveBeenCalled();
  });

  it('should not fetch when indexName is undefined', () => {
    const { result } = renderHook(
      () => useIndexShards('cluster-1', undefined),
      { wrapper }
    );

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.getShards).not.toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'test-index', 30000, false),
      { wrapper }
    );

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.getShards).not.toHaveBeenCalled();
  });

  it('should use custom refresh interval', async () => {
    const mockShards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 5000000,
      },
    ];

    vi.mocked(apiClient.getShards).mockResolvedValue({
      items: mockShards,
      total: 1,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    });

    const customInterval = 60000;
    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'test-index', customInterval),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should handle shards with different states', async () => {
    const mockShards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 5000000,
      },
      {
        index: 'test-index',
        shard: 1,
        primary: true,
        state: 'INITIALIZING',
        node: 'node-2',
        docs: 0,
        store: 0,
      },
      {
        index: 'test-index',
        shard: 2,
        primary: true,
        state: 'RELOCATING',
        node: 'node-1',
        relocatingNode: 'node-3',
        docs: 500,
        store: 2500000,
      },
      {
        index: 'test-index',
        shard: 3,
        primary: true,
        state: 'UNASSIGNED',
        docs: 0,
        store: 0,
      },
    ];

    vi.mocked(apiClient.getShards).mockResolvedValue({
      items: mockShards,
      total: 4,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    });

    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'test-index'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockShards);
    expect(result.current.data?.length).toBe(4);
    
    // Verify all shard states are present
    const states = result.current.data?.map(s => s.state);
    expect(states).toContain('STARTED');
    expect(states).toContain('INITIALIZING');
    expect(states).toContain('RELOCATING');
    expect(states).toContain('UNASSIGNED');
  });

  it('should handle shards with missing optional fields', async () => {
    const mockShards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'UNASSIGNED',
        // node is undefined for unassigned shards
        docs: 0,
        store: 0,
      },
    ];

    vi.mocked(apiClient.getShards).mockResolvedValue({
      items: mockShards,
      total: 1,
      page: 1,
      pageSize: 1000,
      totalPages: 1,
    });

    const { result } = renderHook(
      () => useIndexShards('cluster-1', 'test-index'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockShards);
    expect(result.current.data?.[0].node).toBeUndefined();
  });
});
