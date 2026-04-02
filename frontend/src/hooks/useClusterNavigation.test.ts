import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useClusterNavigation } from './useClusterNavigation';

/**
 * Unit tests for useClusterNavigation hook
 * Modals are driven by search params (?nodeModal, ?indexModal, ?shardModal).
 * Requirements: 2.0, 2.1
 */
describe('useClusterNavigation', () => {
  const renderWithPath = (path: string) => {
    window.history.pushState({}, '', path);
    return renderHook(() => useClusterNavigation(), { wrapper: BrowserRouter });
  };

  describe('navigateToSection', () => {
    it('should expose navigateToSection method', () => {
      const { result } = renderWithPath('/cluster/test-cluster/overview');
      expect(typeof result.current.navigateToSection).toBe('function');
    });
  });

  describe('navigateToNode', () => {
    it('should expose navigateToNode method', () => {
      const { result } = renderWithPath('/cluster/test-cluster/overview');
      expect(typeof result.current.navigateToNode).toBe('function');
    });
  });

  describe('navigateToIndex', () => {
    it('should expose navigateToIndex method', () => {
      const { result } = renderWithPath('/cluster/test-cluster/overview');
      expect(typeof result.current.navigateToIndex).toBe('function');
    });
  });

  describe('navigateToShard', () => {
    it('should expose navigateToShard method', () => {
      const { result } = renderWithPath('/cluster/test-cluster/overview');
      expect(typeof result.current.navigateToShard).toBe('function');
    });
  });

  describe('closeModal', () => {
    it('should expose closeModal method', () => {
      const { result } = renderWithPath('/cluster/test-cluster/overview');
      expect(typeof result.current.closeModal).toBe('function');
    });
  });

  describe('currentSection', () => {
    it('should return current section from pathname', () => {
      const { result } = renderWithPath('/cluster/my-cluster/statistics');
      expect(result.current.currentSection()).toBe('statistics');
    });

    it('should return topology for topology paths', () => {
      const { result } = renderWithPath('/cluster/my-cluster/topology');
      expect(result.current.currentSection()).toBe('topology');
    });
  });

  describe('activeModal', () => {
    it('should return null if no modal search params present', () => {
      const { result } = renderWithPath('/cluster/my-cluster/overview');
      expect(result.current.activeModal()).toBeNull();
    });

    it('should detect node modal from ?nodeModal param', () => {
      const { result } = renderWithPath('/cluster/my-cluster/topology?nodeModal=node-1');
      const modal = result.current.activeModal();
      expect(modal?.type).toBe('node');
      expect(modal?.id).toBe('node-1');
    });

    it('should detect index modal from ?indexModal param', () => {
      const { result } = renderWithPath('/cluster/my-cluster/topology?indexModal=my-index');
      const modal = result.current.activeModal();
      expect(modal?.type).toBe('index');
      expect(modal?.id).toBe('my-index');
    });

    it('should detect shard modal from ?shardModal param', () => {
      const { result } = renderWithPath('/cluster/my-cluster/topology?shardModal=my-index%5B0%5D');
      const modal = result.current.activeModal();
      expect(modal?.type).toBe('shard');
      expect(modal?.id).toContain('my-index[0]');
    });
  });

  describe('isModalOpen', () => {
    it('should return false when no modal params present', () => {
      const { result } = renderWithPath('/cluster/my-cluster/overview');
      expect(result.current.isModalOpen()).toBe(false);
    });

    it('should return true when nodeModal param is set', () => {
      const { result } = renderWithPath('/cluster/my-cluster/topology?nodeModal=node-1');
      expect(result.current.isModalOpen()).toBe(true);
    });

    it('should return true when indexModal param is set', () => {
      const { result } = renderWithPath('/cluster/my-cluster/indices?indexModal=my-index');
      expect(result.current.isModalOpen()).toBe(true);
    });

    it('should return true when shardModal param is set', () => {
      const { result } = renderWithPath('/cluster/my-cluster/shards?shardModal=my-index%5B0%5D');
      expect(result.current.isModalOpen()).toBe(true);
    });
  });

  describe('getCurrentSection', () => {
    it('should return current section or default', () => {
      const { result } = renderWithPath('/cluster/my-cluster/statistics');
      expect(result.current.getCurrentSection()).toBe('statistics');
    });

    it('should return default section if not set', () => {
      const { result } = renderWithPath('/cluster/my-cluster');
      expect(typeof result.current.getCurrentSection()).toBe('string');
    });
  });

  describe('clusterId', () => {
    it('should return undefined if not in cluster view', () => {
      const { result } = renderWithPath('/dashboard');
      expect(result.current.clusterId).toBeUndefined();
    });
  });
});
