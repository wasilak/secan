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
