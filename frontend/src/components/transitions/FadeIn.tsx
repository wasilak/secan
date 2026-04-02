/**
 * FadeIn component
 *
 * Simple fade animation wrapper for lazy-loaded content and subtle transitions.
 *
 * @module transitions
 */

import { motion } from 'framer-motion';
import { DURATIONS, EASINGS, useMotionPreference } from '../../lib/transitions';

/**
 * Props for FadeIn component
 */
interface FadeInProps {
  /** Child elements to animate */
  children: React.ReactNode;
  /** Optional delay before animation starts (in seconds) */
  delay?: number;
}

/**
 * Fade in wrapper component
 *
 * Provides simple fade animation for content appearance.
 * Respects reduced motion preferences.
 *
 * @example
 * ```tsx
 * <FadeIn delay={0.2}>
 *   <Content />
 * </FadeIn>
 * ```
 */
export function FadeIn({ children, delay = 0 }: FadeInProps) {
  const { transition } = useMotionPreference();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        transition ?? {
          duration: DURATIONS.normal,
          delay,
          ease: EASINGS.default,
        }
      }
    >
      {children}
    </motion.div>
  );
}
