import { describe, it, expect } from 'vitest';
import {
  buildClusterSectionUrl,
  extractSectionFromPath,
  extractClusterIdFromPath,
  parseClusterPath,
} from './urlBuilders';

/**
 * Unit tests for URL builder utilities
 * Modals are now driven by search params — no path-based modal builders to test.
 * Requirements: 1.0, 1.1, 1.2, 1.3, 2.0, 2.1
 */
describe('URL Builders', () => {
  describe('buildClusterSectionUrl', () => {
    it('should build valid section URLs', () => {
      expect(buildClusterSectionUrl('my-cluster', 'overview')).toBe('/cluster/my-cluster/overview');
      expect(buildClusterSectionUrl('my-cluster', 'statistics')).toBe('/cluster/my-cluster/statistics');
      expect(buildClusterSectionUrl('my-cluster', 'nodes')).toBe('/cluster/my-cluster/nodes');
    });

    it('should use default section when not provided', () => {
      expect(buildClusterSectionUrl('my-cluster')).toContain('/cluster/my-cluster/');
    });

    it('should use default section for invalid sections', () => {
      const result = buildClusterSectionUrl('my-cluster', 'invalid' as never);
      expect(result).toContain('/cluster/my-cluster/');
    });

    it('should handle cluster IDs with special characters', () => {
      expect(buildClusterSectionUrl('my-cluster-2', 'overview')).toBe('/cluster/my-cluster-2/overview');
    });
  });

  describe('extractSectionFromPath', () => {
    it('should extract section from cluster section paths', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/overview')).toBe('overview');
      expect(extractSectionFromPath('/cluster/my-cluster/statistics')).toBe('statistics');
      expect(extractSectionFromPath('/cluster/my-cluster/nodes')).toBe('nodes');
      expect(extractSectionFromPath('/cluster/my-cluster/topology')).toBe('topology');
    });

    it('should extract background section from bg query parameter (legacy)', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/nodes', '?bg=topology')).toBe('topology');
      expect(extractSectionFromPath('/cluster/my-cluster/indices', '?bg=statistics')).toBe('statistics');
    });

    it('should return undefined for base cluster path', () => {
      expect(extractSectionFromPath('/cluster/my-cluster')).toBeUndefined();
    });

    it('should return undefined for non-cluster paths', () => {
      expect(extractSectionFromPath('/dashboard')).toBeUndefined();
      expect(extractSectionFromPath('/')).toBeUndefined();
    });

    it('should return undefined for invalid sections', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/invalid-section')).toBeUndefined();
    });
  });

  describe('extractClusterIdFromPath', () => {
    it('should extract cluster ID from various cluster paths', () => {
      expect(extractClusterIdFromPath('/cluster/my-cluster')).toBe('my-cluster');
      expect(extractClusterIdFromPath('/cluster/my-cluster/overview')).toBe('my-cluster');
      expect(extractClusterIdFromPath('/cluster/my-cluster/nodes')).toBe('my-cluster');
    });

    it('should return undefined for non-cluster paths', () => {
      expect(extractClusterIdFromPath('/dashboard')).toBeUndefined();
      expect(extractClusterIdFromPath('/')).toBeUndefined();
    });

    it('should handle cluster IDs with special characters', () => {
      expect(extractClusterIdFromPath('/cluster/my-cluster-2')).toBe('my-cluster-2');
      expect(extractClusterIdFromPath('/cluster/prod_cluster')).toBe('prod_cluster');
    });
  });

  describe('parseClusterPath', () => {
    it('should parse section paths', () => {
      const result = parseClusterPath('/cluster/my-cluster/overview');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.section).toBe('overview');
    });

    it('should return clusterId only for base cluster path', () => {
      const result = parseClusterPath('/cluster/my-cluster');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.section).toBeUndefined();
    });

    it('should return empty object for non-cluster paths', () => {
      const result = parseClusterPath('/dashboard');
      expect(result.clusterId).toBeUndefined();
    });
  });
});
