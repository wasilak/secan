/**
 * Centralised React Query key factory.
 *
 * All query keys in the application must be derived from this object so that
 * cache invalidation is deterministic and type-safe.
 *
 * Usage examples:
 *   queryKeys.clusters.all()          → ['clusters']
 *   queryKeys.clusters.list()         → ['clusters', 'list']
 *   queryKeys.cluster('abc').all()    → ['cluster', 'abc']
 *   queryKeys.cluster('abc').health() → ['cluster', 'abc', 'health']
 */
export const queryKeys = {
  clusters: {
    all: () => ['clusters'] as const,
    list: () => ['clusters', 'list'] as const,
  },

  cluster: (id: string) => ({
    all: () => ['cluster', id] as const,
    stats: () => ['cluster', id, 'stats'] as const,
    health: () => ['cluster', id, 'health'] as const,
    settings: () => ['cluster', id, 'settings'] as const,
    nodes: (page?: number, perPage?: number, filters?: string | object) => ['cluster', id, 'nodes', page, perPage, filters] as const,
    indices: (page?: number, filters?: string | object, all?: boolean) => ['cluster', id, 'indices', page, filters, all] as const,
    shards: (page?: number, filters?: string | object, indexName?: string) => ['cluster', id, 'shards', page, filters, indexName] as const,
    nodeShardSummary: () => ['cluster', id, 'nodes', 'shard-summary'] as const,
    snapshots: (repository?: string) => ['cluster', id, 'snapshots', repository] as const,
    tasks: (filters?: string | object) => ['cluster', id, 'tasks', filters] as const,
    templates: () => ['cluster', id, 'templates'] as const,
    aliases: () => ['cluster', id, 'aliases'] as const,
    mappings: (index: string) => ['cluster', id, 'mappings', index] as const,
    index: (indexName: string) => ({
      all: () => ['cluster', id, 'index', indexName] as const,
      stats: () => ['cluster', id, 'index', indexName, 'stats'] as const,
      settings: () => ['cluster', id, 'index', indexName, 'settings'] as const,
      mappings: () => ['cluster', id, 'index', indexName, 'mappings'] as const,
      analyzers: () => ['cluster', id, 'index', indexName, 'analyzers'] as const,
      fields: () => ['cluster', id, 'index', indexName, 'fields'] as const,
    }),
    node: (nodeId: string) => ({
      all: () => ['cluster', id, 'node', nodeId] as const,
      stats: () => ['cluster', id, 'node', nodeId, 'stats'] as const,
      metrics: (timeRange: number) => ['cluster', id, 'node', nodeId, 'metrics', timeRange] as const,
    }),
    metricsHistory: (timeRangeMinutes: number) => ['cluster', id, 'metrics-history', timeRangeMinutes] as const,
    repositories: () => ['cluster', id, 'repositories'] as const,
    catApi: (endpoint: string) => ['cluster', id, 'cat', endpoint] as const,
    catHelp: (endpoint: string) => ['cluster', id, 'cat-help', endpoint] as const,
    catEndpoints: () => ['cluster', id, 'cat-endpoints'] as const,
    info: () => ['cluster', id, 'info'] as const,
    watermarks: () => ['cluster', id, 'watermarks'] as const,
  }),
} as const;
