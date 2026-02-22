import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { ShardContextMenu } from './ShardContextMenu';
import type { ShardInfo } from '../types/api';

// Wrapper component for Mantine context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('ShardContextMenu', () => {
  const mockShard: ShardInfo = {
    index: 'test-index',
    shard: 0,
    primary: true,
    state: 'STARTED',
    node: 'node-1',
    docs: 1000,
    store: 1024000,
  };

  const mockPosition = { x: 100, y: 100 };
  const mockOnClose = vi.fn();
  const mockOnShowStats = vi.fn();
  const mockOnSelectForRelocation = vi.fn();

  it('renders menu with shard information', () => {
    render(
      <TestWrapper>
        <ShardContextMenu
          shard={mockShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    // Check that shard label is displayed
    expect(screen.getByText(/Shard 0 \(Primary\)/i)).toBeInTheDocument();
  });

  it('displays both menu options for STARTED shard', () => {
    render(
      <TestWrapper>
        <ShardContextMenu
          shard={mockShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    // Both options should be present
    expect(screen.getByText('Display shard stats')).toBeInTheDocument();
    expect(screen.getByText('Select for relocation')).toBeInTheDocument();
  });

  it('calls onShowStats when "Display shard stats" is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ShardContextMenu
          shard={mockShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    const statsButton = screen.getByText('Display shard stats');
    await user.click(statsButton);

    expect(mockOnShowStats).toHaveBeenCalledWith(mockShard);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onSelectForRelocation when "Select for relocation" is clicked for STARTED shard', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ShardContextMenu
          shard={mockShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    const relocationButton = screen.getByText('Select for relocation');
    await user.click(relocationButton);

    expect(mockOnSelectForRelocation).toHaveBeenCalledWith(mockShard);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables relocation for UNASSIGNED shard', () => {
    const unassignedShard: ShardInfo = {
      ...mockShard,
      state: 'UNASSIGNED',
      node: undefined,
    };

    render(
      <TestWrapper>
        <ShardContextMenu
          shard={unassignedShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    const relocationButton = screen.getByText('Select for relocation');

    // Button should be disabled
    expect(relocationButton.closest('button')).toBeDisabled();
  });

  it('disables relocation for RELOCATING shard', () => {
    const relocatingShard: ShardInfo = {
      ...mockShard,
      state: 'RELOCATING',
      relocatingNode: 'node-2',
    };

    render(
      <TestWrapper>
        <ShardContextMenu
          shard={relocatingShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    const relocationButton = screen.getByText('Select for relocation');

    // Button should be disabled
    expect(relocationButton.closest('button')).toBeDisabled();
  });

  it('disables relocation for INITIALIZING shard', () => {
    const initializingShard: ShardInfo = {
      ...mockShard,
      state: 'INITIALIZING',
    };

    render(
      <TestWrapper>
        <ShardContextMenu
          shard={initializingShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    const relocationButton = screen.getByText('Select for relocation');

    // Button should be disabled
    expect(relocationButton.closest('button')).toBeDisabled();
  });

  it('displays replica shard label correctly', () => {
    const replicaShard: ShardInfo = {
      ...mockShard,
      primary: false,
    };

    render(
      <TestWrapper>
        <ShardContextMenu
          shard={replicaShard}
          opened={true}
          position={mockPosition}
          onClose={mockOnClose}
          onShowStats={mockOnShowStats}
          onSelectForRelocation={mockOnSelectForRelocation}
        />
      </TestWrapper>
    );

    // Check that replica label is displayed
    expect(screen.getByText(/Shard 0 \(Replica\)/i)).toBeInTheDocument();
  });
});
