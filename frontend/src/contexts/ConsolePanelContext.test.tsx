import { render, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { ConsolePanelProvider, useConsolePanel } from './ConsolePanelContext';
import React from 'react';

// Small consumer component to expose context values into the DOM for assertions
function TestConsumer() {
  const { isDetached, isOpen } = useConsolePanel();
  return (
    <div>
      <span data-testid="is-detached">{isDetached ? 'true' : 'false'}</span>
      <span data-testid="is-open">{isOpen ? 'true' : 'false'}</span>
    </div>
  );
}

// Helper to render provider tree used by ConsolePanelProvider
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <PreferencesProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </PreferencesProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

describe('ConsolePanelContext - modal-aware shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no stray global z-index override remains
    // @ts-ignore
    delete (window as any).__SE_CAN_CONSOLE_Z_INDEX__;
    document.body.innerHTML = '';
  });

  it('forces detached mode when a modal/dialog is visible and reverts when it is removed', async () => {
    renderWithProviders(
      <ConsolePanelProvider>
        <TestConsumer />
      </ConsolePanelProvider>
    );

    // Create a visible dialog element and append to body
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.style.display = 'block';
    dialog.style.visibility = 'visible';
    dialog.style.opacity = '1';
    // JSDOM returns 0 for getBoundingClientRect by default; stub to appear visible
    // @ts-ignore
    dialog.getBoundingClientRect = () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {} });
    document.body.appendChild(dialog);

    // Dispatch Ctrl+` keydown
    const ev = new KeyboardEvent('keydown', { key: '`', ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);

    // Expect console to open in detached mode and global z-index override set
    await waitFor(() => expect(screen.getByTestId('is-detached').textContent).toBe('true'));
    expect(screen.getByTestId('is-open').textContent).toBe('true');
    // global should be set
    // @ts-ignore
    expect((window as any).__SE_CAN_CONSOLE_Z_INDEX__).toBeDefined();

    // Remove the dialog to trigger MutationObserver revert
    document.body.removeChild(dialog);

    // Wait for revert: detached should become false and global removed
    await waitFor(() => expect(screen.getByTestId('is-detached').textContent).toBe('false'));
    // @ts-ignore
    expect((window as any).__SE_CAN_CONSOLE_Z_INDEX__).toBeUndefined();
  });

  it('toggles panel normally when no modal is present (does not force detached)', async () => {
    renderWithProviders(
      <ConsolePanelProvider>
        <TestConsumer />
      </ConsolePanelProvider>
    );

    // Ensure no modal exists
    // Dispatch Ctrl+` keydown to toggle
    const ev = new KeyboardEvent('keydown', { key: '`', ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);

    // Expect panel open and still not detached
    await waitFor(() => expect(screen.getByTestId('is-open').textContent).toBe('true'));
    expect(screen.getByTestId('is-detached').textContent).toBe('false');
    // global should not be set
    // @ts-ignore
    expect((window as any).__SE_CAN_CONSOLE_Z_INDEX__).toBeUndefined();
  });
});
