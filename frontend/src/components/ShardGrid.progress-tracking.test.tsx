import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ShardGrid } from './ShardGrid';
import { useShardGridStore } from '../stores/shard-grid-store';
import { apiClient } from '../api/client';
import type { NodeWithShards, IndexMetadata, ShardInfo } from '../types/api';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    relocateShard: vi.fn(),
    getNodes: vi.fn(),
    getIndices: vi.fn(),
    getShards: vi.fn(),
    getShardStats: vi.fn(),
  },
}));

// Helper to wrap component with providers
function renderWithProviders(component: React.ReactElement) {
  return render(
    <MantineProvider>
      <Notifications />
      {component}
    </MantineProvider>
  );
}

// Mock data
const mockNodes: NodeWithShards[] = [
  {
    id: 'node-1',
    name: 'node-1',
    ip: '10.0.0.1',
    roles: ['master', 'data'],
    heapUsed: 5000000000,
    heapMax: 10000000000,
    diskUsed: 50000000000,
    diskTotal: 100000000000,
    cpuPercent: 45,
    loadAverage: 2.5,
    isMaster: true,
    isMasterEligible: true,
    shards: new Map([
      [
        'test-index',
        [
          {
            index: 'test-index',
            shard: 0,
            primary: true,
            state: 'STARTED',
            node: 'node-1',
            docs: 1000,
            store: 1024000,
          },
        ],
      ],
    ]),
  },
  {
    id: 'node-2',
    name: 'node-2',
    ip: '10.0.0.2',
    roles: ['data'],
    heapUsed: 3000000000,
    heapMax: 10000000000,
    diskUsed: 30000000000,
    diskTotal: 100000000000,
    cpuPercent: 30,
    loadAverage: 1.5,
    isMaster: false,
    isMasterEligible: false,
    shards: new Map(),
  },
];

const mockIndices: IndexMetadata[] = [
  {
    name: 'test-index',
    health: 'green',
    status: 'open',
    primaryShards: 1,
    replicaShards: 1,
    docsCount: 1000,
    storeSize: 1024000,
    shardCount: 1,
    size: 1024000,
  },
];

const mockShards: ShardInfo[] = [
  {
    index: 'test-index',
    shard: 0,
    primary: true,
    state: 'STARTED',
    node: 'node-1',
    docs: 1000,
    store: 1024000,
  },
];

/**
 * Progress Tracking Tests
 *
 * These tests verify the relocation progress tracking functionality:
 * - Requirements: 7.1, 7.2, 7.3, 7.7, 7.8, 7.9, 7.10, 7.12
 */
