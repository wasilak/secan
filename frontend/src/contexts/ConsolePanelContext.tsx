import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import { usePreferences } from '../hooks/usePreferences';
import { ClusterConsoleState } from '../types/preferences';

/**
 * Default console panel width in pixels
 */
const DEFAULT_CONSOLE_WIDTH = 500;

/**
 * Minimum console panel width in pixels
 */
const MIN_CONSOLE_WIDTH = 300;

/**
 * Maximum console panel width as percentage of viewport
 */
const MAX_CONSOLE_WIDTH_PERCENT = 80;

/**
 * Debounce delay for width updates in milliseconds
 */
const WIDTH_DEBOUNCE_MS = 300;

/**
 * Console panel context value interface
 */
interface ConsolePanelContextValue {
  /** Whether the console panel is currently open */
  isOpen: boolean;

  /** Whether sticky mode is enabled (panel stays open during navigation) */
  isSticky: boolean;

  /** Whether console is in detached modal mode */
  isDetached: boolean;

  /** Current console panel width in pixels */
  width: number;

  /** Current cluster ID (null if not in a cluster context) */
  clusterId: string | null;

  /** Current request text for console */
  currentRequest: string | undefined;

  /** Current response text for console */
  currentResponse: string | undefined;

  /** Whether history panel is visible */
  showHistory: boolean;

  /** Scroll position in console */
  scrollPosition: number;

  /** Toggle the console panel open/closed */
  togglePanel: () => void;

  /** Open the console panel */
  openPanel: () => void;

  /** Close the console panel */
  closePanel: () => void;

  /** Set sticky mode */
  setSticky: (sticky: boolean) => void;

  /** Set detached mode */
  setDetached: (detached: boolean) => void;

  /** Set console panel width */
  setWidth: (width: number) => void;

  /** Set current request text */
  setCurrentRequest: (request: string | undefined) => void;

  /** Set current response text */
  setCurrentResponse: (response: string | undefined) => void;

  /** Set whether history panel is visible */
  setShowHistory: (show: boolean) => void;

  /** Set scroll position */
  setScrollPosition: (position: number) => void;
}

const ConsolePanelContext = createContext<ConsolePanelContextValue | undefined>(undefined);

interface ConsolePanelProviderProps {
  children: ReactNode;
}

/**
 * Default cluster console state
 */
const getDefaultClusterState = (): ClusterConsoleState => ({
  stickyMode: false,
  isDetached: false,
  panelWidth: DEFAULT_CONSOLE_WIDTH,
  currentRequest: undefined,
  currentResponse: undefined,
  showHistory: true,
  scrollPosition: 0,
});

/**
 * Validates and clamps width to valid bounds
 */
const validateWidth = (width: number): number => {
  const maxWidth = (window.innerWidth * MAX_CONSOLE_WIDTH_PERCENT) / 100;
  return Math.max(MIN_CONSOLE_WIDTH, Math.min(width, maxWidth));
};

/**
 * ConsolePanelProvider manages console panel state
 *
 * Features:
 * - Persists panel state per cluster to localStorage
 * - Handles cluster switching with state save/restore
 * - Manages open/close and sticky mode
 * - Debounces width updates for performance
 * - Validates width against viewport bounds
 *
 * Requirements: 1, 2, 3, 4, 5
 */
