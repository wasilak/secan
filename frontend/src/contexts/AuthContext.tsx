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
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to fetch clusters - if it succeeds, we're authenticated
        // If it fails with 401, we're not authenticated
        await apiClient.getClusters();
        
        // For now, use a placeholder user
        // TODO: Implement actual user endpoint
        setUser({
          username: 'admin',
          roles: ['admin'],
        });
      } catch (error) {
        // Not authenticated or error - clear user
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Login with username and password
   */
  const login = async (username: string, password: string) => {
    await apiClient.login(username, password);
    
    // Set user after successful login
    setUser({
      username,
      roles: ['user'], // TODO: Get actual roles from backend
    });
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

  const value: AuthContextState = {
    user,
    isAuthenticated: user !== null,
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
