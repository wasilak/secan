import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../api/client';

/**
 * User information interface
 */
export interface User {
  username: string;
  roles: string[];
}

/**
 * Auth context state interface
 */
interface AuthContextState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthEnabled: boolean; // True if authentication is actually enabled (not "open" mode)
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextState | undefined>(undefined);

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component provides authentication state and functions to the app.
 *
 * Features:
 * - Tracks current user state
 * - Provides login/logout functions
 * - Auto-detects authentication status
 * - Handles session expiration
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  const checkAuth = async () => {
    try {
      // Use dedicated auth endpoint
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser({
          username: userData.username,
          roles: userData.groups || [],
        });
      } else {
        // Not authenticated
        setUser(null);
      }
    } catch {
      // Network error or not authenticated
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Run auth check on mount
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Login with username and password
   */
  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Invalid username or password');
    }

    // After successful login, refetch user to update state
    await checkAuth();
  };

  /**
   * Logout and clear user state
   */
  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.warn('Logout failed:', error);
    }

    setUser(null);
  };

  // Check if authentication is actually enabled
  // In "open" mode, the backend returns a user with username "open"
  // but we should not show auth UI in this case
  const isAuthEnabled = user !== null && user.username !== 'open';

  const value: AuthContextState = {
    user,
    isAuthenticated: user !== null,
    isAuthEnabled,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
