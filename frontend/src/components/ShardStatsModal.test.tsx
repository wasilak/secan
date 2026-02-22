import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ShardStatsModal } from './ShardStatsModal';
import type { ShardInfo } from '../types/api';
import { apiClient } from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    getShardStats: vi.fn(),
  },
}));

// Helper to render with Mantine provider
function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('ShardStatsModal', () => {
  const mockShard: ShardInfo = {
    index: 'test-index',
    shard: 0,
    primary: true,
    state: 'STARTED',
    node: 'node-1',
    docs: 1000,
    store: 1024000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders shard number and type', () => {
    renderWithMantine(<ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    // There are multiple "Primary" badges (in title and table), so use getAllByText
    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
  });

  it('renders index name', () => {
    renderWithMantine(<ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('test-index')).toBeInTheDocument();
  });

  it('renders node name', () => {
    renderWithMantine(<ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('node-1')).toBeInTheDocument();
  });

  it('renders shard state', () => {
    renderWithMantine(<ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('STARTED')).toBeInTheDocument();
  });

  it('renders document count', () => {
    renderWithMantine(<ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('renders size in human-readable format', () => {
    renderWithMantine(<ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('1000.00 KB')).toBeInTheDocument();
  });

  it('displays replica badge for replica shards', () => {
    const replicaShard: ShardInfo = {
      ...mockShard,
      primary: false,
    };

    renderWithMantine(<ShardStatsModal shard={replicaShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getAllByText('Replica')).toHaveLength(2); // Title and table
  });

  it('displays unassigned for shards without node', () => {
    const unassignedShard: ShardInfo = {
      ...mockShard,
      node: undefined,
      state: 'UNASSIGNED',
    };

    renderWithMantine(<ShardStatsModal shard={unassignedShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('displays relocating node when present', () => {
    const relocatingShard: ShardInfo = {
      ...mockShard,
      state: 'RELOCATING',
      relocatingNode: 'node-2',
    };

    renderWithMantine(<ShardStatsModal shard={relocatingShard} opened={true} onClose={vi.fn()} />);

    expect(screen.getByText('node-2')).toBeInTheDocument();
  });

  it('does not render modal content when shard is null', () => {
    const { container } = renderWithMantine(
      <ShardStatsModal shard={null} opened={true} onClose={vi.fn()} />
    );

    // Modal should not render any content when shard is null
    expect(container.querySelector('.mantine-Modal-root')).not.toBeInTheDocument();
  });

  it('handles missing docs and store gracefully', () => {
    const shardWithoutStats: ShardInfo = {
      index: 'test-index',
      shard: 0,
      primary: true,
      state: 'STARTED',
      node: 'node-1',
      docs: 0,
      store: 0,
    };

    renderWithMantine(
      <ShardStatsModal shard={shardWithoutStats} opened={true} onClose={vi.fn()} />
    );

    // Check that both 0 values are present (shard number and docs)
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0 B')).toBeInTheDocument();
  });

  it('fetches detailed stats when modal opens with clusterId', async () => {
    const mockStats = {
      indices: {
        'test-index': {
          shards: {
            '0': [
              {
                segments: { count: 5 },
                merges: { current: 2 },
                refresh: { total: 100 },
                flush: { total: 50 },
              },
            ],
          },
        },
      },
    };

    vi.mocked(apiClient.getShardStats).mockResolvedValue(mockStats);

    renderWithMantine(
      <ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} clusterId="test-cluster" />
    );

    // Should show loading state initially
    expect(screen.getByText('Loading detailed statistics...')).toBeInTheDocument();

    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // segments
      expect(screen.getByText('2')).toBeInTheDocument(); // merges
      expect(screen.getByText('100')).toBeInTheDocument(); // refreshes
      expect(screen.getByText('50')).toBeInTheDocument(); // flushes
    });

    expect(apiClient.getShardStats).toHaveBeenCalledWith('test-cluster', 'test-index', 0);
  });

  it('does not fetch stats for unassigned shards', () => {
    const unassignedShard: ShardInfo = {
      ...mockShard,
      state: 'UNASSIGNED',
      node: undefined,
    };

    renderWithMantine(
      <ShardStatsModal
        shard={unassignedShard}
        opened={true}
        onClose={vi.fn()}
        clusterId="test-cluster"
      />
    );

    expect(apiClient.getShardStats).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Detailed statistics are not available for unassigned shards/)
    ).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(apiClient.getShardStats).mockRejectedValue(new Error('API Error'));

    renderWithMantine(
      <ShardStatsModal shard={mockShard} opened={true} onClose={vi.fn()} clusterId="test-cluster" />
    );

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });
});
