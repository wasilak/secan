import { ReactNode, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Portal } from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { Split, SplitPane } from '@gfazioli/mantine-split-pane';
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
 * Default drawer width as percentage of viewport (40%)
 */
const DRAWER_DEFAULT_WIDTH_PERCENT = 0.4;

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
  // Ref to the console pane element that will be rendered in a portal
  const consolePaneRef = useRef<HTMLDivElement>(null);
  // Container id used for the portal root (ensures a stable portal mount)
  const portalId = useMemo(() => 'secan-console-portal', []);

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
      if (isToggleButton) return;

      // Check if click is inside the console pane (portal) or inside a Mantine modal/dialog
      const isInsideConsole = consolePaneRef.current?.contains(target) ?? false;
      if (isInsideConsole) return;

      // If click landed inside a modal/dialog (portal), don't treat it as outside
      // Mantine modal overlay/content typically have role="dialog" or aria-modal attributes
      const isInsideModal = !!target.closest('[role="dialog"], [aria-modal="true"]');
      if (isInsideModal) return;

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

  // When console is not shown, render children directly without height constraints
  // to allow normal page scrolling. We still render the portal root to ensure
  // the click-outside detection can reference the portal node when it exists.
  return (
    <>
      <style>{customResizerStyles}</style>

      {/* Main content always rendered; console drawer is portalized separately */}
      <Box style={{ flex: 1, height: '100%', width: '100%', minHeight: 0 }}>
        <Split style={{ height: '100%', width: '100%' }}>
          {/* Main content pane - grows to fill available space */}
          <SplitPane grow minWidth={200} style={{ overflow: 'auto' }}>
            {children}
          </SplitPane>

          {/* Resizer handle placeholder - the visible resizer is rendered inside portal console */}
          {/* Keep layout stable by reserving small space when console is visible */}
          <div style={{ width: showConsole ? '4px' : 0 }} />
        </Split>
      </Box>

      {/* Portalized console drawer: mounted at document root to avoid stacking context issues */}
      <Portal>
        {showConsole && (() => {
          // Drawer mode: not draggable, default to 40% of viewport width
          const rawDrawerWidth = Math.round(window.innerWidth * DRAWER_DEFAULT_WIDTH_PERCENT);
          const clampedWidth = Math.max(MIN_CONSOLE_WIDTH, Math.min(rawDrawerWidth, getMaxWidth()));

          return (
          <div
              id={portalId}
              ref={consolePaneRef}
              className="console-pane-enter console-pane-enter-active"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                height: '100vh',
                width: `${clampedWidth}px`,
                maxWidth: `${MAX_CONSOLE_WIDTH_PERCENT}vw`,
                // Allow context to override z-index when needed (e.g., forced detached over modals)
                zIndex: (typeof (window as any).__SE_CAN_CONSOLE_Z_INDEX__ !== 'undefined')
                  ? (window as any).__SE_CAN_CONSOLE_Z_INDEX__
                  : 10500,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--mantine-shadow-md)',
                background: 'var(--mantine-color-body)',
                overflow: 'hidden',
              }}
            >
              <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                <ConsoleContent clusterId={clusterId} />
              </div>
            </div>
          );
        })()}
      </Portal>
    </>
  );
}
