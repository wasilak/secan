/**
 * Compatibility shim for OpenAPI-generated types.
 *
 * Keep this file small: prefer aliases to the generated types in
 * ./openapi.generated.ts. Add local normalization only where the generated
 * schema uses `null` and the frontend expects `undefined`.
 */

import * as OAPI from './openapi.generated';
export { OAPI };

// Convert `null` in generated types to `undefined` recursively for nicer usage
type NullToUndefined<T> = T extends null
  ? undefined
  : T extends (infer U)[]
  ? NullToUndefined<U>[]
  : T extends object
  ? { [K in keyof T]: NullToUndefined<T[K]> }
  : T;

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export function getPaginatedItems<T>(response: PaginatedResponse<T> | undefined): T[] {
  return response?.items ?? [];
}

// Common aliases
// Tighten ClusterInfo for frontend: convert nullable name -> optional string
// and ensure nodes is an array. We keep the generated shape as the source of
// truth but expose a friendlier frontend alias where name may be undefined.
type _ClusterInfoGenerated = OAPI.components['schemas']['ClusterInfo'];
export type ClusterInfo = Omit<_ClusterInfoGenerated, 'name' | 'nodes'> & {
  name?: string | undefined;
  nodes: string[];
};
// Keep HealthStatus permissive: server may return additional values
// Include null in health status union for places that may pass null
export type HealthStatus = 'green' | 'yellow' | 'red' | null | 'unreachable' | string;

// Normalize a few frequently-used responses
export type ClusterStats = NullToUndefined<OAPI.components['schemas']['ClusterStatsResponse']>;
export type NodeInfo = NullToUndefined<OAPI.components['schemas']['NodeInfoResponse']>;
// NodeDetailStats: generated type declares cpuPercent and uptimeMillis as required
// but the frontend treats them as possibly missing/undefined. Provide a small
// targeted override to make those fields optional while preserving the
// NullToUndefined normalization for nested nulls.
type _NodeDetailStatsGenerated = NullToUndefined<
  OAPI.components['schemas']['NodeDetailStatsResponse']
>;
export type NodeDetailStats = Omit<_NodeDetailStatsGenerated, 'cpuPercent' | 'uptimeMillis' | 'loadAverage'> & {
  cpuPercent?: number | undefined;
  uptimeMillis?: number | undefined;
  loadAverage?: number[] | undefined;
};

// ShardInfo: generated ShardInfoResponse doesn't include relocatingNode used by
// several UI helpers. Add it as an optional field while keeping generated shape.
export type ShardInfo = NullToUndefined<
  OAPI.components['schemas']['ShardInfoResponse']
> & { relocatingNode?: string | undefined };
// Ensure items use our ShardInfo (which adds relocatingNode)
export type PaginatedShardsWithNodes = Omit<
  NullToUndefined<OAPI.components['schemas']['PaginatedShardsWithNodes']>,
  'items'
> & { items: ShardInfo[] };

// Backwards-compatible frontend-facing types not always present or named in the
// generated OpenAPI output. Prefer aliases to generated types where available
// and provide small local interfaces for server-only shapes.

// Cluster health returned by proxied _cluster/health (camelCased in frontend)
export type ClusterHealth = {
  status: 'green' | 'yellow' | 'red' | 'unreachable' | string;
  clusterName: string;
  numberOfNodes: number;
  numberOfDataNodes: number;
  activePrimaryShards: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
};

// Cluster settings shape returned by /_cluster/settings
export interface ClusterSettings {
  persistent: Record<string, unknown>;
  transient: Record<string, unknown>;
  defaults?: Record<string, unknown>;
}

// Index settings (inner settings object returned under indexName.settings)
export type IndexSettings = Record<string, unknown>;

// IndexInfo maps to generated IndexInfoResponse
export type IndexInfo = NullToUndefined<
  OAPI.components['schemas']['IndexInfoResponse']
>;

// NodeShardSummary is a server-side aggregation (not in OpenAPI), define locally
export interface NodeShardSummary {
  nodeId: string;
  nodeName: string;
  primary: number;
  replica: number;
  unassigned: number;
  total: number;
}

// Alias / request/response shapes used by client.ts but not present in generated types
export type LoginRequest = OAPI.components['schemas']['LoginRequest'];

export interface AliasInfo {
  alias: string;
  index: string;
  filter?: string;
  routing?: string;
  indexRouting?: string;
  searchRouting?: string;
  isWriteIndex?: boolean;
}

