import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { describe, it, expect, vi } from 'vitest';

import { TaskDetailsModal } from '../TaskDetailsModal';
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

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual('../../api/client');
  return {
    ...(actual as object),
    apiClient: {
      // Fetched details report cancellable: false — must win over the stale list row
      getTaskDetails: vi.fn(async () => ({
        task: {
          node: 'n1',
          id: 37077,
          type: 'transport',
          action: 'cluster:monitor/tasks/lists[n]',
          start_time_in_millis: Date.now(),
          cancellable: false,
          cancelled: false,
          raw: { cancellable: false },
        },
      })),
    },
  };
});

describe('TaskDetailsModal cancellable consistency', () => {
  it('shows Cancellable: No from fetched details even when list row says true', async () => {
    const staleListRow = {
      node: 'n1',
      id: 37077,
      type: 'transport',
      action: 'cluster:monitor/tasks/lists[n]',
      start_time_in_millis: Date.now(),
      cancellable: true,
      cancelled: false,
    } as never;

    render(
      <TestProviders>
        <TaskDetailsModal task={staleListRow} isOpen={true} onClose={() => {}} clusterId="c1" />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('No')).toBeTruthy();
      expect(screen.queryByText('Yes')).toBeNull();
    });
    // Cancel button must not be offered for a non-cancellable task
    expect(screen.queryByText('Cancel Task')).toBeNull();
  });
});
