import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { RelocationConfirmDialog } from './RelocationConfirmDialog';
import type { ShardInfo, NodeWithShards } from '../types/api';

// Helper to render with Mantine provider
function renderWithProviders(component: React.ReactElement) {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
}

describe('RelocationConfirmDialog', () => {
  const mockShard: ShardInfo = {
    index: 'test-index',
    shard: 0,
    primary: true,
    state: 'STARTED',
    node: 'node-1',
    docs: 1000,
    store: 1024000,
  };
  
  const mockSourceNode: NodeWithShards = {
    id: 'node-1',
    name: 'node-1-name',
    ip: '10.0.0.1',
    roles: ['data', 'master'],
    heapUsed: 500000000,
    heapMax: 1000000000,
    diskUsed: 10000000000,
    diskTotal: 50000000000,
    isMaster: true,
    isMasterEligible: true,
    shards: new Map(),
  };
  
  const mockDestinationNode: NodeWithShards = {
    id: 'node-2',
    name: 'node-2-name',
    ip: '10.0.0.2',
    roles: ['data'],
    heapUsed: 400000000,
    heapMax: 1000000000,
    diskUsed: 8000000000,
    diskTotal: 50000000000,
    isMaster: false,
    isMasterEligible: false,
    shards: new Map(),
  };
  
  it('renders dialog when opened', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    expect(screen.getByText('Confirm Shard Relocation')).toBeInTheDocument();
  });
  
  it('displays shard details correctly', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    expect(screen.getByText('test-index')).toBeInTheDocument();
    expect(screen.getByText('0 (primary)')).toBeInTheDocument();
  });
  
  it('displays source node details correctly', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    expect(screen.getByText('node-1-name')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('node-1')).toBeInTheDocument();
  });
  
  it('displays destination node details correctly', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    expect(screen.getByText('node-2-name')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
    expect(screen.getByText('node-2')).toBeInTheDocument();
  });
  
  it('displays warning message', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    expect(screen.getByText(/Shard relocation may impact cluster performance/)).toBeInTheDocument();
  });
  
  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  
  it('calls onConfirm when Relocate Shard button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /relocate shard/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
  
  it('closes dialog after successful confirmation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /relocate shard/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
  
  it('handles confirmation errors gracefully', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Relocation failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /relocate shard/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
    
    // Dialog should not close on error
    expect(onClose).not.toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });
  
  it('does not render when shard is null', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={null}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    // Modal should not be visible
    expect(screen.queryByText('Confirm Shard Relocation')).not.toBeInTheDocument();
  });
  
  it('does not render when sourceNode is null', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={null}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    // Modal should not be visible
    expect(screen.queryByText('Confirm Shard Relocation')).not.toBeInTheDocument();
  });
  
  it('does not render when destinationNode is null', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={null}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    // Modal should not be visible
    expect(screen.queryByText('Confirm Shard Relocation')).not.toBeInTheDocument();
  });
  
  it('displays replica shard type correctly', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    
    const replicaShard: ShardInfo = {
      ...mockShard,
      primary: false,
    };
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={replicaShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    expect(screen.getByText('0 (replica)')).toBeInTheDocument();
  });
  
  it('disables buttons while loading', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithProviders(
      <RelocationConfirmDialog
        shard={mockShard}
        sourceNode={mockSourceNode}
        destinationNode={mockDestinationNode}
        opened={true}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /relocate shard/i });
    await user.click(confirmButton);
    
    // Wait for loading state
    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });
});
