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
 * User preferences stored in browser localStorage
 * 
 * These preferences persist across sessions and allow users to
 * customize their Cerebro experience.
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
}

/**
 * Default user preferences
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  refreshInterval: 30000, // 30 seconds
  lastSelectedCluster: undefined,
  restConsoleHistory: [],
};
