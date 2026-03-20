/**
 * URL State Management Tests for DotBasedTopologyView
 * 
 * Tests verify that DotBasedTopologyView correctly renders with different grouping configs
 * passed from the parent component (ClusterView).
 * 
 * Note: URL state management has been moved to ClusterView level.
 * GroupingControl is now in the sidebar, not inside DotBasedTopologyView.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { DotBasedTopologyView } from './DotBasedTopologyView';
import type { NodeInfo, ShardInfo, IndexInfo } from '../../types/api';
import type { GroupingConfig } from '../../utils/topologyGrouping';

// Mock data
const mockNodes: NodeInfo[] = [
  {
    id: 'node1',
    name: 'node-1',
    roles: ['master', 'data'],
    isMaster: true,
    heapUsed: 1024 * 1024 * 1024,
    diskUsed: 10 * 1024 * 1024 * 1024,
    tags: ['zone-a'],
  },
  {
    id: 'node2',
    name: 'node-2',
    roles: ['data'],
    isMaster: false,
    heapUsed: 2048 * 1024 * 1024,
    diskUsed: 20 * 1024 * 1024 * 1024,
    tags: ['zone-b'],
  },
  {
    id: 'node3',
    name: 'node-3',
    roles: ['ingest'],
    isMaster: false,
    heapUsed: 512 * 1024 * 1024,
    diskUsed: 5 * 1024 * 1024 * 1024,
    tags: [],
  },
];

const mockShards: ShardInfo[] = [
  {
    index: 'test-index',
    shard: 0,
    primary: true,
    state: 'STARTED',
    node: 'node-1',
  },
  {
    index: 'test-index',
    shard: 0,
    primary: false,
    state: 'STARTED',
    node: 'node-2',
  },
];

const mockIndices: IndexInfo[] = [
  {
    name: 'test-index',
    health: 'green',
    status: 'open',
    primaries: 1,
    replicas: 1,
    docsCount: 1000,
    storeSize: 1024 * 1024,
  },
];

// Helper to render component with grouping config
function renderWithGrouping(groupingConfig: GroupingConfig = { attribute: 'none', value: undefined }) {
  const searchParams = new URLSearchParams();
  
  const result = render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/cluster/test/topology/dot']}>
        <Routes>
          <Route
            path="/cluster/:clusterId/topology/dot"
            element={
              <DotBasedTopologyView
                nodes={mockNodes}
                shards={mockShards}
                indices={mockIndices}
                searchParams={searchParams}
                clusterId="test"
                groupingConfig={groupingConfig}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </MantineProvider>
  );
  
  return result;
}

describe('DotBasedTopologyView - Grouping Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement 4.1, 4.2, 4.3: Grouping renders correctly with different configs', () => {
    it('should render with no grouping', async () => {
      renderWithGrouping({ attribute: 'none', value: undefined });

      await waitFor(() => {
        // Nodes with shards should be displayed
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('node-2')).toBeInTheDocument();
      });
    });

    it('should render with role grouping', async () => {
      renderWithGrouping({ attribute: 'role', value: undefined });

      await waitFor(() => {
        const node1Elements = screen.getAllByText('node-1');
        expect(node1Elements.length).toBeGreaterThan(0);
        const node2Elements = screen.getAllByText('node-2');
        expect(node2Elements.length).toBeGreaterThan(0);
      });
    });

    it('should render with type grouping', async () => {
      renderWithGrouping({ attribute: 'type', value: undefined });

      await waitFor(() => {
        const node1Elements = screen.getAllByText('node-1');
        expect(node1Elements.length).toBeGreaterThan(0);
        const node2Elements = screen.getAllByText('node-2');
        expect(node2Elements.length).toBeGreaterThan(0);
      });
    });

    it('should render with label grouping', async () => {
      renderWithGrouping({ attribute: 'label', value: 'zone-a' });

      await waitFor(() => {
        // Nodes with shards should be displayed
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('node-2')).toBeInTheDocument();
      });
    });
  });

  describe('Integration tests', () => {
    it('should display all nodes with shards regardless of grouping', async () => {
      renderWithGrouping({ attribute: 'role', value: undefined });

      await waitFor(() => {
        // Nodes with shards should be displayed
        const node1Elements = screen.getAllByText('node-1');
        expect(node1Elements.length).toBeGreaterThan(0);
        const node2Elements = screen.getAllByText('node-2');
        expect(node2Elements.length).toBeGreaterThan(0);
      });
    });

    it('should maintain node functionality within groups', async () => {
      renderWithGrouping({ attribute: 'role', value: undefined });

      await waitFor(() => {
        // Verify node details are visible
        const node1Elements = screen.getAllByText('node-1');
        expect(node1Elements.length).toBeGreaterThan(0);
        // Verify shard count badge exists
        const shardBadges = screen.getAllByText(/shards/i);
        expect(shardBadges.length).toBeGreaterThan(0);
      });
    });

    it('should render correctly with undefined grouping config (uses default)', async () => {
      // Pass undefined groupingConfig - should use default { attribute: 'none' }
      const searchParams = new URLSearchParams();
      
      render(
        <MantineProvider>
          <MemoryRouter initialEntries={['/cluster/test/topology/dot']}>
            <Routes>
              <Route
                path="/cluster/:clusterId/topology/dot"
                element={
                  <DotBasedTopologyView
                    nodes={mockNodes}
                    shards={mockShards}
                    indices={mockIndices}
                    searchParams={searchParams}
                    clusterId="test"
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </MantineProvider>
      );

      await waitFor(() => {
        // Should render with default grouping (none)
        expect(screen.getByText('node-1')).toBeInTheDocument();
      });
    });
  });
});