export function ConsolePanelProvider({ children }: ConsolePanelProviderProps) {
  const { id } = useParams<{ id: string }>();
  const { preferences, updatePreference } = usePreferences();

  // Get current cluster ID from URL params
  const clusterId = id ?? null;

  // Current cluster state (loaded from preferences or defaults)
  const [currentState, setCurrentState] = useState<ClusterConsoleState>(() => {
    if (!clusterId) {
      return getDefaultClusterState();
    }
    return preferences.clusterConsoleStates[clusterId] ?? getDefaultClusterState();
  });

  // Panel open state (not persisted - starts closed)
  const [isOpen, setIsOpen] = useState(false);

  // Detached mode state (loaded from saved state)
  const [isDetached, setIsDetached] = useState<boolean>(() => {
    if (!clusterId) {
      return false;
    }
    return preferences.clusterConsoleStates[clusterId]?.isDetached ?? false;
  });

  // Refs for debouncing and previous cluster tracking
  const widthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousClusterIdRef = useRef<string | null>(null);
  const currentStateRef = useRef<ClusterConsoleState>(currentState);

  // Update ref whenever state changes
  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  /**
   * Save current cluster state to preferences
   */
  const saveClusterState = useCallback(
    (clusterId: string, state: ClusterConsoleState) => {
      const newStates = {
        ...preferences.clusterConsoleStates,
        [clusterId]: state,
      };
      updatePreference('clusterConsoleStates', newStates);
    },
    [preferences.clusterConsoleStates, updatePreference]
  );

  /**
   * Handle cluster switching
   *
   * When cluster changes:
   * 1. Save current cluster's state
   * 2. Load new cluster's state
   */
  useEffect(() => {
    const previousClusterId = previousClusterIdRef.current;

    // Save previous cluster's state if it exists and is different from current
    if (previousClusterId && previousClusterId !== clusterId) {
      // Use a ref to avoid circular dependency
      const stateToSave = currentStateRef.current;
      saveClusterState(previousClusterId, stateToSave);
    }

    // Load new cluster's state
    if (clusterId) {
      const newState = preferences.clusterConsoleStates[clusterId] ?? getDefaultClusterState();
      // Validate width against current viewport
      const validatedState = {
        ...newState,
        panelWidth: validateWidth(newState.panelWidth),
      };
      setCurrentState(validatedState);
      // Also load detached state
      setIsDetached(newState.isDetached ?? false);
    } else {
      // No cluster context - use defaults
      setCurrentState(getDefaultClusterState());
      setIsDetached(false);
    }

    // Update previous cluster ref
    previousClusterIdRef.current = clusterId;

    // Cleanup on unmount - save current state
    return () => {
      if (clusterId) {
        const stateToSave = currentStateRef.current;
        saveClusterState(clusterId, stateToSave);
      }
    };
    // Only depend on clusterId to avoid circular updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  /**
   * Toggle panel open/closed
   */
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  /**
   * Open the panel
   */
  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * Close the panel
   */
  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Set sticky mode with persistence
   */
  const setSticky = useCallback(
    (sticky: boolean) => {
      setCurrentState((prev) => {
        const newState = { ...prev, stickyMode: sticky };
        if (clusterId) {
          saveClusterState(clusterId, newState);
        }
        return newState;
      });
    },
    [clusterId, saveClusterState]
  );

  /**
   * Set detached mode with persistence
   */
  const setDetached = useCallback(
    (detached: boolean) => {
      setIsDetached(detached);
      // Persist to cluster state
      if (clusterId) {
        setCurrentState((prev) => {
          const newState = { ...prev, isDetached: detached };
          saveClusterState(clusterId, newState);
          return newState;
        });
      }
    },
    [clusterId, saveClusterState]
  );

  /**
   * Set panel width with validation and debounced persistence
   */
  const setWidth = useCallback(
    (width: number) => {
      const validatedWidth = validateWidth(width);

      setCurrentState((prev) => ({
        ...prev,
        panelWidth: validatedWidth,
      }));

      // Debounce persistence
      if (widthTimeoutRef.current) {
        clearTimeout(widthTimeoutRef.current);
      }

      widthTimeoutRef.current = setTimeout(() => {
        if (clusterId) {
          setCurrentState((prev) => {
            const newState = { ...prev, panelWidth: validatedWidth };
            saveClusterState(clusterId, newState);
            return prev; // Don't trigger another state update
          });
        }
      }, WIDTH_DEBOUNCE_MS);
    },
    [clusterId, saveClusterState]
  );

  /**
   * Set current request with persistence
   */
  const setCurrentRequest = useCallback(
    (request: string | undefined) => {
      setCurrentState((prev) => {
        const newState = { ...prev, currentRequest: request };
        if (clusterId) {
          saveClusterState(clusterId, newState);
        }
        return newState;
      });
    },
    [clusterId, saveClusterState]
  );

  /**
   * Set current response with persistence
   */
  const setCurrentResponse = useCallback(
    (response: string | undefined) => {
      setCurrentState((prev) => {
        const newState = { ...prev, currentResponse: response };
        if (clusterId) {
          saveClusterState(clusterId, newState);
        }
        return newState;
      });
    },
    [clusterId, saveClusterState]
  );

  /**
   * Set show history with persistence
   */
  const setShowHistory = useCallback(
    (show: boolean) => {
      setCurrentState((prev) => {
        const newState = { ...prev, showHistory: show };
        if (clusterId) {
          saveClusterState(clusterId, newState);
        }
        return newState;
      });
    },
    [clusterId, saveClusterState]
  );

  /**
   * Set scroll position with debounced persistence
   */
  const setScrollPosition = useCallback(
    (position: number) => {
      setCurrentState((prev) => ({
        ...prev,
        scrollPosition: position,
      }));

      // Debounce persistence for scroll position
      if (widthTimeoutRef.current) {
        clearTimeout(widthTimeoutRef.current);
      }

      widthTimeoutRef.current = setTimeout(() => {
        if (clusterId) {
          setCurrentState((prev) => {
            const newState = { ...prev, scrollPosition: position };
            saveClusterState(clusterId, newState);
            return prev;
          });
        }
      }, WIDTH_DEBOUNCE_MS);
    },
    [clusterId, saveClusterState]
  );

  /**
   * Keyboard shortcut: Ctrl+` (backtick) to toggle console
   *
   * Requirements: 1 (usability)
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl (Windows/Linux) or Cmd (Mac) + backtick
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (!isModifierPressed) return;

      // Ctrl+` / Cmd+`: Toggle console
      if (event.key === '`' || event.key === '~') {
        event.preventDefault();
        event.stopPropagation();
        togglePanel();
      }
    };

    // Use capture phase to ensure this handler runs before modal handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [togglePanel]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (widthTimeoutRef.current) {
        clearTimeout(widthTimeoutRef.current);
      }
    };
  }, []);

  const value: ConsolePanelContextValue = {
    isOpen,
    isSticky: currentState.stickyMode,
    isDetached,
    width: currentState.panelWidth,
    clusterId,
    currentRequest: currentState.currentRequest,
    currentResponse: currentState.currentResponse,
    showHistory: currentState.showHistory,
    scrollPosition: currentState.scrollPosition,
    togglePanel,
    openPanel,
    closePanel,
    setSticky,
    setDetached,
    setWidth,
    setCurrentRequest,
    setCurrentResponse,
    setShowHistory,
    setScrollPosition,
  };

  return <ConsolePanelContext.Provider value={value}>{children}</ConsolePanelContext.Provider>;
}

/**
 * Hook to access console panel context
 *
 * @throws Error if used outside of ConsolePanelProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOpen, togglePanel, width } = useConsolePanel();
 *
 *   return (
 *     <button onClick={togglePanel}>
 *       {isOpen ? 'Close' : 'Open'} Console ({width}px)
 *     </button>
 *   );
 * }
 * ```
 */
export function useConsolePanel(): ConsolePanelContextValue {
  const context = useContext(ConsolePanelContext);
  if (!context) {
    throw new Error('useConsolePanel must be used within ConsolePanelProvider');
  }
  return context;
}

// Re-export types for convenience
export type { ConsolePanelContextValue };
