/**
 * PageTransition component
 *
 * Wraps page content with fade + slide Y animation for smooth route transitions.
 *
 * @module transitions
 */

import { motion } from 'framer-motion';
import { transitions, useMotionPreference } from '../../lib/transitions';

/**
 * Props for PageTransition component
 */
interface PageTransitionProps {
  /** Child elements to animate */
  children: React.ReactNode;
}

/**
 * Page transition wrapper component
 *
 * Provides fade + slide Y animation for route transitions.
 * Respects reduced motion preferences.
 *
 * @example
 * ```tsx
 * <PageTransition>
 *   <Dashboard />
 * </PageTransition>
 * ```
 */
export function PageTransition({ children }: PageTransitionProps) {
  const { enabled, transition } = useMotionPreference();
  const pageTransition = transitions.page;

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={enabled ? pageTransition.exit : { opacity: 0 }}
      transition={transition ?? pageTransition.transition}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  );
}
