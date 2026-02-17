import { Box, BoxProps } from '@mantine/core';
import { ReactNode, useMemo, memo } from 'react';
import { useDrawer } from '../contexts/DrawerContext';

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
}

export const FullWidthContainer = memo(function FullWidthContainer({
  children,
  padding,
  style,
  ...boxProps
}: FullWidthContainerProps) {
  const { isPinned, drawerWidth } = useDrawer();

  // Memoize default padding to avoid recreation on every render
  const defaultPadding = useMemo(() => ({
    base: '1rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '2rem',
  }), []);

  // Resolve padding value
  const resolvedPadding = padding || defaultPadding;

  // Memoize width calculation
  const calculatedWidth = useMemo(() => {
    if (!isPinned) {
      return '100%';
    }
    return `calc(100vw - ${drawerWidth.base}px)`;
  }, [isPinned, drawerWidth.base]);

  // Memoize max width calculation
  const calculatedMaxWidth = useMemo(() => {
    return isPinned ? `calc(100vw - ${drawerWidth.base}px)` : '100%';
  }, [isPinned, drawerWidth.base]);

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
  const combinedStyle = useMemo(() => ({
    width: calculatedWidth,
    maxWidth: calculatedMaxWidth,
    transition: 'width 0.2s ease, max-width 0.2s ease',
    ...(typeof resolvedPadding === 'string' ? paddingStyle : {}),
    ...style,
  }), [calculatedWidth, calculatedMaxWidth, resolvedPadding, paddingStyle, style]);

  return (
    <Box
      {...boxProps}
      style={combinedStyle}
      p={typeof resolvedPadding === 'object' ? resolvedPadding : undefined}
    >
      {children}
    </Box>
  );
});
