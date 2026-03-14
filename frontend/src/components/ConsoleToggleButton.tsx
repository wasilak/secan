import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTerminal2 } from '@tabler/icons-react';
import { useConsolePanel } from '../contexts/ConsolePanelContext';

/**
 * Props for ConsoleToggleButton component
 */
export interface ConsoleToggleButtonProps {
  /** Optional CSS class name */
  className?: string;
}

/**
 * ConsoleToggleButton provides a global button to toggle console visibility.
 *
 * Features:
 * - ActionIcon with terminal icon
 * - Toggle console panel on click
 * - Shows active state when console is open
 * - Tooltip with keyboard shortcut hint
 * - Disabled with tooltip outside cluster context
 *
 * Requirements: 1
 */
export function ConsoleToggleButton({ className }: ConsoleToggleButtonProps) {
  const { isOpen, isSticky, togglePanel, clusterId } = useConsolePanel();

  // Hide button when console is pinned (sticky mode)
  if (isOpen && isSticky) {
    return null;
  }

  const isDisabled = clusterId === null;

  return (
    <Tooltip
      label={
        isDisabled
          ? 'Console only available in cluster context'
          : isOpen
            ? 'Close Console (Ctrl+`)'
            : 'Open Console (Ctrl+`)'
      }
    >
      <ActionIcon
        variant={isOpen ? 'filled' : 'subtle'}
        size="lg"
        onClick={togglePanel}
        disabled={isDisabled}
        className={className}
        aria-label={isOpen ? 'Close console' : 'Open console'}
        data-console-toggle
      >
        <IconTerminal2 size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
