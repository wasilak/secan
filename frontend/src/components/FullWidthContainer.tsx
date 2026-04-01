import { Box, BoxProps } from '@mantine/core';
import { ReactNode, useMemo, memo } from 'react';
import { useDrawer } from '../contexts/DrawerContext';
import { useConsolePanel } from '../contexts/ConsolePanelContext';

/**
 * FullWidthContainer component provides a full-width layout with responsive padding
 * and drawer-aware width calculation.
 *
 * This component replaces the constrained Container component to allow content
 * to use the full viewport width while maintaining appropriate padding for readability.
 * When the drawer is pinned, it automatically adjusts the content width to account
 * for the drawer width.
 *
 * Features:
 * - 100% width to fill available space
 * - Responsive horizontal padding (1rem base, scales with breakpoints)
 * - Breakpoint-aware spacing
 * - Maintains consistent padding across all screen sizes
 * - Automatically adjusts width when drawer is pinned
 * - Smooth transitions when drawer pin state changes
 * - Memoized for performance optimization
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.13, 2.14, 2.15
 */

interface FullWidthContainerProps extends Omit<BoxProps, 'style'> {
  children: ReactNode;
  /**
   * Custom padding override. If not provided, uses responsive defaults.
   */
  padding?: string | { base?: string; sm?: string; md?: string; lg?: string; xl?: string };
  /**
   * Additional styles to apply
   */
  style?: React.CSSProperties;
  /**
   * If true, uses 100% width without drawer-aware calculations.
   * Useful when the container is used inside a modal or other constrained parent.
   */
  constrainToParent?: boolean;
}

export const FullWidthContainer = memo(function FullWidthContainer({
  children,
  padding,
  style,
  constrainToParent = false,
  ...boxProps
}: FullWidthContainerProps) {
  const { isPinned, drawerWidth } = useDrawer();

  // Attempt to read console pinned state to account for a pinned console reducing
  // available content width. The ConsolePanelProvider may not be present in some
  // test renderers, so we call the hook inside a try/catch and fall back to
  // "no pinned console" when the hook isn't available.
  let consolePinned = false;
  let consoleWidthPx = 0;
  try {
    const consoleCtx = useConsolePanel();
    consolePinned = consoleCtx.isSticky;
    consoleWidthPx = consoleCtx.width;
  } catch {
    // Not within ConsolePanelProvider - tests or other consumers may render this
    // component standalone. In that case, behave as if no console is pinned.
    consolePinned = false;
    consoleWidthPx = 0;
  }

  // Memoize default padding to avoid recreation on every render
  const defaultPadding = useMemo(
    () => ({
      base: '1rem',
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
      xl: '2rem',
    }),
    []
  );

  // Resolve padding value
  const resolvedPadding = padding || defaultPadding;

  // Memoize width calculation
  const calculatedWidth = useMemo(() => {
    if (constrainToParent) {
      return '100%';
    }
    if (!isPinned && !consolePinned) {
      return '100%';
    }

    // Subtract pinned drawer and/or pinned console widths from viewport
    const leftDrawer = isPinned ? drawerWidth.base : 0;
    const rightConsole = consolePinned ? consoleWidthPx : 0;
    return `calc(100vw - ${leftDrawer}px - ${rightConsole}px)`;
  }, [constrainToParent, isPinned, drawerWidth.base, consolePinned, consoleWidthPx]);

  // Memoize max width calculation
  const calculatedMaxWidth = useMemo(() => {
    if (constrainToParent) {
      return '100%';
    }
    if (!isPinned && !consolePinned) return '100%';
    const leftDrawer = isPinned ? drawerWidth.base : 0;
    const rightConsole = consolePinned ? consoleWidthPx : 0;
    return `calc(100vw - ${leftDrawer}px - ${rightConsole}px)`;
  }, [constrainToParent, isPinned, drawerWidth.base, consolePinned, consoleWidthPx]);

  // Memoize padding style
  const paddingStyle = useMemo(() => {
    if (typeof resolvedPadding === 'string') {
      return { padding: resolvedPadding };
    }
    return {
      padding: resolvedPadding.base || '1rem',
      '@media (min-width: 48em)': {
        padding: resolvedPadding.sm || resolvedPadding.base || '1rem',
      },
      '@media (min-width: 62em)': {
        padding: resolvedPadding.md || resolvedPadding.sm || resolvedPadding.base || '1.5rem',
      },
      '@media (min-width: 75em)': {
        padding: resolvedPadding.lg || resolvedPadding.md || '2rem',
      },
      '@media (min-width: 88em)': {
        padding: resolvedPadding.xl || resolvedPadding.lg || '2rem',
      },
    };
  }, [resolvedPadding]);

  // Memoize combined style
  const combinedStyle = useMemo(
    () => ({
      width: calculatedWidth,
      maxWidth: calculatedMaxWidth,
      transition: 'width 0.2s ease, max-width 0.2s ease',
      ...(typeof resolvedPadding === 'string' ? paddingStyle : {}),
      ...style,
    }),
    [calculatedWidth, calculatedMaxWidth, resolvedPadding, paddingStyle, style]
  );

  return (
    <Box
      {...boxProps}
      className="fullwidth-container"
      data-console-pinned={consolePinned}
      style={combinedStyle}
      p={typeof resolvedPadding === 'object' ? resolvedPadding : undefined}
    >
      <div className="fullwidth-container-inner" style={{ width: '100%' }}>
        {children}
      </div>
    </Box>
  );
});