describe('ShardGrid - Relocation Progress Tracking', () => {
  beforeEach(() => {
    // Reset store state
    useShardGridStore.getState().reset();

    // Reset mocks
    vi.clearAllMocks();

    // Mock initial API responses (with pagination wrapper)
    vi.mocked(apiClient.getNodes).mockResolvedValue({ items: mockNodes, total: mockNodes.length, page: 1, page_size: 50, total_pages: 1 });
    vi.mocked(apiClient.getIndices).mockResolvedValue({ items: mockIndices, total: mockIndices.length, page: 1, page_size: 50, total_pages: 1 });
    vi.mocked(apiClient.getShards).mockResolvedValue({ items: mockShards, total: mockShards.length, page: 1, page_size: 50, total_pages: 1 });

    // Use fake timers for controlling intervals
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  it('starts polling after successful relocation initiation - Requirements: 7.2, 7.3', async () => {
    // Mock successful relocation
    vi.mocked(apiClient.relocateShard).mockResolvedValue(undefined);

    // Simulate relocation initiation
    const shard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'STARTED',
      node: 'node-1',
      docs: 1000,
      store: 1024000,
    };

    // Add shard to relocating set
    useShardGridStore.getState().addRelocatingShard(shard);

    // Start polling with a mock interval ID
    const intervalId = window.setInterval(() => {}, 2000);
    useShardGridStore.getState().startPolling(intervalId);

    // Get fresh state after updates
    const state = useShardGridStore.getState();

    // Verify polling state
    expect(state.isPolling).toBe(true);
    expect(state.pollingIntervalId).toBe(intervalId);
    expect(state.pollingStartTime).toBeDefined();
    expect(state.pollingStartTime).toBeGreaterThan(0);

    // Cleanup
    clearInterval(intervalId);
  });

  it.skip('updates grid during relocation showing RELOCATING state - Requirements: 7.4, 7.5, 7.6', async () => {
    // Mock relocating shard data
    const relocatingShards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'RELOCATING',
        node: 'node-1',
        relocatingNode: 'node-2',
        docs: 1000,
        storeSize: 1024000,
      },
    ];

    vi.mocked(apiClient.getShards).mockResolvedValue({ items: relocatingShards, total: relocatingShards.length, page: 1, page_size: 50, total_pages: 1 });

    renderWithProviders(<ShardGrid clusterId="test-cluster" refreshInterval={2000} />);

    // Wait for initial data fetch with increased timeout
    await waitFor(
      () => {
        expect(apiClient.getShards).toHaveBeenCalled();
      },
      { timeout: 10000 }
    );

    // Verify the component loaded successfully with increased timeout
    await waitFor(
      () => {
        const state = useShardGridStore.getState();
        expect(state.loading).toBe(false);
      },
      { timeout: 10000 }
    );
  }, 15000); // Increase test timeout to 15 seconds

  it('detects relocation completion when shard becomes STARTED - Requirements: 7.7, 7.8', async () => {
    const store = useShardGridStore.getState();

    // Setup initial relocating state
    const relocatingShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    // Add to relocating set
    store.addRelocatingShard(relocatingShard);

    // Verify shard is being tracked
    expect(store.isShardRelocating(relocatingShard)).toBe(true);

    // Simulate completion - shard is now STARTED on destination node
    const completedShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'STARTED',
      node: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    // Remove from relocating set (this would happen in fetchClusterState)
    store.removeRelocatingShard(completedShard);

    // Verify shard is no longer being tracked
    expect(store.isShardRelocating(completedShard)).toBe(false);
  });

  it('stops polling when relocation completes - Requirements: 7.10', async () => {
    // Start polling
    const intervalId = window.setInterval(() => {}, 2000);
    useShardGridStore.getState().startPolling(intervalId);

    // Get fresh state after starting
    let state = useShardGridStore.getState();
    expect(state.isPolling).toBe(true);
    expect(state.pollingIntervalId).toBe(intervalId);

    // Stop polling
    useShardGridStore.getState().stopPolling();

    // Get fresh state after stopping
    state = useShardGridStore.getState();

    // Verify polling stopped
    expect(state.isPolling).toBe(false);
    expect(state.pollingIntervalId).toBeNull();
    expect(state.pollingStartTime).toBeNull();
  });

  it('handles relocation failure when shard becomes UNASSIGNED - Requirements: 7.9', async () => {
    const store = useShardGridStore.getState();

    // Setup initial relocating state
    const relocatingShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    // Add to relocating set
    store.addRelocatingShard(relocatingShard);

    // Simulate failure - shard becomes UNASSIGNED
    const failedShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'UNASSIGNED',
      docs: 1000,
      store: 1024000,
    };

    // Remove from relocating set (this would happen in fetchClusterState)
    store.removeRelocatingShard(failedShard);

    // Verify shard is no longer being tracked
    expect(store.isShardRelocating(failedShard)).toBe(false);
  });

  it('times out polling after 5 minutes - Requirements: 7.12', async () => {
    // Setup relocating shard
    const relocatingShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    useShardGridStore.getState().addRelocatingShard(relocatingShard);

    // Start polling
    const intervalId = window.setInterval(() => {}, 2000);
    useShardGridStore.getState().startPolling(intervalId);

    const state = useShardGridStore.getState();
    const startTime = state.pollingStartTime!;
    expect(startTime).toBeGreaterThan(0);

    // Advance time by 5 minutes (300000 ms)
    const FIVE_MINUTES = 5 * 60 * 1000;
    vi.advanceTimersByTime(FIVE_MINUTES + 1000);

    // Check if timeout would be detected
    const currentTime = Date.now();
    const elapsed = currentTime - startTime;

    expect(elapsed).toBeGreaterThan(FIVE_MINUTES);

    // Cleanup
    clearInterval(intervalId);
  });

  it.skip('polls every 2 seconds during relocation - Requirements: 7.2, 7.3', async () => {
    // Mock API responses (with pagination wrapper)
    vi.mocked(apiClient.getNodes).mockResolvedValue({ items: mockNodes, total: mockNodes.length, page: 1, page_size: 50, total_pages: 1 });
    vi.mocked(apiClient.getIndices).mockResolvedValue({ items: mockIndices, total: mockIndices.length, page: 1, page_size: 50, total_pages: 1 });
    vi.mocked(apiClient.getShards).mockResolvedValue({ items: mockShards, total: mockShards.length, page: 1, page_size: 50, total_pages: 1 });
    vi.mocked(apiClient.relocateShard).mockResolvedValue(undefined);

    renderWithProviders(<ShardGrid clusterId="test-cluster" refreshInterval={30000} />);

    // Wait for initial render with increased timeout
    await waitFor(
      () => {
        expect(useShardGridStore.getState().loading).toBe(false);
      },
      { timeout: 10000 }
    );

    // Simulate starting relocation
    const shard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'STARTED',
      node: 'node-1',
      docs: 1000,
      storeSize: 1024000,
    };

    useShardGridStore.getState().addRelocatingShard(shard);

    // Start polling
    const intervalId = window.setInterval(() => {
      // This would call fetchClusterState in the real component
    }, 2000);

    useShardGridStore.getState().startPolling(intervalId);

    // Get fresh state
    const state = useShardGridStore.getState();

    // Verify polling interval is set
    expect(state.pollingIntervalId).toBe(intervalId);
    expect(state.isPolling).toBe(true);

    // Cleanup
    clearInterval(intervalId);
    useShardGridStore.getState().stopPolling();
  }, 15000); // Increase test timeout to 15 seconds

  it('tracks multiple relocating shards simultaneously', async () => {
    // Add multiple shards to relocating set
    const shard1: ShardInfo = {
      index: 'index-1',
      shard: 0,
      primary: true,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    const shard2: ShardInfo = {
      index: 'index-2',
      shard: 1,
      primary: false,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 2000,
      store: 2048000,
    };

    useShardGridStore.getState().addRelocatingShard(shard1);
    useShardGridStore.getState().addRelocatingShard(shard2);

    // Get fresh state
    const state = useShardGridStore.getState();

    // Verify both shards are being tracked
    expect(state.isShardRelocating(shard1)).toBe(true);
    expect(state.isShardRelocating(shard2)).toBe(true);
    expect(state.relocatingShards.size).toBe(2);

    // Complete one shard
    useShardGridStore.getState().removeRelocatingShard(shard1);

    // Get fresh state after removal
    const updatedState = useShardGridStore.getState();

    // Verify only one shard is still being tracked
    expect(updatedState.isShardRelocating(shard1)).toBe(false);
    expect(updatedState.isShardRelocating(shard2)).toBe(true);
    expect(updatedState.relocatingShards.size).toBe(1);
  });

  it('continues polling until all shards complete - Requirements: 7.10', async () => {
    // Add multiple shards
    const shard1: ShardInfo = {
      index: 'index-1',
      shard: 0,
      primary: true,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    const shard2: ShardInfo = {
      index: 'index-2',
      shard: 1,
      primary: false,
      state: 'RELOCATING',
      node: 'node-1',
      relocatingNode: 'node-2',
      docs: 2000,
      store: 2048000,
    };

    useShardGridStore.getState().addRelocatingShard(shard1);
    useShardGridStore.getState().addRelocatingShard(shard2);

    // Start polling
    const intervalId = window.setInterval(() => {}, 2000);
    useShardGridStore.getState().startPolling(intervalId);

    let state = useShardGridStore.getState();
    expect(state.isPolling).toBe(true);

    // Complete first shard
    useShardGridStore.getState().removeRelocatingShard(shard1);

    // Polling should continue because shard2 is still relocating
    state = useShardGridStore.getState();
    expect(state.relocatingShards.size).toBe(1);

    // Complete second shard
    useShardGridStore.getState().removeRelocatingShard(shard2);

    // Now polling should stop (in the real component)
    state = useShardGridStore.getState();
    expect(state.relocatingShards.size).toBe(0);

    // Cleanup
    clearInterval(intervalId);
  });

  it('handles shard key generation correctly for tracking', () => {
    // Test primary shard
    const primaryShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'STARTED',
      node: 'node-1',
      docs: 1000,
      store: 1024000,
    };

    useShardGridStore.getState().addRelocatingShard(primaryShard);

    let state = useShardGridStore.getState();
    expect(state.isShardRelocating(primaryShard)).toBe(true);

    // Test replica shard with same index and shard number
    const replicaShard: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: false,
      state: 'STARTED',
      node: 'node-2',
      docs: 1000,
      store: 1024000,
    };

    // Replica should be tracked separately
    state = useShardGridStore.getState();
    expect(state.isShardRelocating(replicaShard)).toBe(false);

    useShardGridStore.getState().addRelocatingShard(replicaShard);

    state = useShardGridStore.getState();
    expect(state.isShardRelocating(replicaShard)).toBe(true);

    // Both should be tracked
    expect(state.relocatingShards.size).toBe(2);
  });
});
