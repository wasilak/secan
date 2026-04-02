import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { SankeyTopologyView } from './SankeyTopologyView';
import type { SankeyResponse } from '../../types/api';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock nivo/sankey so it does not crash in jsdom (no SVG rendering support)
vi.mock('@nivo/sankey', () => ({
  ResponsiveSankey: () => <div data-testid="sankey-chart" />,
}));

// Mock the useSankeyData hook — all tests control its return value
vi.mock('../../hooks/useSankeyData');

import { useSankeyData } from '../../hooks/useSankeyData';
const mockUseSankeyData = vi.mocked(useSankeyData);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function TestWrapper({ children }: { children: ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

const defaultProps = {
  clusterId: 'cluster-1',
  selectedShardStates: [],
  topIndices: 50,
  onTopIndicesChange: vi.fn(),
};

const emptyResponse: SankeyResponse = {
  nodes: [],
  links: [],
  meta: {
    truncated: false,
    displayedIndices: 0,
    totalIndices: 0,
    totalNodes: 0,
    totalLinks: 0,
  },
};

const populatedResponse: SankeyResponse = {
  nodes: [
    { id: 'my-index', kind: 'index', totalShards: 2, primaryShards: 1, replicaShards: 1, storeBytes: 1024 },
    { id: 'node-1', kind: 'node', totalShards: 2, primaryShards: 1, replicaShards: 1, storeBytes: 1024 },
  ],
  links: [
    { source: 'my-index', target: 'node-1', totalShards: 2, primaryShards: 1, replicaShards: 1 },
  ],
  meta: {
    truncated: false,
    displayedIndices: 1,
    totalIndices: 1,
    totalNodes: 1,
    totalLinks: 1,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SankeyTopologyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when loading with no data', () => {
    mockUseSankeyData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <SankeyTopologyView {...defaultProps} />
      </TestWrapper>
    );

    // Mantine Skeleton renders as a div with a specific class
    // We check that neither the chart nor error alert is shown
    expect(screen.queryByTestId('sankey-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('No shard data available')).not.toBeInTheDocument();
  });

  it('renders error alert with retry button on error', () => {
    const mockRefetch = vi.fn();
    mockUseSankeyData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Network timeout'),
      refetch: mockRefetch,
    });

    render(
      <TestWrapper>
        <SankeyTopologyView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load Sankey data')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    const retryBadge = screen.getByText('Retry');
    expect(retryBadge).toBeInTheDocument();
    fireEvent.click(retryBadge);
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it('renders empty state when data has no nodes', () => {
    mockUseSankeyData.mockReturnValue({
      data: emptyResponse,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <SankeyTopologyView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('No shard data available')).toBeInTheDocument();
    expect(screen.queryByTestId('sankey-chart')).not.toBeInTheDocument();
  });

  it('renders truncation warning when meta.truncated is true', () => {
    const truncatedResponse: SankeyResponse = {
      ...populatedResponse,
      meta: {
        ...populatedResponse.meta,
        truncated: true,
        displayedIndices: 50,
        totalIndices: 120,
      },
    };

    mockUseSankeyData.mockReturnValue({
      data: truncatedResponse,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <SankeyTopologyView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Large cluster — showing top indices only')).toBeInTheDocument();
    // Both counts must appear in the warning text
    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it('limit control is always visible (not gated on truncation)', () => {
    // Use non-truncated response — the NumberInput should still be visible.
    mockUseSankeyData.mockReturnValue({
      data: populatedResponse,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <SankeyTopologyView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
  });

  it('calls onTopIndicesChange only when Apply button is clicked, not on input change', () => {
    const mockOnTopIndicesChange = vi.fn();

    const truncatedResponse: SankeyResponse = {
      ...populatedResponse,
      meta: {
        ...populatedResponse.meta,
        truncated: true,
        displayedIndices: 50,
        totalIndices: 120,
      },
    };

    mockUseSankeyData.mockReturnValue({
      data: truncatedResponse,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <SankeyTopologyView
          {...defaultProps}
          onTopIndicesChange={mockOnTopIndicesChange}
        />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    // Changing the input should NOT immediately call onTopIndicesChange
    fireEvent.change(input, { target: { value: '75' } });
    expect(mockOnTopIndicesChange).not.toHaveBeenCalled();

    // Clicking Apply should call onTopIndicesChange with the new value
    const applyButton = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyButton);
    expect(mockOnTopIndicesChange).toHaveBeenCalledWith(75);
  });
});
