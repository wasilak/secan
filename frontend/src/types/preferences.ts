import { Theme } from '../hooks/useTheme';

/**
 * REST console request history item
 */
export interface RequestHistoryItem {
  timestamp: number;
  method: string;
  path: string;
  body?: string;
  response?: string;
}

/**
 * Per-cluster console panel state
 *
 * Stores the console state for each cluster separately,
 * allowing users to maintain different contexts when
 * working with multiple clusters.
 */
export interface ClusterConsoleState {
  /** Whether console panel is in sticky mode for this cluster */
  stickyMode: boolean;

  /** Current console panel width in pixels */
  panelWidth: number;

  /** Current request input (preserved per cluster) */
  currentRequest?: string;

  /** Current response display (preserved per cluster) */
  currentResponse?: string;

  /** Whether history panel is visible */
  showHistory: boolean;

  /** Scroll position in console */
  scrollPosition: number;
}

/**
 * User preferences stored in browser localStorage
 *
 * These preferences persist across sessions and allow users to
 * customize their Secan experience.
 */
export interface UserPreferences {
  /** Theme preference (light, dark, or system) */
  theme: Theme;

  /** Auto-refresh interval in milliseconds (default: 30000 = 30 seconds) */
  refreshInterval: number;

  /** Last selected cluster ID for quick navigation */
  lastSelectedCluster?: string;

  /** REST console request history */
  restConsoleHistory: RequestHistoryItem[];

  /** Global default console panel width in pixels */
  defaultConsoleWidth: number;

  /** Per-cluster console states (keyed by cluster ID) */
  clusterConsoleStates: Record<string, ClusterConsoleState>;
}

/**
 * Default user preferences
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  refreshInterval: 30000, // 30 seconds
  lastSelectedCluster: undefined,
  restConsoleHistory: [],
  defaultConsoleWidth: 500, // Default console panel width in pixels
  clusterConsoleStates: {}, // Empty object - states created on demand per cluster
};
