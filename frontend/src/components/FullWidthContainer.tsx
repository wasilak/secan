import { Box, BoxProps } from '@mantine/core';
import { ReactNode } from 'react';
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

export function FullWidthContainer({
  children,
  padding,
  style,
  ...boxProps
}: FullWidthContainerProps) {
  const { isPinned, drawerWidth } = useDrawer();

  // Default responsive padding
  const defaultPadding = {
    base: '1rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '2rem',
  };

  // Resolve padding value
  const resolvedPadding = padding || defaultPadding;

  // Calculate available width when drawer is pinned
  // The drawer width is subtracted from 100vw to get the available content width
  const calculateWidth = () => {
    if (!isPinned) {
      return '100%';
    }
    // Use CSS calc to subtract drawer width from viewport width
    // Base width for mobile/small screens, md width for larger screens
    return `calc(100vw - ${drawerWidth.base}px)`;
  };

  // Convert padding object to CSS custom properties for responsive behavior
  const paddingStyle = typeof resolvedPadding === 'string'
    ? { padding: resolvedPadding }
    : {
        padding: resolvedPadding.base || '1rem',
        // Use Mantine's breakpoint system via CSS
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

  return (
    <Box
      {...boxProps}
      style={{
        width: calculateWidth(),
        maxWidth: isPinned ? `calc(100vw - ${drawerWidth.base}px)` : '100%',
        transition: 'width 0.2s ease, max-width 0.2s ease',
        ...(typeof resolvedPadding === 'string' ? paddingStyle : {}),
        ...style,
      }}
      p={typeof resolvedPadding === 'object' ? resolvedPadding : undefined}
    >
      {children}
    </Box>
  );
}
