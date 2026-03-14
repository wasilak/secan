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
 * Type for transition configuration
 */
export interface TransitionConfig {
  /** Duration in seconds */
  duration: number;
  /** Easing curve as cubic-bezier array */
  ease: readonly number[];
  /** Optional delay in seconds */
  delay?: number;
}

/**
 * Type for animation variants
 */
export interface AnimationVariants {
  /** Initial state */
  initial: Record<string, number | string>;
  /** Animate to state */
  animate: Record<string, number | string>;
  /** Exit state */
  exit: Record<string, number | string>;
  /** Transition configuration */
  transition: TransitionConfig;
}

/**
 * Available transition preset names
 */
export type TransitionPreset =
  | 'page'
  | 'modal'
  | 'slideFromRight'
  | 'slideFromLeft'
  | 'fade'
  | 'expand';

/**
 * Predefined transition configurations
 */
export const transitions: Record<TransitionPreset, AnimationVariants> = {
  /**
   * Page transition - fade + slide Y
   * Used for route transitions
   */
  page: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: {
      duration: DURATIONS.normal,
      ease: EASINGS.default,
    },
  },

  /**
   * Modal transition - scale + fade
   * Used for modal dialogs
   */
  modal: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: {
      duration: DURATIONS.slow,
      ease: EASINGS.default,
    },
  },

  /**
   * Slide from right
   * Used for panels and drawers entering from right
   */
  slideFromRight: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
    transition: {
      duration: DURATIONS.slower,
      ease: EASINGS.default,
    },
  },

  /**
   * Slide from left
   * Used for navigation drawer
   */
  slideFromLeft: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
    transition: {
      duration: DURATIONS.slower,
      ease: EASINGS.default,
    },
  },

  /**
   * Simple fade
   * Used for subtle transitions
   */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: DURATIONS.normal,
      ease: EASINGS.default,
    },
  },

  /**
   * Expand/Collapse
   * Used for accordion-style content
   */
  expand: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: {
      duration: DURATIONS.normal,
      ease: EASINGS.default,
    },
  },
};

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

/**
 * Helper to get transition config based on reduced motion preference
 *
 * @param shouldReduceMotion - Whether to reduce motion
 * @returns Transition configuration object
 */
export function getTransitionConfig(
  shouldReduceMotion: boolean | null
): { duration: number } | undefined {
  if (shouldReduceMotion) {
    return { duration: 0 };
  }
  return undefined;
}

/**
 * Duration with reduced motion support
 *
 * @param normalDuration - Normal animation duration
 * @param shouldReduceMotion - Whether to reduce motion
 * @returns Duration to use (0 if reduced motion, otherwise normal)
 */
export function getDuration(
  normalDuration: number,
  shouldReduceMotion: boolean | null
): number {
  if (shouldReduceMotion) {
    return 0;
  }
  return normalDuration;
}
