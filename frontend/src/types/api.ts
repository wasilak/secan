/**
 * API types for Secan backend communication
 */

/**
 * Cluster information returned by the backend
 */
export interface ClusterInfo {
  id: string;
  name: string;
  nodes: string[];
  accessible: boolean;
}

/**
 * Cluster health status
 */
export type HealthStatus = 'green' | 'yellow' | 'red';

/**
 * Cluster health information
 */
export interface ClusterHealth {
  status: HealthStatus;
  clusterName: string;
  numberOfNodes: number;
  numberOfDataNodes: number;
  activePrimaryShards: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public error?: ApiError
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Cluster statistics for overview display
 */
export interface ClusterStats {
  health: HealthStatus;
  clusterName: string;
  numberOfNodes: number;
  numberOfDataNodes: number;
  numberOfIndices: number;
  numberOfDocuments: number;
  activePrimaryShards: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
  memoryUsed?: number;
  memoryTotal?: number;
  diskUsed?: number;
  diskTotal?: number;
}

/**
 * Node role types
 */
export type NodeRole =
  | 'master'
  | 'data'
  | 'ingest'
  | 'coordinating'
  | 'ml'
  | 'remote_cluster_client';

/**
 * Node information
 */
export interface NodeInfo {
  id: string;
  name: string;
  roles: NodeRole[];
  heapUsed: number;
  heapMax: number;
  diskUsed: number;
  diskTotal: number;
  cpuPercent?: number;
  ip?: string;
  version?: string;
  tags?: string[];
  isMaster: boolean;
  isMasterEligible: boolean;
  loadAverage?: number; // 1-minute
  uptime?: string;
  uptimeMillis?: number;
}

/**
 * Shard statistics
 */
export interface ShardStats {
  total: number;
  primary: number;
  replica: number;
  list: ShardInfo[];
}

/**
 * Indexing statistics
 */
export interface IndexingStats {
  indexTotal: number;
  indexTimeInMillis: number;
  indexCurrent: number;
  indexFailed: number;
  deleteTotal: number;
  deleteTimeInMillis: number;
}

/**
 * Search statistics
 */
export interface SearchStats {
  queryTotal: number;
  queryTimeInMillis: number;
  queryCurrent: number;
  fetchTotal: number;
  fetchTimeInMillis: number;
}

/**
 * File system statistics
 */
export interface FileSystemStats {
  total: number;
  available: number;
  used: number;
  path: string;
  type: string;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  rxBytes: number;
  txBytes: number;
}

/**
 * JVM statistics
 */
export interface JvmStats {
  gcCollectors: Record<
    string,
    {
      collectionCount: number;
      collectionTimeInMillis: number;
    }
  >;
}

/**
 * Thread pool statistics
 */
export interface ThreadPoolStats {
  threads: number;
  queue: number;
  active: number;
  rejected: number;
  largest: number;
  completed: number;
}

/**
 * Detailed node statistics
 */
export interface NodeDetailStats {
  id: string;
  name: string;
  roles?: NodeRole[];
  ip?: string;
  version: string;
  jvmVersion: string;
  heapUsed: number;
  heapMax: number;
  heapPercent: number;
  diskUsed: number;
  diskTotal: number;
  diskPercent: number;
  cpuPercent?: number;
  loadAverage?: [number, number, number]; // 1m, 5m, 15m
  threadPools?: Record<string, ThreadPoolStats>;
  uptime?: string;
  uptimeMillis?: number;
  isMaster: boolean;
  isMasterEligible: boolean;
  shards?: ShardStats;
  indexing?: IndexingStats;
  search?: SearchStats;
  fs?: FileSystemStats;
  network?: NetworkStats;
  jvm?: JvmStats;
}

/**
 * Index status
 */
export type IndexStatus = 'open' | 'close';

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  health: HealthStatus;
  status: IndexStatus;
  primaryShards: number;
  replicaShards: number;
  docsCount: number;
  storeSize: number;
  uuid?: string;
}

/**
 * Shard information
 *
 * Requirements: 9.1, 9.2, 9.3
 */
