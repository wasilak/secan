import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { Split, SplitPane, SplitResizer } from '@gfazioli/mantine-split-pane';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { ConsoleContent } from './ConsoleContent';

import '@gfazioli/mantine-split-pane/styles.css';

// Custom CSS to override the library's default resizer width
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
    width,
    setWidth,
    clusterId,
    closePanel,
    currentRequest,
    currentResponse,
    showHistory,
    scrollPosition,
    setCurrentRequest,
    setCurrentResponse,
    setShowHistory,
    setScrollPosition,
  } = useConsolePanel();
  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);
  const consolePaneRef = useRef<HTMLDivElement>(null);

  /**
   * Handle click outside - close panel if not sticky
   *
   * Clicking outside the console panel closes it when not pinned.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen || isSticky) return;
      
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
  }, [isOpen, isSticky, closePanel]);

  /**
   * Handle route changes - close panel if not sticky
   *
   * Requirements: 3
   */
  useEffect(() => {
    const currentPathname = location.pathname;
    const previousPathname = previousPathnameRef.current;

    // Only act if the path has actually changed
    if (currentPathname !== previousPathname) {
      // If not sticky and panel is open, close it
      if (!isSticky && isOpen) {
        closePanel();
      }

      // Update previous pathname
      previousPathnameRef.current = currentPathname;
    }
  }, [location.pathname, isSticky, isOpen, closePanel]);

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
    (sizes: { beforePane: { width: number }; afterPane: { width: number } }) => {
      // Optional: Could update state for real-time feedback
      // For now, we only persist on resize end for performance
    },
    []
  );

  // Always render the split layout to prevent main content from reloading
  // Just hide the console panel when closed by setting its width to 0
  const consoleWidth = isOpen && clusterId ? width : 0;
  const showConsole = isOpen && clusterId;

  return (
    <>
      <style>{customResizerStyles}</style>
      <Box style={{ height: '100%', width: '100%' }}>
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

          {/* Console panel - fixed width, resizable */}
          <SplitPane
            minWidth={showConsole ? MIN_CONSOLE_WIDTH : 0}
            maxWidth={getMaxWidth()}
            initialWidth={consoleWidth}
            style={{
              display: showConsole ? 'flex' : 'none',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div ref={consolePaneRef} style={{ height: '100%', width: '100%' }}>
              {showConsole && <ConsoleContent clusterId={clusterId} />}
            </div>
          </SplitPane>
        </Split>
      </Box>
    </>
  );
}
