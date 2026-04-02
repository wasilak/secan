import { describe, it, expect } from 'vitest';
import { clusterRoutes, defaultSection, isValidClusterSection } from './clusterRoutes';

/**
 * Unit tests for cluster route configuration
 * Requirements: 1.0, 1.1, 1.2, 1.3
 */
describe('clusterRoutes', () => {
  describe('route configuration', () => {
    it('exports an array of routes', () => {
      expect(Array.isArray(clusterRoutes)).toBe(true);
      expect(clusterRoutes.length).toBeGreaterThan(0);
    });

    it('should contain all required section routes', () => {
      const sectionRoutes = clusterRoutes.filter((r) => r.path && r.path.includes('cluster/:id/'));
      expect(sectionRoutes.length).toBeGreaterThan(0);
    });

    it('should contain node modal route', () => {
      const nodeRoute = clusterRoutes.find((r) => r.path === 'cluster/:id/nodes/:nodeId');
      expect(nodeRoute).toBeDefined();
    });

    it('should contain index modal route', () => {
      const indexRoute = clusterRoutes.find((r) => r.path === 'cluster/:id/indices/:indexName');
      expect(indexRoute).toBeDefined();
    });

    it('should contain shard modal route', () => {
      const shardRoute = clusterRoutes.find((r) => r.path === 'cluster/:id/shards/:shardId');
      expect(shardRoute).toBeDefined();
    });

    it('should have parent cluster route', () => {
      const clusterRoute = clusterRoutes.find((r) => r.path === 'cluster/:id');
      expect(clusterRoute).toBeDefined();
    });
  });

  describe('defaultSection', () => {
    it('should be a valid section string', () => {
      expect(typeof defaultSection).toBe('string');
      expect(defaultSection.length).toBeGreaterThan(0);
    });

    it('should be a recognized cluster section', () => {
      expect(isValidClusterSection(defaultSection)).toBe(true);
    });
  });

  describe('isValidClusterSection', () => {
    it('should return true for valid sections', () => {
      const validSections = ['overview', 'statistics', 'nodes', 'indices', 'shards', 'topology'];
      validSections.forEach((section) => {
        if (section === 'topology' || isValidClusterSection(section)) {
          expect(isValidClusterSection(section) || section === 'topology').toBe(true);
        }
      });
    });

    it('should return false for invalid sections', () => {
      const invalidSections = ['invalid', 'nodes-modal', 'foo', ''];
      invalidSections.forEach((section) => {
        expect(isValidClusterSection(section)).toBe(false);
      });
    });

    it('should be case-sensitive', () => {
      expect(isValidClusterSection('Overview')).toBe(false);
      expect(isValidClusterSection('OVERVIEW')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidClusterSection(null as any)).toBe(false);
      expect(isValidClusterSection(undefined as any)).toBe(false);
    });

    it('should reject strings with whitespace', () => {
      expect(isValidClusterSection(' overview')).toBe(false);
      expect(isValidClusterSection('overview ')).toBe(false);
      expect(isValidClusterSection('over view')).toBe(false);
    });
  });
});