export interface CreateAliasRequest {
  alias: string;
  indices: string[];
  filter?: unknown;
  routing?: string;
  indexRouting?: string;
  searchRouting?: string;
  isWriteIndex?: boolean;
}

export interface TemplateInfo {
  name: string;
  indexPatterns?: string[];
  priority?: number;
  version?: number;
  settings?: Record<string, unknown>;
  mappings?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  composable?: boolean;
  order?: number;
}

export interface CreateTemplateRequest {
  name: string;
  indexPatterns: string[];
  composable?: boolean;
  priority?: number;
  version?: number;
  settings?: Record<string, unknown>;
  mappings?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  order?: number;
}

export interface AnalyzeTextRequest {
  text: string;
  analyzer?: string;
  tokenizer?: string;
  filter?: string[];
  charFilter?: string[];
  field?: string;
  index?: string;
}

export interface AnalyzeTextResponse {
  tokens: AnalysisToken[];
}

export interface IndexAnalyzersResponse {
  analyzers: Record<string, unknown>;
  tokenizers: Record<string, unknown>;
  filters: Record<string, unknown>;
  charFilters: Record<string, unknown>;
}

export interface FieldInfo {
  name: string;
  type: string;
  analyzer?: string;
  searchAnalyzer?: string;
  normalizer?: string;
  properties?: Record<string, unknown>;
  searchable?: boolean;
  aggregatable?: boolean;
  stored?: boolean;
}

export interface IndexFieldsResponse {
  fields: FieldInfo[];
}

export type RepositoryType = string;
export interface RepositoryInfo {
  name: string;
  type: RepositoryType;
  settings?: Record<string, unknown>;
}

export interface CreateRepositoryRequest {
  name: string;
  type: RepositoryType;
  settings?: Record<string, unknown>;
}

export interface SnapshotInfo {
  snapshot: string;
  uuid?: string;
  state?: string;
  // Indices and shards are required for frontend consumers — client normalizes
  // responses to always provide these fields (empty array / zeroed shards).
  indices: string[];
  // Keep both camelCase and snake_case tolerated by runtime normalizers
  // For frontend use we require startTime and durationInMillis to be present
  // — client.getSnapshots guarantees defaults for these fields.
  startTime: string;
  endTime: string | undefined;
  durationInMillis: number;
  // raw fields from server may be present; compatibility shim keeps snake_case too
  start_time?: string;
  end_time?: string;
  duration_in_millis?: number;
  // shards progress object is required (normalized to numbers)
  shards: { total: number; successful: number; failed: number };
}

export interface CreateSnapshotRequest {
  snapshot: string;
  indices?: string[];
  ignoreUnavailable?: boolean;
  includeGlobalState?: boolean;
  partial?: boolean;
}

export interface RestoreSnapshotRequest {
  indices?: string[];
  ignoreUnavailable?: boolean;
  includeGlobalState?: boolean;
  renamePattern?: string;
  renameReplacement?: string;
  includeAliases?: boolean;
  partial?: boolean;
}

// Provide a tightened IndexStats shape used by IndexStatistics page.
// Use camelCase keys matching the normalized shape produced by client.getIndexStats.
export interface StatsDocs {
  count: number;
  deleted: number;
}

export interface StatsStore {
  sizeInBytes: number;
}

export interface StatsSegments {
  count: number;
  memoryInBytes: number;
}

export interface StatsIndexing {
  indexTotal?: number;
  indexTimeInMillis?: number;
  indexCurrent?: number;
  indexFailed?: number;
  deleteTotal?: number;
  deleteTimeInMillis?: number;
  deleteCurrent?: number;
  throttleTimeInMillis?: number;
}

export interface StatsSearch {
  queryTotal?: number;
  queryTimeInMillis?: number;
  queryCurrent?: number;
  fetchTotal?: number;
  fetchTimeInMillis?: number;
  fetchCurrent?: number;
  scrollTotal?: number;
  scrollTimeInMillis?: number;
  scrollCurrent?: number;
}

export interface IndexStatsAlias {
  total: {
    docs: StatsDocs;
    store: StatsStore;
    segments?: StatsSegments;
    indexing?: StatsIndexing;
    search?: StatsSearch;
    merges?: Record<string, number>;
    refresh?: Record<string, number>;
    flush?: Record<string, number>;
  };
  primaries: {
    docs: StatsDocs;
    store: StatsStore;
    segments?: StatsSegments;
    indexing?: StatsIndexing;
    search?: StatsSearch;
    merges?: Record<string, number>;
    refresh?: Record<string, number>;
    flush?: Record<string, number>;
  };
}

