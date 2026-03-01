import { describe, it, expect } from 'vitest';
import { isOldFormatUrl, buildNewUrl } from './routeRedirects';

/**
 * Unit tests for route redirect middleware
 * Requirements: 3.0, 3.1
 */
describe('Route Redirects', () => {
  describe('isOldFormatUrl', () => {
    it('should detect old query-param format URLs', () => {
      expect(isOldFormatUrl('/cluster/my-cluster', '?tab=statistics')).toBe(true);
      expect(isOldFormatUrl('/cluster/my-cluster', '?tab=nodes&node=node-1')).toBe(true);
      expect(isOldFormatUrl('/cluster/my-cluster', '?node=node-1')).toBe(true);
      expect(isOldFormatUrl('/cluster/my-cluster', '?index=my-index')).toBe(true);
      expect(isOldFormatUrl('/cluster/my-cluster', '?shard=my-index%5B0%5D')).toBe(true);
    });

    it('should not detect new format URLs', () => {
      expect(isOldFormatUrl('/cluster/my-cluster/overview', '')).toBe(false);
      expect(isOldFormatUrl('/cluster/my-cluster/statistics', '')).toBe(false);
      expect(isOldFormatUrl('/cluster/my-cluster/nodes/node-1', '')).toBe(false);
    });

    it('should detect old format with other parameters', () => {
      expect(isOldFormatUrl('/cluster/my-cluster', '?tab=indices&indicesSearch=test')).toBe(true);
      expect(isOldFormatUrl('/cluster/my-cluster', '?health=green&status=open&tab=indices')).toBe(
        true
      );
    });

    it('should not detect non-cluster paths', () => {
      expect(isOldFormatUrl('/dashboard', '?tab=overview')).toBe(false);
      expect(isOldFormatUrl('/', '?tab=something')).toBe(false);
    });
  });

  describe('buildNewUrl', () => {
    describe('tab parameter redirects', () => {
      it('should redirect ?tab=section to /section', () => {
        expect(buildNewUrl('/cluster/my-cluster', '?tab=statistics')).toBe(
          '/cluster/my-cluster/statistics'
        );
        expect(buildNewUrl('/cluster/my-cluster', '?tab=nodes')).toBe('/cluster/my-cluster/nodes');
        expect(buildNewUrl('/cluster/my-cluster', '?tab=indices')).toBe(
          '/cluster/my-cluster/indices'
        );
        expect(buildNewUrl('/cluster/my-cluster', '?tab=shards')).toBe('/cluster/my-cluster/shards');
      });

      it('should handle missing tab parameter', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?other=param');
        expect(result).toContain('/cluster/my-cluster');
      });
    });

    describe('node modal redirects', () => {
      it('should redirect ?node=nodeId to /nodes/nodeId', () => {
        expect(buildNewUrl('/cluster/my-cluster', '?node=node-1')).toBe(
          '/cluster/my-cluster/nodes/node-1'
        );
        expect(buildNewUrl('/cluster/my-cluster', '?tab=overview&node=primary')).toBe(
          '/cluster/my-cluster/nodes/primary'
        );
      });

      it('should encode node IDs', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?node=node@1');
        expect(result).toContain('nodes/node%401');
      });

      it('should prioritize node over tab', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?tab=nodes&node=node-1');
        expect(result).toBe('/cluster/my-cluster/nodes/node-1');
      });
    });

    describe('index modal redirects', () => {
      it('should redirect ?index=name to /indices/name', () => {
        expect(buildNewUrl('/cluster/my-cluster', '?index=my-index')).toBe(
          '/cluster/my-cluster/indices/my-index'
        );
        expect(buildNewUrl('/cluster/my-cluster', '?index=logs-2024-01')).toBe(
          '/cluster/my-cluster/indices/logs-2024-01'
        );
      });

      it('should handle index with section parameter', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?index=my-index&indexTab=mappings');
        expect(result).toContain('/indices/my-index?section=mappings');
      });

      it('should use general as default index section', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?index=my-index');
        expect(result).not.toContain('?section=');
      });

      it('should prioritize index over tab', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?tab=indices&index=my-index');
        expect(result).toBe('/cluster/my-cluster/indices/my-index');
      });

      it('should encode index names with special chars', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?index=my.index-2024');
        expect(result).toContain('my.index-2024');
      });
    });

    describe('shard modal redirects', () => {
      it('should redirect ?shard=id to /shards/id', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?shard=my-index%5B0%5D');
        expect(result).toContain('/shards/');
        expect(decodeURIComponent(result)).toContain('my-index[0]');
      });

      it('should prioritize shard over other params', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?tab=shards&shard=my-index%5B1%5D');
        expect(result).toContain('/shards/');
      });
    });

    describe('parameter preservation', () => {
      it('should preserve non-modal search parameters', () => {
        const result = buildNewUrl(
          '/cluster/my-cluster',
          '?tab=indices&indicesSearch=test&health=green'
        );
        expect(result).toContain('indicesSearch=test');
        expect(result).toContain('health=green');
      });

      it('should preserve filter parameters', () => {
        const result = buildNewUrl(
          '/cluster/my-cluster',
          '?tab=indices&status=open&health=yellow'
        );
        expect(result).toContain('status=open');
        expect(result).toContain('health=yellow');
      });

      it('should handle pagination parameters', () => {
        const result = buildNewUrl(
          '/cluster/my-cluster',
          '?tab=indices&indicesPage=2&overviewPage=1'
        );
        expect(result).toContain('indicesPage=2');
        expect(result).toContain('overviewPage=1');
      });

      it('should remove deprecated tab parameter from preserved params', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?tab=nodes&overviewSearch=test');
        expect(result).not.toContain('tab=');
      });
    });

    describe('edge cases', () => {
      it('should handle URLs with only cluster ID', () => {
        expect(buildNewUrl('/cluster/my-cluster', '')).toContain('/cluster/my-cluster');
      });

      it('should handle invalid path patterns', () => {
        expect(buildNewUrl('/invalid-path', '?tab=statistics')).toBeNull();
      });

      it('should handle cluster IDs with special characters', () => {
        expect(buildNewUrl('/cluster/prod-cluster-2', '?tab=overview')).toContain(
          '/prod-cluster-2/overview'
        );
      });

      it('should handle multiple parameters correctly', () => {
        const result = buildNewUrl(
          '/cluster/my-cluster',
          '?tab=indices&indicesSearch=test&health=green&status=open'
        );
        expect(result).toContain('/indices');
        expect(result).toContain('indicesSearch=test');
        expect(result).toContain('health=green');
        expect(result).toContain('status=open');
      });

      it('should handle URL encoded characters', () => {
        const result = buildNewUrl('/cluster/my-cluster', '?index=my%20index');
        expect(result).toContain('my%20index');
      });
    });
  });
});
