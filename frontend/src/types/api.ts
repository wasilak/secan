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
