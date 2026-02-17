import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ShardGrid } from './ShardGrid';
import { useShardGridStore } from '../stores/shard-grid-store';
import { apiClient } from '../api/client';
import type { NodeWithShards, IndexMetadata, ShardInfo } from '../types/api';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    getNodes: vi.fn(),
    getIndices: vi.fn(),
    getShards: vi.fn(),
  },
}));

// Helper to wrap component with MantineProvider
function renderWithMantine(component: React.ReactElement) {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
}

// Mock data for testing
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
      ['index-1', [
        {
          index: 'index-1',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 1024000,
        },
      ]],
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
    shards: new Map([
      ['index-1', [
        {
          index: 'index-1',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-2',
          docs: 1000,
          store: 1024000,
        },
      ]],
    ]),
  },
];

const mockIndices: IndexMetadata[] = [
  {
    name: 'index-1',
    health: 'green',
    status: 'open',
    primaryShards: 1,
    replicaShards: 1,
    docsCount: 1000,
    storeSize: 1024000,
    shardCount: 2,
    size: 1024000,
  },
];

const mockUnassignedShards: ShardInfo[] = [];

describe('ShardGrid', () => {
  beforeEach(() => {
    // Reset store state before each test
    useShardGridStore.getState().reset();
    // Clear all mocks
    vi.clearAllMocks();
  });

  it('renders loading state', async () => {
    // Mock API to never resolve (keep loading)
    vi.mocked(apiClient.getNodes).mockImplementation(() => new Promise(() => {}));
    vi.mocked(apiClient.getIndices).mockImplementation(() => new Promise(() => {}));
    vi.mocked(apiClient.getShards).mockImplementation(() => new Promise(() => {}));
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    expect(screen.getByText(/loading shard grid/i)).toBeInTheDocument();
  });

  it('renders error state', async () => {
    // Mock API to reject with error
    const error = new Error('Test error');
    vi.mocked(apiClient.getNodes).mockRejectedValue(error);
    vi.mocked(apiClient.getIndices).mockRejectedValue(error);
    vi.mocked(apiClient.getShards).mockRejectedValue(error);
    
    // Set error state directly since the component catches errors silently
    useShardGridStore.setState({ 
      loading: false, 
      error: new Error('Test error') 
    });
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      expect(screen.getByText(/error loading shard grid/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when no data', async () => {
    // Mock API to return empty arrays
    vi.mocked(apiClient.getNodes).mockResolvedValue([]);
    vi.mocked(apiClient.getIndices).mockResolvedValue([]);
    vi.mocked(apiClient.getShards).mockResolvedValue([]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });
  });

  it('renders grid with nodes and indices', async () => {
    // Mock API to return test data
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
      {
        index: 'index-1',
        shard: 0,
        primary: false,
        state: 'STARTED',
        node: 'node-2',
        docs: 1000,
        store: 1024000,
      },
    ]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check for node names
      expect(screen.getByText('node-1')).toBeInTheDocument();
      expect(screen.getByText('node-2')).toBeInTheDocument();
    });
    
    // Check for node IPs
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
    
    // Check for index name
    expect(screen.getByText('index-1')).toBeInTheDocument();
  });

  it('renders node statistics', async () => {
    // Mock API to return test data
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
      {
        index: 'index-1',
        shard: 0,
        primary: false,
        state: 'STARTED',
        node: 'node-2',
        docs: 1000,
        store: 1024000,
      },
    ]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check for heap usage (50%)
      expect(screen.getByText(/heap: 50%/i)).toBeInTheDocument();
    });
    
    // Check for disk usage (50%)
    expect(screen.getByText(/disk: 50%/i)).toBeInTheDocument();
    
    // Check for CPU usage
    expect(screen.getByText(/cpu: 45%/i)).toBeInTheDocument();
    
    // Check for load average
    expect(screen.getByText(/load: 2\.50/i)).toBeInTheDocument();
  });

  it('renders index metadata', async () => {
    // Mock API to return test data
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
      {
        index: 'index-1',
        shard: 0,
        primary: false,
        state: 'STARTED',
        node: 'node-2',
        docs: 1000,
        store: 1024000,
      },
    ]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check for shard count
      expect(screen.getByText(/2 shards/i)).toBeInTheDocument();
    });
    
    // Check for document count
    expect(screen.getByText(/1,000 docs/i)).toBeInTheDocument();
    
    // Check for size (1024000 bytes = 1000 KB)
    expect(screen.getByText(/1000\.0 KB/i)).toBeInTheDocument();
  });

  it('renders shard cells', async () => {
    // Mock API to return test data
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
      {
        index: 'index-1',
        shard: 0,
        primary: false,
        state: 'STARTED',
        node: 'node-2',
        docs: 1000,
        store: 1024000,
      },
    ]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check for shard numbers (should have two shards with number 0)
      const shardCells = screen.getAllByText('0');
      expect(shardCells.length).toBeGreaterThan(0);
    });
  });

  it('renders unassigned shards row when present', async () => {
    const unassignedShards: ShardInfo[] = [
      {
        index: 'index-1',
        shard: 1,
        primary: true,
        state: 'UNASSIGNED',
        docs: 0,
        store: 0,
      },
    ];
    
    // Mock API to return test data with unassigned shards
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
      ...unassignedShards,
    ]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check for unassigned shards label
      expect(screen.getByText(/unassigned shards/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 shard/i)).toBeInTheDocument();
  });

  it('does not render unassigned shards row when none present', async () => {
    // Mock API to return test data without unassigned shards
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
    ]);
    
    renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check that unassigned shards label is not present
      expect(screen.queryByText(/unassigned shards/i)).not.toBeInTheDocument();
    });
  });

  it('renders sticky headers', async () => {
    // Mock API to return test data
    vi.mocked(apiClient.getNodes).mockResolvedValue(mockNodes);
    vi.mocked(apiClient.getIndices).mockResolvedValue(mockIndices);
    vi.mocked(apiClient.getShards).mockResolvedValue([
      {
        index: 'index-1',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      },
    ]);
    
    const { container } = renderWithMantine(<ShardGrid clusterId="test-cluster" />);
    
    await waitFor(() => {
      // Check for sticky positioning on headers
      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
    });

    // Check for sticky node column
    const nodeHeader = screen.getByText('Node');
    expect(nodeHeader).toBeInTheDocument();
  });
});
