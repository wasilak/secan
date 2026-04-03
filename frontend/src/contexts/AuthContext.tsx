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
  // Run auth check on mount
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const checkAuth = async () => {
      try {
        // Use dedicated auth endpoint
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal,
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
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Network error or not authenticated
        setUser(null);
      } finally {
        // Only update loading state if not aborted
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      controller.abort();
    };
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

    // Parse the login response body where the server may include a
    // `session_token` (useful when cookies are not set due to Secure/SameSite
    // issues). We still rely on the HttpOnly cookie for normal auth.
    const loginBody = await response.json().catch(() => ({ message: 'Login failed' }));

    if (!response.ok) {
      throw new Error(loginBody.message || 'Invalid username or password');
    }

    // After successful login, confirm authenticated user state. If this
    // fails it usually indicates the browser did not send the session cookie
    // (e.g. Secure/SameSite mismatch). Provide a helpful error message so the
    // user (or dev) can act instead of seeing a generic failure.
    const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
    if (!meResponse.ok) {
      // Attempt to read a useful message from the /api/auth/me response body
    const meErr = await meResponse
        .json()
        .catch(() => ({} as Record<string, unknown>));

      // If the login response included a session token, we can hint that the
      // cookie was likely not set or not sent by the browser.
      if (loginBody && loginBody.session_token) {
        const serverMsg = meErr?.message || `status ${meResponse.status}`;
        const hint =
          'Login succeeded but the application could not confirm your session. ' +
          'This commonly happens when the browser does not send the session cookie (Secure/SameSite settings). ' +
          'If Secan is served over HTTPS, ensure the backend sets secure cookies (SECAN_SECURE_COOKIES=true). ' +
          `Server: ${serverMsg}`;
        setUser(null);
        throw new Error(hint);
      }

      // Fallback: surface server-provided message if present
      const fallback = meErr?.message || 'Failed to fetch authenticated user after login';
      setUser(null);
      throw new Error(fallback);
    }

    const userData = await meResponse.json();
    setUser({ username: userData.username, roles: userData.groups || [] });
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
    
    // Redirect to login page with logout flag to prevent OIDC auto-redirect
    // This ensures the user sees a manual login button without countdown
    window.location.href = '/login?logged_out=true';
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