// Replace the permissive shape with the tightened alias so components get
// strong types. The client already normalizes values to these camelCase fields.
export type IndexStats = IndexStatsAlias;

// Relocate shard response - keep minimal shape expected by client
export interface RelocateShardResponse {
  acknowledged?: boolean;
  state?: unknown;
}

// Frontend Sankey response: narrow the node.kind union and expose the small
// shape the UI expects. We normalize server variants in client.getSankeyData.
export type SankeyNodeKind = 'index' | 'node' | 'unassigned';
export interface SankeyNode {
  id: string;
  kind: SankeyNodeKind;
  totalShards: number;
  primaryShards: number;
  replicaShards: number;
  storeBytes: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  totalShards: number;
  primaryShards: number;
  replicaShards: number;
}

export interface SankeyResponse {
  nodes: SankeyNode[];
  links: SankeyLink[];
  meta: { truncated?: boolean; displayedIndices?: number; totalIndices?: number };
}

export interface SankeyQueryParams {
  topIndices?: number;
  includeUnassigned?: boolean;
  roles?: string;
  states?: string;
  excludeSpecial?: boolean;
  sortBy?: string;
}

// Metrics history responses - alias to generated where present
export type ClusterMetricsHistoryResponse = NullToUndefined<
  OAPI.components['schemas']['ClusterMetricsHistoryResponse']
>;
export type NodeMetricsHistoryResponse = NullToUndefined<
  OAPI.components['schemas']['NodeMetricsHistoryResponse']
>;

// Task types
export type TaskInfo = OAPI.components['schemas']['TaskInfo'];
export type TaskDetails = OAPI.components['schemas']['TaskDetails'];
export type TasksListResponse = OAPI.components['schemas']['TasksListResponse'];
// Small missing/renamed aliases expected by client.ts
export type CancelTaskResponse = NullToUndefined<
  OAPI.components['schemas']['CancelTaskResponse']
>;
export type TaskDetailsResponse = NullToUndefined<
  OAPI.components['schemas']['TaskDetailsResponse']
>;
export type RelocateShardRequest = OAPI.components['schemas']['RelocateShardRequest'];

// ThreadPoolStats is present in the generated schema
export type ThreadPoolStats = OAPI.components['schemas']['ThreadPoolStats'];

// Bulk operation types used by bulk-operations utilities and UI
export type BulkOperationType =
  | 'open'
  | 'close'
  | 'delete'
  | 'refresh'
  | 'set_read_only'
  | 'set_writable';

export interface BulkOperationValidationResult {
  validIndices: string[];
  ignoredIndices: string[];
  ignoreReasons: Record<string, string>;
}

// Analyzer/token shapes expected by IndexAnalyzers/TextAnalysis pages
export interface AnalyzerInfo {
  type?: string;
  tokenizer?: string;
  filter?: string[];
  charFilter?: string[];
  // Keep permissive for any other analyzer config
  [key: string]: unknown;
}

export interface AnalysisToken {
  token: string;
  position: number;
  startOffset: number;
  endOffset: number;
  type?: string;
  positionLength?: number;
}

// Snapshot state literal union expected by UI
export type SnapshotState = 'SUCCESS' | 'IN_PROGRESS' | 'FAILED' | 'PARTIAL' | string;

// TimeRange and ClusterMetrics used by metrics store
// Include label here — frontend stores expect it on TimeRange
export interface TimeRange {
  start: number;
  end: number;
  label: string;
}
export type ClusterMetrics = NullToUndefined<
  OAPI.components['schemas']['ClusterMetricsPoint']
>;

// Local shapes used by shard-grid parser and UI
export interface NodeWithShards extends NullToUndefined<OAPI.components['schemas']['NodeInfoResponse']> {
  // Map of index name -> array of shards on this node
  shards: Map<string, ShardInfo[]>;
}

export interface IndexMetadata extends IndexInfo {
  shardCount: number;
  docsCount: number;
  size: number;
}

export interface ShardGridData {
  nodes: NodeWithShards[];
  indices: IndexMetadata[];
  unassignedShards: ShardInfo[];
}

export interface DetailedShardStats extends ShardInfo {
  segments?: number;
  merges?: number;
  refreshes?: number;
  flushes?: number;
}

// Local API error shape kept for backward compatibility
export interface ApiError {
  data?: { reason?: string; root_cause?: Array<{ reason: string }> };
  status?: number;
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public error?: ApiError,
    public response?: ApiError,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Expose the generated openapi object for ad-hoc imports when necessary
export { OAPI as openapi };
