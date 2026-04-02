import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNodes } from './useNodes';
import { apiClient } from '../api/client';
import { NodeInfo } from '../types/api';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    getNodes: vi.fn(),
  },
}));

describe('useNodes', () => {
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

  it('should fetch and return nodes for a cluster', async () => {
    const mockNodes: NodeInfo[] = [
      {
        id: 'node-1',
        name: 'node-1-name',
        roles: ['master', 'data'],
        heapUsed: 1000000000,
        heapMax: 2000000000,
        diskUsed: 50000000000,
        diskTotal: 100000000000,
        cpuPercent: 45.5,
        ip: '192.168.1.1',
        version: '8.11.0',
        tags: ['hot'],
        isMaster: true,
        isMasterEligible: true,
        loadAverage: 2.5,
        uptime: '5d',
        uptimeMillis: 432000000,
      },
      {
        id: 'node-2',
        name: 'node-2-name',
        roles: ['data'],
        heapUsed: 800000000,
        heapMax: 2000000000,
        diskUsed: 30000000000,
        diskTotal: 100000000000,
        cpuPercent: 30.2,
        ip: '192.168.1.2',
        version: '8.11.0',
        tags: [],
        isMaster: false,
        isMasterEligible: false,
        loadAverage: 1.8,
        uptime: '5d',
        uptimeMillis: 432000000,
      },
    ];

    vi.mocked(apiClient.getNodes).mockResolvedValue({
      items: mockNodes,
      total: 2,
      page: 1,
      page_size: 1000,
      total_pages: 1,
    });

    const { result } = renderHook(() => useNodes('cluster-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockNodes);
    expect(apiClient.getNodes).toHaveBeenCalledWith('cluster-1', 1, 1000);
  });

  it('should handle empty node arrays', async () => {
    vi.mocked(apiClient.getNodes).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 1000,
      total_pages: 0,
    });

    const { result } = renderHook(() => useNodes('cluster-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(result.current.data?.length).toBe(0);
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch nodes';
    vi.mocked(apiClient.getNodes).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useNodes('cluster-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe(errorMessage);
  });

  it('should not fetch when clusterId is undefined', () => {
    const { result } = renderHook(() => useNodes(undefined), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.getNodes).not.toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(() => useNodes('cluster-1', 30000, false), {
      wrapper,
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.getNodes).not.toHaveBeenCalled();
  });

  it('should use custom refresh interval', async () => {
    const mockNodes: NodeInfo[] = [
      {
        id: 'node-1',
        name: 'node-1-name',
        roles: ['master', 'data'],
        heapUsed: 1000000000,
        heapMax: 2000000000,
        diskUsed: 50000000000,
        diskTotal: 100000000000,
        isMaster: true,
        isMasterEligible: true,
      },
    ];

    vi.mocked(apiClient.getNodes).mockResolvedValue({
      items: mockNodes,
      total: 1,
      page: 1,
      page_size: 1000,
      total_pages: 1,
    });

    const customInterval = 60000;
    const { result } = renderHook(() => useNodes('cluster-1', customInterval), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should handle nodes with optional fields missing', async () => {
    const mockNodes: NodeInfo[] = [
      {
        id: 'node-1',
        name: 'node-1-name',
        roles: ['data'],
        heapUsed: 1000000000,
        heapMax: 2000000000,
        diskUsed: 50000000000,
        diskTotal: 100000000000,
        // Optional fields missing
        isMaster: false,
        isMasterEligible: false,
      },
    ];

    vi.mocked(apiClient.getNodes).mockResolvedValue({
      items: mockNodes,
      total: 1,
      page: 1,
      page_size: 1000,
      total_pages: 1,
    });

    const { result } = renderHook(() => useNodes('cluster-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockNodes);
    expect(result.current.data?.[0].cpuPercent).toBeUndefined();
    expect(result.current.data?.[0].loadAverage).toBeUndefined();
    expect(result.current.data?.[0].uptime).toBeUndefined();
  });

  it('should handle nodes with all resource metrics', async () => {
    const mockNodes: NodeInfo[] = [
      {
        id: 'node-1',
        name: 'node-1-name',
        roles: ['master', 'data', 'ingest'],
        heapUsed: 1500000000,
        heapMax: 2000000000,
        diskUsed: 75000000000,
        diskTotal: 100000000000,
        cpuPercent: 65.8,
        ip: '10.0.0.1',
        version: '8.11.0',
        tags: ['hot', 'production'],
        isMaster: true,
        isMasterEligible: true,
        loadAverage: 3.2,
        uptime: '10d 5h',
        uptimeMillis: 882000000,
      },
    ];

    vi.mocked(apiClient.getNodes).mockResolvedValue({
      items: mockNodes,
      total: 1,
      page: 1,
      page_size: 1000,
      total_pages: 1,
    });

    const { result } = renderHook(() => useNodes('cluster-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const node = result.current.data?.[0];
    expect(node).toBeDefined();
    expect(node?.heapUsed).toBe(1500000000);
    expect(node?.heapMax).toBe(2000000000);
    expect(node?.diskUsed).toBe(75000000000);
    expect(node?.diskTotal).toBe(100000000000);
    expect(node?.cpuPercent).toBe(65.8);
    expect(node?.loadAverage).toBe(3.2);
    expect(node?.uptime).toBe('10d 5h');
  });

  it('should handle nodes with different roles', async () => {
    const mockNodes: NodeInfo[] = [
      {
        id: 'master-node',
        name: 'master-node',
        roles: ['master'],
        heapUsed: 500000000,
        heapMax: 1000000000,
        diskUsed: 10000000000,
        diskTotal: 50000000000,
        isMaster: true,
        isMasterEligible: true,
      },
      {
        id: 'data-node',
        name: 'data-node',
        roles: ['data'],
        heapUsed: 1500000000,
        heapMax: 2000000000,
        diskUsed: 80000000000,
        diskTotal: 100000000000,
        isMaster: false,
        isMasterEligible: false,
      },
      {
        id: 'ingest-node',
        name: 'ingest-node',
        roles: ['ingest'],
        heapUsed: 800000000,
        heapMax: 1000000000,
        diskUsed: 20000000000,
        diskTotal: 50000000000,
        isMaster: false,
        isMasterEligible: false,
      },
      {
        id: 'coordinating-node',
        name: 'coordinating-node',
        roles: ['coordinating'],
        heapUsed: 300000000,
        heapMax: 1000000000,
        diskUsed: 5000000000,
        diskTotal: 50000000000,
        isMaster: false,
        isMasterEligible: false,
      },
    ];

    vi.mocked(apiClient.getNodes).mockResolvedValue({
      items: mockNodes,
      total: 4,
      page: 1,
      page_size: 1000,
      total_pages: 1,
    });

    const { result } = renderHook(() => useNodes('cluster-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.length).toBe(4);

    // Verify different node roles
    const roles = result.current.data?.flatMap((n) => n.roles);
    expect(roles).toContain('master');
    expect(roles).toContain('data');
    expect(roles).toContain('ingest');
    expect(roles).toContain('coordinating');
  });
});
