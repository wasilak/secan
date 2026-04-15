import React from 'react';
import { render, screen } from '@testing-library/react';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import ModalRefreshButton from '../ModalRefreshButton';
import { NodeModal } from '../NodeModal';
import { TaskDetailsModal } from '../TaskDetailsModal';
import { ShardStatsModal } from '../ShardStatsModal';
import { apiClient } from '../../api/client';
import { MantineProvider } from '@mantine/core';
import { RefreshProvider } from '../../contexts/RefreshContext';
import { DrawerProvider } from '../../contexts/DrawerContext';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MantineProvider withGlobalStyles withNormalizeCSS>
        <MemoryRouter>
          <DrawerProvider>
            <RefreshProvider>{children}</RefreshProvider>
          </DrawerProvider>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
};

// Tests provide their own QueryClient via TestProviders

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual('../../api/client');
  return {
    ...(actual as object),
    apiClient: {
      getNodeStats: vi.fn(async () => ({ name: 'node-1', isMaster: false, isMasterEligible: true })),
      getNodeMetrics: vi.fn(async () => ({ prometheus_queries: [], data: [] })),
      getTaskDetails: vi.fn(async () => ({ task: { raw: { foo: 'bar' } } })),
      getShardStats: vi.fn(async () => ({})),
    },
  };
});

describe('Modal refresh button presence', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders ModalRefreshButton standalone', () => {
    render(<ModalRefreshButton onRefresh={() => {}} tooltip="Standalone refresh" />, { wrapper: TestProviders });
    expect(screen.getByLabelText('Standalone refresh')).toBeTruthy();
  });

  it('renders refresh button inside NodeModal', async () => {
    render(
      <TestProviders>
        <NodeModal clusterId="c1" nodeId="n1" opened={true} onClose={() => {}} context="nodes" />
      </TestProviders>
    );

    expect(await screen.findByLabelText('Refresh node data', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('renders refresh button inside TaskDetailsModal', async () => {
    const minimalTask = { node: 'n1', id: 't1', start_time_in_millis: Date.now(), action: '', type: '', cancellable: false, cancelled: false } as any;
    render(
      <TestProviders>
        <TaskDetailsModal task={minimalTask} isOpen={true} onClose={() => {}} clusterId="c1" />
      </TestProviders>
    );

    expect(await screen.findByLabelText('Refresh task details', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('renders refresh button inside ShardStatsModal', async () => {
    const shard = { index: 'i1', shard: 0, node: 'n1', primary: true, state: 'STARTED', docs: 0, store: 0 } as any;
    render(
      <TestProviders>
        <ShardStatsModal shard={shard} opened={true} onClose={() => {}} clusterId="c1" />
      </TestProviders>
    );

    expect(await screen.findByLabelText('Refresh shard details', {}, { timeout: 2000 })).toBeTruthy();
  });
});
