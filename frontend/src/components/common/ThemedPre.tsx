import React from 'react';
import { Box } from '@mantine/core';

type BoxProps = React.ComponentProps<typeof Box>;

interface ThemedPreProps extends BoxProps {
  children: React.ReactNode;
  className?: string;
}

// Small wrapper for consistent code-block styling that follows current
// color-scheme via CSS variables --secan-code-bg / --secan-code-fg.
// Core visuals are provided by the .secan-code-block CSS class. Allow
// callers to pass className or style for small overrides, but do not
// duplicate the main styling inline.
export function ThemedPre({ children, className, ...rest }: ThemedPreProps) {
  const mergedClass = ['secan-code-block', className].filter(Boolean).join(' ');

  return (
    <Box component="pre" {...rest} className={mergedClass}>
      {children}
    </Box>
  );
}

export default ThemedPre;
