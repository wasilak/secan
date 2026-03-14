import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { Split, SplitPane, SplitResizer } from '@gfazioli/mantine-split-pane';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { ConsoleContent } from './ConsoleContent';

import '@gfazioli/mantine-split-pane/styles.css';

// Custom CSS to override the library's default styles
const customResizerStyles = `
  .mantine-SplitResizer-root {
    width: 4px !important;
    min-width: 4px !important;
    max-width: 4px !important;
    flex: 0 0 4px !important;
  }
  
  button.mantine-SplitResizer-root {
    width: 4px !important;
    min-width: 4px !important;
    max-width: 4px !important;
  }

  /* Force split pane and all parent containers to be full height */
  .mantine-SplitPane-root,
  .mantine-SplitPane-root > div,
  .mantine-SplitPane-pane {
    height: 100% !important;
    max-height: 100vh !important;
  }

  /* Ensure the Split container is full height */
  [data-orientation="vertical"] {
    height: 100% !important;
  }

  /* Console panel animation */
  .console-pane-enter {
    opacity: 0;
    transform: translateX(20px);
  }
  
  .console-pane-enter-active {
    opacity: 1;
    transform: translateX(0);
    transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1),
                transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

/**
 * Minimum console panel width in pixels
 */
const MIN_CONSOLE_WIDTH = 300;

/**
 * Maximum console panel width as percentage of viewport
 */
const MAX_CONSOLE_WIDTH_PERCENT = 80;

/**
 * Props for ConsolePanel component
 */
export interface ConsolePanelProps {
  /** Main content to display on the left side */
  children: ReactNode;
}

/**
 * ConsolePanel provides a resizable split-pane layout with main content
 * on the left and console panel on the right.
 *
 * Features:
 * - Conditional rendering based on isOpen state
 * - Resizable console panel with SplitResizer
 * - Min/max width constraints (300px - 80vw)
 * - Width persistence on resize end
 * - Smooth animations
 *
 * Requirements: 1, 4
 */
export function ConsolePanel({ children }: ConsolePanelProps) {
  const {
    isOpen,
    isSticky,
    isDetached,
    width,
    setWidth,
    clusterId,
    closePanel,
  } = useConsolePanel();
  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);
  const consolePaneRef = useRef<HTMLDivElement>(null);

  /**
   * Handle click outside - close panel if not sticky and not detached
   *
   * Clicking outside the console panel closes it when not pinned and in drawer mode.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if: not open, sticky mode, or detached modal mode
      if (!isOpen || isSticky || isDetached) return;
      
      const target = event.target as HTMLElement;
      
      // Check if click is on the console toggle button
      const isToggleButton = target.closest('[data-console-toggle]') !== null;
      if (isToggleButton) {
        return;
      }
      
      // Check if click is inside the console pane
      const isInsideConsole = consolePaneRef.current?.contains(target) ?? false;
      if (isInsideConsole) {
        return;
      }
      
      closePanel();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isSticky, isDetached, closePanel]);

  /**
   * Handle route changes - close panel if not sticky and not detached
   *
   * Requirements: 3
   */
  useEffect(() => {
    const currentPathname = location.pathname;
    const previousPathname = previousPathnameRef.current;

    // Only act if the path has actually changed
    if (currentPathname !== previousPathname) {
      // If not sticky, not detached, and panel is open, close it
      if (!isSticky && !isDetached && isOpen) {
        closePanel();
      }

      // Update previous pathname
      previousPathnameRef.current = currentPathname;
    }
  }, [location.pathname, isSticky, isDetached, isOpen, closePanel]);

  /**
   * Calculate max width based on current viewport
   */
  const getMaxWidth = useCallback(() => {
    return (window.innerWidth * MAX_CONSOLE_WIDTH_PERCENT) / 100;
  }, []);

  /**
   * Handle resize end - persist width
   */
  const handleResizeEnd = useCallback(
    (sizes: { beforePane: { width: number }; afterPane: { width: number } }) => {
      // afterPane is the console panel (right side)
      const newWidth = sizes.afterPane.width;
      const maxWidth = getMaxWidth();
      const clampedWidth = Math.max(MIN_CONSOLE_WIDTH, Math.min(newWidth, maxWidth));
      setWidth(clampedWidth);
    },
    [setWidth, getMaxWidth]
  );

  /**
   * Handle resize during drag - real-time update without persistence
   */
  const handleResizing = useCallback(
    (_sizes: { beforePane: { width: number }; afterPane: { width: number } }) => {
      // Optional: Could update state for real-time feedback
      // For now, we only persist on resize end for performance
    },
    []
  );

  const showConsole = isOpen && clusterId && !isDetached;

  return (
    <>
      <style>{customResizerStyles}</style>
      <Box style={{ flex: 1, height: '100%', width: '100%', minHeight: 0 }}>
        <Split style={{ height: '100%', width: '100%' }}>
          {/* Main content pane - grows to fill available space */}
          <SplitPane grow minWidth={200}>
            {children}
          </SplitPane>

          {/* Resizer handle - only show when console is open */}
          {showConsole && (
            <SplitResizer
              onResizeEnd={handleResizeEnd}
              onResizing={handleResizing}
              style={{
                width: '4px',
                background: 'var(--mantine-color-gray-4)',
                cursor: 'col-resize',
                transition: 'background 0.2s',
              }}
            />
          )}

          {/* Console panel - fixed width, resizable - only in drawer mode */}
          {showConsole && (
            <SplitPane
              minWidth={MIN_CONSOLE_WIDTH}
              maxWidth={getMaxWidth()}
              initialWidth={width}
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                ref={consolePaneRef}
                className="console-pane-enter console-pane-enter-active"
                style={{ height: '100%', width: '100%' }}
              >
                <ConsoleContent clusterId={clusterId} />
              </div>
            </SplitPane>
          )}
        </Split>
      </Box>
    </>
  );
}
