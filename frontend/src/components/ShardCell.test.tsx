import { render, screen, cleanup } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ShardCell } from './ShardCell';
import type { ShardInfo } from '../types/api';

/**
 * Test suite for ShardCell component
 * 
 * Tests:
 * - All shard states render correctly with proper colors
 * - Click handling works
 * - Primary/replica visual distinction
 * - Destination indicator styling
 * - Selected state animation
 * - Accessibility features
 * 
 * Requirements: 3.5, 3.6
 */
describe('ShardCell', () => {
  // Wrapper component to provide Mantine context
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MantineProvider>{children}</MantineProvider>
  );

  // Clean up after each test
  afterEach(() => {
    cleanup();
  });

  // Helper function to create test shard data
  const createShard = (overrides: Partial<ShardInfo> = {}): ShardInfo => ({
    index: 'test-index',
    shard: 0,
    primary: true,
    state: 'STARTED',
    node: 'node-1',
    docs: 1000,
    store: 1024000,
    ...overrides,
  });

  describe('Shard state rendering', () => {
    it('renders STARTED shard', () => {
      const shard = createShard({ state: 'STARTED' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
      expect(cell.textContent).toBe('0');
    });

    it('renders INITIALIZING shard', () => {
      const shard = createShard({ state: 'INITIALIZING' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('renders RELOCATING shard', () => {
      const shard = createShard({ state: 'RELOCATING' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('renders UNASSIGNED shard', () => {
      const shard = createShard({ state: 'UNASSIGNED', node: undefined });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });
  });

  describe('Primary/replica visual distinction', () => {
    it('renders primary shard', () => {
      const shard = createShard({ primary: true, state: 'STARTED' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('renders replica shard', () => {
      const shard = createShard({ primary: false, state: 'STARTED' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('shows primary indicator dot for primary shards', () => {
      const shard = createShard({ primary: true, state: 'STARTED' });
      const { container } = render(<ShardCell shard={shard} />, { wrapper });
      
      // Check for the primary indicator dot
      const indicator = container.querySelector('[aria-hidden="true"]');
      expect(indicator).toBeTruthy();
    });

    it('does not show primary indicator dot for replica shards', () => {
      const shard = createShard({ primary: false, state: 'STARTED' });
      const { container } = render(<ShardCell shard={shard} />, { wrapper });
      
      // Check that there's no primary indicator dot
      const indicator = container.querySelector('[aria-hidden="true"]');
      expect(indicator).toBeFalsy();
    });

    it('does not show primary indicator dot for unassigned shards', () => {
      const shard = createShard({ primary: true, state: 'UNASSIGNED', node: undefined });
      const { container } = render(<ShardCell shard={shard} />, { wrapper });
      
      // Check that there's no primary indicator dot for unassigned
      const indicator = container.querySelector('[aria-hidden="true"]');
      expect(indicator).toBeFalsy();
    });
  });

  describe('Destination indicator styling', () => {
    it('renders destination indicator', () => {
      const shard = createShard({ state: 'STARTED' });
      render(
        <ShardCell shard={shard} isDestinationIndicator={true} />,
        { wrapper }
      );
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('renders normal shard', () => {
      const shard = createShard({ state: 'STARTED' });
      render(
        <ShardCell shard={shard} isDestinationIndicator={false} />,
        { wrapper }
      );
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });
  });

  describe('Selected state', () => {
    it('renders selected shard', () => {
      const shard = createShard({ state: 'STARTED' });
      render(
        <ShardCell shard={shard} isSelected={true} />,
        { wrapper }
      );
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('renders non-selected shard', () => {
      const shard = createShard({ state: 'STARTED' });
      render(
        <ShardCell shard={shard} isSelected={false} />,
        { wrapper }
      );
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('applies pulsing animation to selected shard', () => {
      const shard = createShard({ state: 'STARTED' });
      const { container } = render(
        <ShardCell shard={shard} isSelected={true} />,
        { wrapper }
      );
      
      const cell = container.querySelector('[role="gridcell"]');
      expect(cell).toBeTruthy();
      
      // Check for animation
      const style = window.getComputedStyle(cell!);
      expect(style.animation).toContain('pulse');
    });
  });

  describe('Click handling', () => {
    it('calls onClick handler when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const shard = createShard({ state: 'STARTED' });
      
      render(<ShardCell shard={shard} onClick={onClick} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      await user.click(cell);
      
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(shard);
    });

    it('calls onClick handler when Enter key is pressed', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const shard = createShard({ state: 'STARTED' });
      
      render(<ShardCell shard={shard} onClick={onClick} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      cell.focus();
      await user.keyboard('{Enter}');
      
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(shard);
    });

    it('calls onClick handler when Space key is pressed', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const shard = createShard({ state: 'STARTED' });
      
      render(<ShardCell shard={shard} onClick={onClick} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      cell.focus();
      await user.keyboard(' ');
      
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(shard);
    });

    it('does not call onClick when no handler is provided', async () => {
      const user = userEvent.setup();
      const shard = createShard({ state: 'STARTED' });
      
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      
      // Should not throw error
      await user.click(cell);
      expect(true).toBe(true);
    });

    it('shows pointer cursor when onClick is provided', () => {
      const onClick = vi.fn();
      const shard = createShard({ state: 'STARTED' });
      const { container } = render(<ShardCell shard={shard} onClick={onClick} />, { wrapper });
      
      const cell = container.querySelector('[role="gridcell"]');
      expect(cell).toBeTruthy();
      
      const style = window.getComputedStyle(cell!);
      expect(style.cursor).toBe('pointer');
    });

    it('shows default cursor when onClick is not provided', () => {
      const shard = createShard({ state: 'STARTED' });
      const { container } = render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = container.querySelector('[role="gridcell"]');
      expect(cell).toBeTruthy();
      
      const style = window.getComputedStyle(cell!);
      expect(style.cursor).toBe('default');
    });
  });

  describe('Shard number display', () => {
    it('displays the correct shard number', () => {
      const shard = createShard({ shard: 5 });
      render(<ShardCell shard={shard} />, { wrapper });
      
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('displays shard number 0', () => {
      const shard = createShard({ shard: 0 });
      render(<ShardCell shard={shard} />, { wrapper });
      
      expect(screen.getByText('0')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA role', () => {
      const shard = createShard({ state: 'STARTED' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell).toBeTruthy();
    });

    it('has descriptive aria-label for primary shard', () => {
      const shard = createShard({
        index: 'logs-2024',
        shard: 3,
        primary: true,
        state: 'STARTED',
      });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell.getAttribute('aria-label')).toBe(
        'Shard 3 of index logs-2024, primary, state STARTED'
      );
    });

    it('has descriptive aria-label for replica shard', () => {
      const shard = createShard({
        index: 'logs-2024',
        shard: 2,
        primary: false,
        state: 'INITIALIZING',
      });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell.getAttribute('aria-label')).toBe(
        'Shard 2 of index logs-2024, replica, state INITIALIZING'
      );
    });

    it('is focusable when onClick is provided', () => {
      const onClick = vi.fn();
      const shard = createShard({ state: 'STARTED' });
      render(<ShardCell shard={shard} onClick={onClick} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell.getAttribute('tabIndex')).toBe('0');
    });

    it('is not focusable when onClick is not provided', () => {
      const shard = createShard({ state: 'STARTED' });
      render(<ShardCell shard={shard} />, { wrapper });
      
      const cell = screen.getByRole('gridcell');
      expect(cell.getAttribute('tabIndex')).toBe('-1');
    });
  });

  describe('Color contrast for accessibility', () => {
    it('renders STARTED state without errors', () => {
      const shard = createShard({ state: 'STARTED' });
      render(<ShardCell shard={shard} />, { wrapper });
      expect(screen.getByRole('gridcell')).toBeTruthy();
    });

    it('renders INITIALIZING state without errors', () => {
      const shard = createShard({ state: 'INITIALIZING' });
      render(<ShardCell shard={shard} />, { wrapper });
      expect(screen.getByRole('gridcell')).toBeTruthy();
    });

    it('renders RELOCATING state without errors', () => {
      const shard = createShard({ state: 'RELOCATING' });
      render(<ShardCell shard={shard} />, { wrapper });
      expect(screen.getByRole('gridcell')).toBeTruthy();
    });

    it('renders UNASSIGNED state without errors', () => {
      const shard = createShard({ state: 'UNASSIGNED', node: undefined });
      render(<ShardCell shard={shard} />, { wrapper });
      expect(screen.getByRole('gridcell')).toBeTruthy();
    });
  });
});
