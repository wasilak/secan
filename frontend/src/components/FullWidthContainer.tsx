import { Box, BoxProps } from '@mantine/core';
import { ReactNode } from 'react';

/**
 * FullWidthContainer component provides a full-width layout with responsive padding.
 * 
 * This component replaces the constrained Container component to allow content
 * to use the full viewport width while maintaining appropriate padding for readability.
 * 
 * Features:
 * - 100% width to fill available space
 * - Responsive horizontal padding (1rem base, scales with breakpoints)
 * - Breakpoint-aware spacing
 * - Maintains consistent padding across all screen sizes
 * 
 * Requirements: 2.13, 2.14, 2.15
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
        width: '100%',
        ...(typeof resolvedPadding === 'string' ? paddingStyle : {}),
        ...style,
      }}
      p={typeof resolvedPadding === 'object' ? resolvedPadding : undefined}
    >
      {children}
    </Box>
  );
}