export interface ShardInfo {
  index: string;
  shard: number;
  primary: boolean;
  state: 'STARTED' | 'INITIALIZING' | 'RELOCATING' | 'UNASSIGNED';
  node?: string;
  relocatingNode?: string;
  /** Document count - always present, 0 if unavailable (Requirement 9.3) */
  docs: number;
  /** Store size in bytes - always present, 0 if unavailable (Requirement 9.3) */
  store: number;
}

/**
 * Detailed shard statistics
 * Extends ShardInfo with additional metrics from shard stats API
 * Requirements: 4.6
 */
export interface DetailedShardStats extends ShardInfo {
  segments?: number;
  merges?: number;
  refreshes?: number;
  flushes?: number;
}

/**
 * Node with shards for shard grid visualization
 * Extends NodeInfo with shard allocation map
 */
export interface NodeWithShards extends NodeInfo {
  shards: Map<string, ShardInfo[]>; // index name -> shards on this node
}

/**
 * Index metadata for shard grid
 * Extends IndexInfo with additional metadata
 */
export interface IndexMetadata extends IndexInfo {
  shardCount: number; // Total number of shards (primary + replicas)
  docsCount: number; // Total document count
  size: number; // Total size in bytes
}

/**
 * Shard grid data structure
 * Contains all data needed for shard grid visualization
 */
export interface ShardGridData {
  nodes: NodeWithShards[];
  indices: IndexMetadata[];
  unassignedShards: ShardInfo[];
}

/**
 * Alias information
 */
export interface AliasInfo {
  alias: string;
  index: string;
  filter?: string;
  routing?: string;
  indexRouting?: string;
  searchRouting?: string;
  isWriteIndex?: boolean;
}

/**
 * Create alias request
 */
export interface CreateAliasRequest {
  alias: string;
  indices: string[];
  filter?: Record<string, unknown>;
  routing?: string;
  indexRouting?: string;
  searchRouting?: string;
  isWriteIndex?: boolean;
}

/**
 * Template information
 */
export interface TemplateInfo {
  name: string;
  indexPatterns: string[];
  order?: number;
  priority?: number;
  version?: number;
  settings?: Record<string, unknown>;
  mappings?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  composable?: boolean;
}

/**
 * Create template request
 */
export interface CreateTemplateRequest {
  name: string;
  indexPatterns: string[];
  order?: number;
  priority?: number;
  version?: number;
  settings?: Record<string, unknown>;
  mappings?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  composable?: boolean;
}

/**
 * Cluster settings
 */
export interface ClusterSettings {
  persistent: Record<string, unknown>;
  transient: Record<string, unknown>;
  defaults?: Record<string, unknown>;
}

/**
 * Update cluster settings request
 */
export interface UpdateClusterSettingsRequest {
  persistent?: Record<string, unknown>;
  transient?: Record<string, unknown>;
}

/**
 * Text analysis token information
 */
export interface AnalysisToken {
  token: string;
  startOffset: number;
  endOffset: number;
  type: string;
  position: number;
  positionLength?: number;
  [key: string]: unknown; // Additional attributes
}

/**
 * Text analysis request
 */
export interface AnalyzeTextRequest {
  text: string;
  analyzer?: string;
  tokenizer?: string;
  filter?: string[];
  charFilter?: string[];
  field?: string;
  index?: string;
}

/**
 * Text analysis response
 */
export interface AnalyzeTextResponse {
  tokens: AnalysisToken[];
}

/**
 * Analyzer information
 */
export interface AnalyzerInfo {
  name: string;
  type?: string;
  tokenizer?: string;
  filter?: string[];
  charFilter?: string[];
}

/**
 * Field information for analyzer inspection
 */
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

/**
 * Index analyzers response
 */
export interface IndexAnalyzersResponse {
  analyzers: Record<string, AnalyzerInfo>;
  tokenizers: Record<string, unknown>;
  filters: Record<string, unknown>;
  charFilters: Record<string, unknown>;
}

/**
 * Index fields response
 */
export interface IndexFieldsResponse {
  fields: FieldInfo[];
}

/**
 * Repository type
 */
export type RepositoryType = 'fs' | 's3' | 'azure' | 'gcs' | 'hdfs' | 'url';

