/**
 * Animation transition constants and utilities
 *
 * Provides centralized configuration for all animations to ensure consistency
 * across the application. Includes support for reduced motion preferences.
 *
 * @module transitions
 */

import { useReducedMotion } from 'framer-motion';

/**
 * Duration presets in seconds
 */
export const DURATIONS = {
  /** Instant - no animation */
  instant: 0,
  /** Fast - 150ms, for micro-interactions */
  fast: 0.15,
  /** Normal - 200ms, standard transitions */
  normal: 0.2,
  /** Slow - 250ms, for modals and larger elements */
  slow: 0.25,
  /** Slower - 300ms, for drawer/panel animations */
  slower: 0.3,
} as const;

/**
 * Easing curves as cubic-bezier arrays
 */
export const EASINGS = {
  /** Standard Material Design easing */
  default: [0.4, 0, 0.2, 1] as const,
  /** Decelerate - for entering elements */
  decelerate: [0, 0, 0.2, 1] as const,
  /** Accelerate - for leaving elements */
  accelerate: [0.4, 0, 1, 1] as const,
  /** Bounce - for playful interactions */
  bounce: [0.68, -0.55, 0.265, 1.55] as const,
} as const;

/**
 * Hook to check motion preference and get appropriate transition config
 *
 * @returns Object with enabled flag and transition configuration
 *
 * @example
 * ```tsx
 * const { enabled, transition } = useMotionPreference();
 *
 * <motion.div
 *   animate={enabled ? { scale: 1.1 } : undefined}
 *   transition={transition}
 * >
 *   Content
 * </motion.div>
 * ```
 */
export function useMotionPreference(): {
  /** Whether animations are enabled */
  enabled: boolean;
  /** Transition config respecting reduced motion */
  transition: { duration: number } | undefined;
} {
  const shouldReduceMotion = useReducedMotion();

  return {
    enabled: !shouldReduceMotion,
    transition: shouldReduceMotion ? { duration: 0 } : undefined,
  };
}
