import { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '@mantine/hooks';

/**
 * Drawer width constants in pixels
 */
export const DRAWER_WIDTH = {
  base: 250,
  md: 280,
} as const;

interface DrawerContextValue {
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  drawerWidth: typeof DRAWER_WIDTH;
}

const DrawerContext = createContext<DrawerContextValue | undefined>(undefined);

interface DrawerProviderProps {
  children: ReactNode;
}

/**
 * DrawerProvider manages drawer pin state
 *
 * Features:
 * - Persists pin state to localStorage
 * - Provides drawer width constants
 * - Shared state across components
 */
export function DrawerProvider({ children }: DrawerProviderProps) {
  const [isPinned, setIsPinned] = useLocalStorage({
    key: 'nav-pinned',
    defaultValue: false,
  });

  return (
    <DrawerContext.Provider
      value={{
        isPinned,
        setIsPinned,
        drawerWidth: DRAWER_WIDTH,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

/**
 * Hook to access drawer context
 */
export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider');
  }
  return context;
}
