import { create } from 'zustand';

/**
 * Example Zustand store
 *
 * This demonstrates the state management pattern.
 * Actual stores will be created as features are implemented:
 * - Theme store (light/dark/system)
 * - Preferences store (refresh interval, last cluster, etc.)
 * - Auth store (user info, session state)
 */
interface ExampleStore {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useExampleStore = create<ExampleStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
