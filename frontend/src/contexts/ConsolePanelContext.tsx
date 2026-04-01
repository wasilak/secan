import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useModalManager } from '../contexts/ModalManagerContext';
import { useParams } from 'react-router-dom';
import { usePreferences } from '../hooks/usePreferences';
import { ClusterConsoleState } from '../types/preferences';
import { notifications } from '@mantine/notifications';

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

  // Panel open state - if sticky mode is enabled, start open; otherwise starts closed
  const [isOpen, setIsOpen] = useState(() => {
    if (!clusterId) {
      return false;
    }
    const savedState = preferences.clusterConsoleStates[clusterId];
    return savedState?.stickyMode ?? false;
  });

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
  // Refs used for modal-forced detached behaviour
  const wasDetachedDueToModalRef = useRef(false);
  const previousDetachedStateRef = useRef<boolean | null>(null);
  // previously used MutationObserver - retained for reference but currently unused
  // Keep the ref to avoid changing the module shape used in other places
  // but mark it as intentionally unused to satisfy lint.
  const observerRef = useRef<MutationObserver | null>(null);
  void observerRef;
  // Refs to keep latest open/detached values for the global key handler
  const isOpenRef = useRef<boolean>(false);
  const isDetachedRef = useRef<boolean>(false);
  // Track whether any modal is present in the DOM
  const modalActiveRef = useRef<boolean>(false);
  const modalIsOpenRef = useRef<boolean>(false);
  // Remember previous pinned (sticky) and open state when a modal appears so we can restore
  const previousPinnedStateRef = useRef<boolean | null>(null);
  const previousOpenStateRef = useRef<boolean | null>(null);

  // Subscribe to modal manager for modal open state and overlay z-index management
  const { isModalOpen, setOverlayZIndex: setManagerOverlayZIndex } = useModalManager();

  // Update ref whenever state changes
  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  // Keep refs in sync with state so the keydown handler (attached once) can
  // read latest values without relying on stale closure variables.
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isDetachedRef.current = isDetached;
  }, [isDetached]);

  /**
   * Detect modal presence across the document and automatically hide/restore
   * the sidebar console when modals appear/disappear.
   *
   * Behavior:
   * - When any modal appears: hide the side console (regardless of pinned)
   *   and remember previous pinned/open state so it can be restored later.
   * - When all modals disappear: restore the side console if it was pinned
   *   before the modal appeared. Also revert any forced detached overlay.
   */
  // Keep a ref in sync with ModalManager so the key handler can read it without stale closures
  useEffect(() => {
    modalIsOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  // Subscribe to ModalManager open/close events instead of DOM mutation observer
  useEffect(() => {
    // If a modal just opened, hide the sidebar console and remember previous state
    if (isModalOpen && !modalActiveRef.current) {
      modalActiveRef.current = true;
      previousPinnedStateRef.current = currentStateRef.current?.stickyMode ?? false;
      previousOpenStateRef.current = isOpenRef.current;

      if (isOpenRef.current) {
        setIsOpen(false);
        isOpenRef.current = false;
      }
    }

    // If all modals closed, restore previous console state and clear any forced overlay
    if (!isModalOpen && modalActiveRef.current) {
      modalActiveRef.current = false;

      if (wasDetachedDueToModalRef.current) {
        const prevDetached = previousDetachedStateRef.current;
        setIsDetached(prevDetached ?? false);
        isDetachedRef.current = !!prevDetached;

        const wasPinned = previousPinnedStateRef.current;
        if (wasPinned) {
          setIsOpen(true);
          isOpenRef.current = true;
        } else {
          const prevOpen = previousOpenStateRef.current;
          if (prevOpen) {
            setIsOpen(true);
            isOpenRef.current = true;
          }
        }

        wasDetachedDueToModalRef.current = false;
        previousDetachedStateRef.current = null;
        // clear manager overlay override
        setManagerOverlayZIndex(undefined);
      } else {
        if (previousPinnedStateRef.current) {
          setIsOpen(true);
          isOpenRef.current = true;
        }
      }

      previousPinnedStateRef.current = null;
      previousOpenStateRef.current = null;
    }
  }, [isModalOpen, setManagerOverlayZIndex]);

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
        // If modal manager says a modal is open, open the detached modal console instead
        if (modalIsOpenRef.current) {
          modalActiveRef.current = true;
          if (!wasDetachedDueToModalRef.current) {
            previousDetachedStateRef.current = isDetachedRef.current;
            wasDetachedDueToModalRef.current = true;

            setIsDetached(true);
            isDetachedRef.current = true;
            setIsOpen(true);
            isOpenRef.current = true;

            // Compute z-index above existing modals and export via manager
            try {
              const nodes = Array.from(document.querySelectorAll('[role="dialog"], .mantine-Modal-root')) as HTMLElement[];
              const maxZ = nodes.reduce((max, n) => {
                const z = parseInt(window.getComputedStyle(n).zIndex || '0', 10);
                return Number.isFinite(z) ? Math.max(max, z) : max;
              }, 1000);
              const resolved = Math.max(20000, maxZ + 20);
              setManagerOverlayZIndex(resolved);
            } catch {
              setManagerOverlayZIndex(20000);
            }

            notifications.show({ title: 'Console (detached)', message: 'Opened console in detached mode because a modal is active', color: 'blue' });
          }

          // While modals are active, we don't toggle the sidebar console here.
          return;
        }

        // If no modal and console is pinned, disable the shortcut
        const pinned = currentStateRef.current?.stickyMode ?? false;
        if (pinned) return;

        // Otherwise toggle the console normally
        togglePanel();
      }
    };

    // Use capture phase to ensure this handler runs before modal handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [togglePanel, setManagerOverlayZIndex]);

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
