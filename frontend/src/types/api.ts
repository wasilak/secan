/**
 * API types for Cerebro backend communication
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
export type NodeRole = 'master' | 'data' | 'ingest' | 'coordinating' | 'ml' | 'remote_cluster_client';

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
 */
export interface ShardInfo {
  index: string;
  shard: number;
  primary: boolean;
  state: 'STARTED' | 'INITIALIZING' | 'RELOCATING' | 'UNASSIGNED';
  node?: string;
  docs?: number;
  store?: number;
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
