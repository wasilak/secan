import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences } from './usePreferences';
import { DEFAULT_PREFERENCES } from '../types/preferences';

describe('usePreferences', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should return default preferences when localStorage is empty', () => {
      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should load preferences from localStorage if they exist', () => {
      const storedPreferences = {
        theme: 'dark' as const,
        refreshInterval: 60000,
        lastSelectedCluster: 'prod-main',
        restConsoleHistory: [],
      };

      localStorage.setItem('secan-preferences', JSON.stringify(storedPreferences));

      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences).toEqual(storedPreferences);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('secan-preferences', 'invalid json{');

      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should use defaults for invalid theme values', () => {
      const storedPreferences = {
        theme: 'invalid-theme',
        refreshInterval: 30000,
        restConsoleHistory: [],
      };

      localStorage.setItem('secan-preferences', JSON.stringify(storedPreferences));

      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences.theme).toBe(DEFAULT_PREFERENCES.theme);
    });

    it('should use defaults for invalid refreshInterval values', () => {
      const storedPreferences = {
        theme: 'dark',
        refreshInterval: -1000, // Invalid negative value
        restConsoleHistory: [],
      };

      localStorage.setItem('secan-preferences', JSON.stringify(storedPreferences));

      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences.refreshInterval).toBe(DEFAULT_PREFERENCES.refreshInterval);
    });

    it('should use defaults for non-array restConsoleHistory', () => {
      const storedPreferences = {
        theme: 'dark',
        refreshInterval: 30000,
        restConsoleHistory: 'not an array',
      };

      localStorage.setItem('secan-preferences', JSON.stringify(storedPreferences));

      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences.restConsoleHistory).toEqual(DEFAULT_PREFERENCES.restConsoleHistory);
    });
  });

  describe('updatePreference', () => {
    it('should update theme preference', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.updatePreference('theme', 'dark');
      });

      expect(result.current.preferences.theme).toBe('dark');
    });

    it('should update refreshInterval preference', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.updatePreference('refreshInterval', 60000);
      });

      expect(result.current.preferences.refreshInterval).toBe(60000);
    });

    it('should update lastSelectedCluster preference', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.updatePreference('lastSelectedCluster', 'prod-main');
      });

      expect(result.current.preferences.lastSelectedCluster).toBe('prod-main');
    });

    it('should update restConsoleHistory preference', () => {
      const { result } = renderHook(() => usePreferences());

      const history = [
        {
          timestamp: Date.now(),
          method: 'GET',
          path: '/_cat/nodes',
        },
      ];

      act(() => {
        result.current.updatePreference('restConsoleHistory', history);
      });

      expect(result.current.preferences.restConsoleHistory).toEqual(history);
    });

    it('should persist updated preferences to localStorage', () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.updatePreference('theme', 'dark');
        result.current.updatePreference('refreshInterval', 60000);
      });

      const stored = localStorage.getItem('secan-preferences');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.theme).toBe('dark');
      expect(parsed.refreshInterval).toBe(60000);
    });
  });

  describe('resetPreferences', () => {
    it('should reset all preferences to defaults', () => {
      const { result } = renderHook(() => usePreferences());

      // Set some custom preferences
      act(() => {
        result.current.updatePreference('theme', 'dark');
        result.current.updatePreference('refreshInterval', 60000);
        result.current.updatePreference('lastSelectedCluster', 'prod-main');
      });

      // Reset to defaults
      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should save default preferences to localStorage after reset', () => {
      const { result } = renderHook(() => usePreferences());

      // Set some preferences
      act(() => {
        result.current.updatePreference('theme', 'dark');
      });

      expect(localStorage.getItem('secan-preferences')).toBeTruthy();

      // Reset
      act(() => {
        result.current.resetPreferences();
      });

      // After reset, default preferences should be saved to localStorage
      const stored = localStorage.getItem('secan-preferences');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(DEFAULT_PREFERENCES);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist preferences across hook instances', () => {
      const { result: result1 } = renderHook(() => usePreferences());

      act(() => {
        result1.current.updatePreference('theme', 'dark');
        result1.current.updatePreference('refreshInterval', 60000);
      });

      // Create a new hook instance (simulating page refresh)
      const { result: result2 } = renderHook(() => usePreferences());

      expect(result2.current.preferences.theme).toBe('dark');
      expect(result2.current.preferences.refreshInterval).toBe(60000);
    });
  });

  describe('round-trip persistence', () => {
    it('should maintain preference values through save and load cycle', () => {
      const testPreferences = {
        theme: 'dark' as const,
        refreshInterval: 45000,
        lastSelectedCluster: 'staging-cluster',
        restConsoleHistory: [
          {
            timestamp: 1234567890,
            method: 'GET',
            path: '/_cluster/health',
            body: undefined,
            response: '{"status":"green"}',
          },
        ],
      };

      const { result: result1 } = renderHook(() => usePreferences());

      // Set all preferences
      act(() => {
        result1.current.updatePreference('theme', testPreferences.theme);
        result1.current.updatePreference('refreshInterval', testPreferences.refreshInterval);
        result1.current.updatePreference('lastSelectedCluster', testPreferences.lastSelectedCluster);
        result1.current.updatePreference('restConsoleHistory', testPreferences.restConsoleHistory);
      });

      // Create new hook instance to load from localStorage
      const { result: result2 } = renderHook(() => usePreferences());

      expect(result2.current.preferences).toEqual(testPreferences);
    });
  });
});