/**
 * Repository information
 */
export interface RepositoryInfo {
  name: string;
  type: RepositoryType;
  settings: Record<string, unknown>;
}

/**
 * Create repository request
 */
export interface CreateRepositoryRequest {
  name: string;
  type: RepositoryType;
  settings: Record<string, unknown>;
}

/**
 * Snapshot state
 */
export type SnapshotState = 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'PARTIAL';

/**
 * Snapshot information
 */
export interface SnapshotInfo {
  snapshot: string;
  uuid: string;
  state: SnapshotState;
  indices: string[];
  startTime: string;
  endTime?: string;
  durationInMillis?: number;
  shards?: {
    total: number;
    successful: number;
    failed: number;
  };
  failures?: unknown[];
}

/**
 * Create snapshot request
 */
export interface CreateSnapshotRequest {
  snapshot: string;
  indices?: string[];
  ignoreUnavailable?: boolean;
  includeGlobalState?: boolean;
  partial?: boolean;
}

/**
 * Restore snapshot request
 */
export interface RestoreSnapshotRequest {
  indices?: string[];
  ignoreUnavailable?: boolean;
  includeGlobalState?: boolean;
  renamePattern?: string;
  renameReplacement?: string;
  includeAliases?: boolean;
  partial?: boolean;
}

/**
 * Cat API endpoint information
 */
export interface CatEndpoint {
  endpoint: string;
  description: string;
  help?: string;
}

/**
 * Cat API response (generic table data)
 */
export interface CatApiResponse {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

/**
 * Relocate shard request
 * Requirements: 6.1, 6.2
 */
export interface RelocateShardRequest {
  index: string;
  shard: number;
  from_node: string;
  to_node: string;
}

/**
 * Relocate shard response
 * Requirements: 6.7
 */
export interface RelocateShardResponse {
  acknowledged: boolean;
  state?: {
    cluster_name: string;
    version: number;
    state_uuid: string;
  };
}

/**
 * Index statistics
 */
export interface IndexStats {
  indexName: string;
  uuid: string;
  primaries: IndexShardStats;
  total: IndexShardStats;
}

/**
 * Index shard statistics
 */
export interface IndexShardStats {
  docs: {
    count: number;
    deleted: number;
  };
  store: {
    sizeInBytes: number;
  };
  indexing: {
    indexTotal: number;
    indexTimeInMillis: number;
    indexCurrent: number;
    indexFailed: number;
    deleteTotal: number;
    deleteTimeInMillis: number;
    deleteCurrent: number;
    throttleTimeInMillis: number;
  };
  search: {
    queryTotal: number;
    queryTimeInMillis: number;
    queryCurrent: number;
    fetchTotal: number;
    fetchTimeInMillis: number;
    fetchCurrent: number;
    scrollTotal: number;
    scrollTimeInMillis: number;
    scrollCurrent: number;
  };
  merges: {
    current: number;
    currentDocs: number;
    currentSizeInBytes: number;
    total: number;
    totalTimeInMillis: number;
    totalDocs: number;
    totalSizeInBytes: number;
  };
  refresh: {
    total: number;
    totalTimeInMillis: number;
  };
  flush: {
    total: number;
    totalTimeInMillis: number;
  };
  segments: {
    count: number;
    memoryInBytes: number;
  };
}

/**
 * Bulk operation types for index operations
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export type BulkOperationType =
  | 'open'
  | 'close'
  | 'delete'
  | 'refresh'
  | 'set_read_only'
  | 'set_writable';

/**
 * Result of bulk operation validation
 * Shows which indices will be affected and which will be ignored
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export interface BulkOperationValidationResult {
  /** Indices that will be affected by the operation */
  validIndices: string[];
  /** Indices that will be skipped */
  ignoredIndices: string[];
  /** Reason for ignoring each index */
  ignoreReasons: Record<string, string>;
}

/**
 * Response from bulk operation execution
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export interface BulkOperationResponse {
  /** Successfully processed indices */
  success: string[];
  /** Failed indices with error details */
  failed: Array<{
    index: string;
    error: string;
  }>;
}
