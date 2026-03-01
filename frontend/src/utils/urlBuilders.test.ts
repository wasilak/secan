import { describe, it, expect } from 'vitest';
import {
  buildClusterSectionUrl,
  buildNodeModalUrl,
  buildIndexModalUrl,
  buildShardModalUrl,
  extractSectionFromPath,
  extractClusterIdFromPath,
  extractNodeIdFromPath,
  extractIndexNameFromPath,
  extractShardIdFromPath,
  parseClusterPath,
} from './urlBuilders';

/**
 * Unit tests for URL builder utilities
 * Requirements: 1.0, 1.1, 1.2, 1.3, 2.0, 2.1
 */
describe('URL Builders', () => {
  describe('buildClusterSectionUrl', () => {
    it('should build valid section URLs', () => {
      expect(buildClusterSectionUrl('my-cluster', 'overview')).toBe('/cluster/my-cluster/overview');
      expect(buildClusterSectionUrl('my-cluster', 'statistics')).toBe(
        '/cluster/my-cluster/statistics'
      );
      expect(buildClusterSectionUrl('my-cluster', 'nodes')).toBe('/cluster/my-cluster/nodes');
    });

    it('should use default section when not provided', () => {
      expect(buildClusterSectionUrl('my-cluster')).toContain('/cluster/my-cluster/');
    });

    it('should use default section for invalid sections', () => {
      const result = buildClusterSectionUrl('my-cluster', 'invalid' as any);
      expect(result).toContain('/cluster/my-cluster/');
    });

    it('should handle cluster IDs with special characters', () => {
      const result = buildClusterSectionUrl('my-cluster-2', 'overview');
      expect(result).toBe('/cluster/my-cluster-2/overview');
    });
  });

  describe('buildNodeModalUrl', () => {
    it('should build valid node modal URLs', () => {
      expect(buildNodeModalUrl('my-cluster', 'node-1')).toBe('/cluster/my-cluster/nodes/node-1');
      expect(buildNodeModalUrl('my-cluster', 'primary-node')).toBe(
        '/cluster/my-cluster/nodes/primary-node'
      );
    });

    it('should encode node IDs with special characters', () => {
      expect(buildNodeModalUrl('my-cluster', 'node@1')).toBe('/cluster/my-cluster/nodes/node%401');
      expect(buildNodeModalUrl('my-cluster', 'node/1')).toBe('/cluster/my-cluster/nodes/node%2F1');
    });

    it('should include background section as query parameter', () => {
      expect(buildNodeModalUrl('my-cluster', 'node-1', 'topology')).toBe(
        '/cluster/my-cluster/nodes/node-1?bg=topology'
      );
      expect(buildNodeModalUrl('my-cluster', 'node-1', 'statistics')).toBe(
        '/cluster/my-cluster/nodes/node-1?bg=statistics'
      );
    });

    it('should not include bg parameter when section matches modal type', () => {
      const url1 = buildNodeModalUrl('my-cluster', 'node-1');
      const url2 = buildNodeModalUrl('my-cluster', 'node-1', 'nodes');
      expect(url1).toBe(url2);
      expect(url1).toBe('/cluster/my-cluster/nodes/node-1');
    });
  });

  describe('buildIndexModalUrl', () => {
    it('should build valid index modal URLs without section', () => {
      expect(buildIndexModalUrl('my-cluster', 'my-index')).toBe(
        '/cluster/my-cluster/indices/my-index'
      );
    });

    it('should build valid index modal URLs with section', () => {
      expect(buildIndexModalUrl('my-cluster', 'my-index', 'general')).toBe(
        '/cluster/my-cluster/indices/my-index?section=general'
      );
      expect(buildIndexModalUrl('my-cluster', 'my-index', 'mappings')).toBe(
        '/cluster/my-cluster/indices/my-index?section=mappings'
      );
    });

    it('should encode index names with special characters', () => {
      expect(buildIndexModalUrl('my-cluster', 'my.index')).toBe(
        '/cluster/my-cluster/indices/my.index'
      );
      expect(buildIndexModalUrl('my-cluster', 'my-index-2020')).toBe(
        '/cluster/my-cluster/indices/my-index-2020'
      );
    });

    it('should encode section parameters', () => {
      expect(buildIndexModalUrl('my-cluster', 'my-index', 'custom section')).toContain(
        'section=custom%20section'
      );
    });

    it('should include background section as query parameter', () => {
      expect(buildIndexModalUrl('my-cluster', 'my-index', 'general', 'topology')).toBe(
        '/cluster/my-cluster/indices/my-index?section=general&bg=topology'
      );
      expect(buildIndexModalUrl('my-cluster', 'my-index', undefined, 'statistics')).toBe(
        '/cluster/my-cluster/indices/my-index?bg=statistics'
      );
    });

    it('should not include bg parameter when section matches modal type', () => {
      const url = buildIndexModalUrl('my-cluster', 'my-index', 'general', 'indices');
      expect(url).toBe('/cluster/my-cluster/indices/my-index?section=general');
    });
  });

  describe('buildShardModalUrl', () => {
    it('should build valid shard modal URLs', () => {
      expect(buildShardModalUrl('my-cluster', 'my-index[0]')).toBe(
        '/cluster/my-cluster/shards/my-index%5B0%5D'
      );
      expect(buildShardModalUrl('my-cluster', 'my-index[1]')).toBe(
        '/cluster/my-cluster/shards/my-index%5B1%5D'
      );
    });

    it('should encode shard IDs properly', () => {
      const url = buildShardModalUrl('my-cluster', 'my-index[2]');
      expect(url).toContain('shards/');
      expect(decodeURIComponent(url)).toContain('my-index[2]');
    });

    it('should include background section as query parameter', () => {
      expect(buildShardModalUrl('my-cluster', 'my-index[0]', 'topology')).toBe(
        '/cluster/my-cluster/shards/my-index%5B0%5D?bg=topology'
      );
      expect(buildShardModalUrl('my-cluster', 'my-index[0]', 'statistics')).toBe(
        '/cluster/my-cluster/shards/my-index%5B0%5D?bg=statistics'
      );
    });

    it('should not include bg parameter when section matches modal type', () => {
      const url1 = buildShardModalUrl('my-cluster', 'my-index[0]');
      const url2 = buildShardModalUrl('my-cluster', 'my-index[0]', 'shards');
      expect(url1).toBe(url2);
      expect(url1).toBe('/cluster/my-cluster/shards/my-index%5B0%5D');
    });
  });

  describe('extractSectionFromPath', () => {
    it('should extract section from cluster section paths', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/overview')).toBe('overview');
      expect(extractSectionFromPath('/cluster/my-cluster/statistics')).toBe('statistics');
      expect(extractSectionFromPath('/cluster/my-cluster/nodes')).toBe('nodes');
    });

    it('should infer section from modal paths', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/nodes/node-1')).toBe('nodes');
      expect(extractSectionFromPath('/cluster/my-cluster/indices/my-index')).toBe('indices');
      expect(extractSectionFromPath('/cluster/my-cluster/shards/my-index%5B0%5D')).toBe('shards');
    });

    it('should extract background section from bg query parameter', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/nodes/node-1', '?bg=topology')).toBe(
        'topology'
      );
      expect(extractSectionFromPath('/cluster/my-cluster/indices/my-index', '?bg=statistics')).toBe(
        'statistics'
      );
      expect(extractSectionFromPath('/cluster/my-cluster/shards/my-index%5B0%5D', '?bg=topology')).toBe(
        'topology'
      );
    });

    it('should prioritize bg parameter over inferred section', () => {
      expect(extractSectionFromPath('/cluster/my-cluster/nodes/node-1', '?bg=overview')).toBe(
        'overview'
      );
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
      expect(extractClusterIdFromPath('/cluster/my-cluster/nodes/node-1')).toBe('my-cluster');
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

  describe('extractNodeIdFromPath', () => {
    it('should extract node ID from node modal paths', () => {
      expect(extractNodeIdFromPath('/cluster/my-cluster/nodes/node-1')).toBe('node-1');
      expect(extractNodeIdFromPath('/cluster/my-cluster/nodes/primary-node')).toBe(
        'primary-node'
      );
    });

    it('should return undefined for non-node-modal paths', () => {
      expect(extractNodeIdFromPath('/cluster/my-cluster/overview')).toBeUndefined();
      expect(extractNodeIdFromPath('/cluster/my-cluster/indices/my-index')).toBeUndefined();
    });

    it('should decode encoded node IDs', () => {
      expect(extractNodeIdFromPath('/cluster/my-cluster/nodes/node%401')).toBe('node@1');
    });
  });

  describe('extractIndexNameFromPath', () => {
    it('should extract index name from index modal paths', () => {
      expect(extractIndexNameFromPath('/cluster/my-cluster/indices/my-index')).toBe('my-index');
      expect(extractIndexNameFromPath('/cluster/my-cluster/indices/my.index')).toBe('my.index');
    });

    it('should extract index name even with query parameters', () => {
      expect(extractIndexNameFromPath('/cluster/my-cluster/indices/my-index?section=general')).toBe(
        'my-index'
      );
    });

    it('should return undefined for non-index-modal paths', () => {
      expect(extractIndexNameFromPath('/cluster/my-cluster/overview')).toBeUndefined();
      expect(extractIndexNameFromPath('/cluster/my-cluster/nodes/node-1')).toBeUndefined();
    });

    it('should decode encoded index names', () => {
      expect(extractIndexNameFromPath('/cluster/my-cluster/indices/my%20index')).toBe('my index');
    });
  });

  describe('extractShardIdFromPath', () => {
    it('should extract shard ID from shard modal paths', () => {
      expect(extractShardIdFromPath('/cluster/my-cluster/shards/my-index%5B0%5D')).toBe(
        'my-index[0]'
      );
      expect(extractShardIdFromPath('/cluster/my-cluster/shards/my-index%5B1%5D')).toBe(
        'my-index[1]'
      );
    });

    it('should return undefined for non-shard-modal paths', () => {
      expect(extractShardIdFromPath('/cluster/my-cluster/overview')).toBeUndefined();
      expect(extractShardIdFromPath('/cluster/my-cluster/nodes/node-1')).toBeUndefined();
    });

    it('should decode encoded shard IDs', () => {
      const decoded = extractShardIdFromPath('/cluster/my-cluster/shards/my-index%5B0%5D');
      expect(decoded).toContain('[0]');
    });
  });

  describe('parseClusterPath', () => {
    it('should parse section paths', () => {
      const result = parseClusterPath('/cluster/my-cluster/overview');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.section).toBe('overview');
      expect(result.modal).toBeUndefined();
    });

    it('should parse node modal paths', () => {
      const result = parseClusterPath('/cluster/my-cluster/nodes/node-1');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.modal).toBe('node');
      expect(result.nodeId).toBe('node-1');
    });

    it('should parse index modal paths', () => {
      const result = parseClusterPath('/cluster/my-cluster/indices/my-index');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.modal).toBe('index');
      expect(result.indexName).toBe('my-index');
    });

    it('should parse shard modal paths', () => {
      const result = parseClusterPath('/cluster/my-cluster/shards/my-index%5B0%5D');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.modal).toBe('shard');
      expect(result.shardId).toBe('my-index[0]');
    });

    it('should return empty object for non-cluster paths', () => {
      const result = parseClusterPath('/dashboard');
      expect(result.clusterId).toBeUndefined();
    });

    it('should handle base cluster path', () => {
      const result = parseClusterPath('/cluster/my-cluster');
      expect(result.clusterId).toBe('my-cluster');
      expect(result.section).toBeUndefined();
      expect(result.modal).toBeUndefined();
    });
  });
});
