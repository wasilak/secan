import axios, { AxiosInstance, AxiosError, Method } from 'axios';
import { getTraceparent } from '../utils/traceparent';
import {
  PaginatedResponse,
  ClusterInfo,
  ClusterHealth,
  ClusterStats,
  NodeInfo,
  NodeDetailStats,
  IndexInfo,
  ShardInfo,
  NodeShardSummary,
  PaginatedShardsWithNodes,
  LoginRequest,
  ApiError,
  ApiClientError,
  AliasInfo,
  CreateAliasRequest,
  TemplateInfo,
  CreateTemplateRequest,
  AnalyzeTextRequest,
  AnalyzeTextResponse,
  IndexAnalyzersResponse,
  IndexFieldsResponse,
  FieldInfo,
  RepositoryInfo,
  RepositoryType,
  CreateRepositoryRequest,
  SnapshotInfo,
  CreateSnapshotRequest,
  RestoreSnapshotRequest,
  IndexStats,
  RelocateShardRequest,
  RelocateShardResponse,
  ClusterMetricsHistoryResponse,
  NodeMetricsHistoryResponse,
  TasksListResponse,
  TaskDetailsResponse,
  CancelTaskResponse,
  SankeyResponse,
  SankeyQueryParams,
  
} from '../types/api';
import { computeHeapPercent } from '../utils/heap';
import { incrementHeapPercentMissing } from '../utils/metrics';
import { asRecord, asArray, numOrUndefined, parseTimestamp, getDataArray, pickFirstString } from '../utils/normalize';

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 0,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * API client for communicating with the Secan backend
 *
 * Handles authentication, error handling, retry logic with exponential backoff,
 * and provides typed methods for all backend API endpoints.
 *
 * Features:
 * - Automatic retry with exponential backoff for transient errors
 * - Session management with automatic redirect on 401
 * - Structured error handling with user-friendly messages
 * - Console logging for debugging
 *
 * Requirements: 25.4, 29.6, 29.7
 */
export class ApiClient {
  private client: AxiosInstance;
  private retryConfig: RetryConfig;

  constructor(baseURL: string = '/api', retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    this.client = axios.create({
      baseURL,
      withCredentials: true, // Include cookies for session management
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to inject traceparent header
    // This links frontend requests with backend traces (no frontend spans created)
    this.client.interceptors.request.use((config) => {
      config.headers['traceparent'] = getTraceparent();
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        return this.handleError(error);
      }
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay =
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Determine if an error is retryable
   *
   * Network errors and 5xx server errors are retryable.
   * Authentication (401) and authorization (403) errors are not retryable.
   *
   * Requirements: 25.4
   */
  private isRetryableError(error: AxiosError): boolean {
    // Network errors (no response) are retryable
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // 5xx server errors are retryable
    if (status >= 500 && status < 600) {
      return true;
    }

    // 408 Request Timeout is retryable
    if (status === 408) {
      return true;
    }

    // 429 Too Many Requests is retryable
    if (status === 429) {
      return true;
    }

    // All other errors are not retryable
    return false;
  }

  /**
   * Execute a request with retry logic and exponential backoff
   *
   * Requirements: 25.4
   */
  private async executeWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        // Check if this is an AxiosError and if it's retryable
        if (axios.isAxiosError(error) && this.isRetryableError(error)) {
          // If we haven't exhausted retries, wait and try again
          if (attempt < this.retryConfig.maxRetries) {
            const delay = this.calculateBackoffDelay(attempt);
            console.warn(
              `Request failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${delay}ms...`,
              error.message
            );
            await this.sleep(delay);
            continue;
          }
        }

        // If error is not retryable or we've exhausted retries, throw
        throw error;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Handle API errors consistently
   *
   * Requirements: 21.5, 21.6, 23.4, 25.4
   */
  private handleError(error: AxiosError<ApiError>): Promise<never> {
    if (error.response) {
      const { status, data } = error.response;

      // Handle authentication errors (401)
      // Session expired or invalid - redirect to login
      if (status === 401) {
        window.location.href = `/login?redirect_to=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return Promise.reject(new ApiClientError('Authentication required', 401, data));
      }

      // Handle authorization errors (403)
      // User doesn't have permission to access the resource
      if (status === 403) {
        // Extract cluster name from the request URL if available
        const url = error.config?.url || '';
        const clusterMatch = url.match(/\/clusters\/([^/]+)/);
        const clusterName = clusterMatch ? clusterMatch[1] : undefined;

        // Redirect to access denied page with optional cluster name
        const redirectPath = clusterName
          ? `/access-denied/${encodeURIComponent(clusterName)}`
          : '/access-denied';
        window.location.href = redirectPath;

        return Promise.reject(new ApiClientError('Access forbidden', 403, data));
      }

      // Try to parse Elasticsearch error from response body
      // The backend passes through ES responses as-is for proxy requests
      let elasticsearchError: ApiError | null = null;
      if (data && typeof data === 'object') {
        // Check if this is an Elasticsearch error response. Use an unknown
        // intermediate and defensive property check before assigning to ApiError.
        const responseAny = data as unknown;
        if (
          responseAny &&
          typeof responseAny === 'object' &&
          'error' in (responseAny as Record<string, unknown>) &&
          typeof ((responseAny as Record<string, unknown>).error) === 'object'
        ) {
          elasticsearchError = responseAny as ApiError;
        }
      }

      // Handle other HTTP errors
      const message = data?.message || error.message || 'An error occurred';
      return Promise.reject(
        new ApiClientError(
          message,
          status,
          elasticsearchError || data || { error: 'unknown', message }
        )
      );
    }

    // Handle network errors
    if (error.request) {
      const message = `Network error: ${error.code || error.message || 'unable to reach server'}`;
      console.error('Network error details:', { code: error.code, message: error.message, config: error.config?.url });
      return Promise.reject(new ApiClientError(message, 0));
    }

    // Handle other errors
    console.error('Unexpected error:', error);
    return Promise.reject(new ApiClientError(error.message || 'An unexpected error occurred', 0));
  }

  /**
   * Login with username and password
   *
   * Requirements: 21.5, 21.6
   */
  async login(username: string, password: string): Promise<void> {
    const payload: LoginRequest = { username, password };
    await this.client.post('/auth/login', payload);
  }

  /**
   * Logout and invalidate session
   *
   * Requirements: 21.5, 21.6
   */
  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  /**
   * Get list of accessible clusters with filtering and pagination
   *
   * Requirements: 23.4, 25.4
   */
  async getClusters(
    page: number = 1,
    pageSize: number = 50,
    filters?: {
      search?: string;
      health?: string[]; // ['green', 'yellow', 'red']
      version?: string;
    }
  ): Promise<PaginatedResponse<ClusterInfo>> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<PaginatedResponse<ClusterInfo>>('/clusters', {
        params: {
          page,
          page_size: pageSize,
          search: filters?.search || '',
          health: filters?.health?.join(',') || '',
          version: filters?.version || '',
        },
      });

      // Normalize cluster items for frontend consumers:
      // - Convert null `name` to undefined
      // - Ensure `nodes` is always an array
      const raw = response.data;

      // Backend may return either a paginated object or a plain array of clusters
      // in different contexts (tests/mocks or older endpoints). Always return a
      // PaginatedResponse envelope so consumers can rely on a single shape.
      if (Array.isArray(raw)) {
         const normalized = raw.map((c: unknown) => {
           const rec = c as Record<string, unknown>;
           return {
             ...rec,
             name: (rec.name as string | undefined) ?? undefined,
             nodes: Array.isArray(rec.nodes) ? (rec.nodes as unknown[]) : [],
           };
         });
        return {
          items: normalized as ClusterInfo[],
          total: normalized.length,
          page: 1,
          page_size: normalized.length,
          total_pages: 1,
        } as PaginatedResponse<ClusterInfo>;
      }

      const data = raw as PaginatedResponse<ClusterInfo> & { items?: unknown[] };
      const normalizedItems = (data.items || []).map((c: unknown) => {
        const rec = c as Record<string, unknown>;
        return {
          ...rec,
          name: (rec.name as string | undefined) ?? undefined,
          nodes: Array.isArray(rec.nodes) ? (rec.nodes as unknown[]) : [],
        } as ClusterInfo;
      });

      return { ...data, items: normalizedItems } as PaginatedResponse<ClusterInfo>;
    });
  }

  /**
   * Get cluster health information
   *
   * Requirements: 21.5, 21.6, 25.4
   */
  async getClusterHealth(clusterId: string): Promise<ClusterHealth> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<ClusterHealth>(
        `/clusters/${clusterId}/_cluster/health`
      );
      return response.data;
    });
  }

  /**
   * Proxy a request to an Elasticsearch cluster
   *
   * This method forwards arbitrary requests to the Elasticsearch cluster,
   * allowing the frontend to interact with any Elasticsearch API.
   *
   * Returns both the response data and content-type header for proper formatting.
   *
   * Requirements: 21.5, 21.6, 23.4, 25.4
   */
  async proxyRequest<T = unknown>(
    clusterId: string,
    method: Method,
    path: string,
    body?: unknown
  ): Promise<{ data: T; contentType: string | null }> {
    return this.executeWithRetry(async () => {
      // Ensure path starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      const response = await this.client.request<T>({
        method,
        url: `/clusters/${clusterId}${normalizedPath}`,
        data: body,
      });

      // Extract content-type header for response formatting
      const contentType = response.headers['content-type'] || null;

      return {
        data: response.data,
        contentType,
      };
    });
  }

  /**
   * Get cluster statistics for overview display
   *
   * Requirements: 4.1, 4.2, 4.3
   */
  async getClusterStats(clusterId: string): Promise<ClusterStats> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<Record<string, unknown>>(`/clusters/${clusterId}/stats`);
      const raw = response.data || {};

      // Helpers to parse numeric fields coming from various server shapes
      const toNumberOrUndefined = (v: unknown) =>
        (v === undefined || v === null) ? undefined : Number(v as number);
      const toNumberOrZero = (v: unknown) => Number((v as number) ?? 0);

      const normalized: ClusterStats = {
        activePrimaryShards: toNumberOrZero(
          raw.activePrimaryShards ?? raw.active_primary_shards ?? raw.active_primary_shards
        ),
        activeShards: toNumberOrZero(raw.activeShards ?? raw.active_shards ?? raw.active_shards),
        clusterName:
          raw.clusterName ?? raw.cluster_name ?? raw.cluster ?? raw.name ?? clusterId,
        cpuPercent: toNumberOrUndefined(raw.cpuPercent ?? raw.cpu_percent),
        diskTotal: toNumberOrUndefined(raw.diskTotal ?? raw.disk_total_bytes ?? raw.disk_total),
        diskUsed: toNumberOrUndefined(raw.diskUsed ?? raw.disk_used_bytes ?? raw.disk_used),
        esVersion: raw.esVersion ?? raw.es_version ?? undefined,
        health: raw.health ?? raw.status ?? 'unreachable',
        initializingShards: toNumberOrZero(raw.initializingShards ?? raw.initializing_shards ?? 0),
        loadAverage15m: toNumberOrUndefined(raw.loadAverage15m ?? raw.load_average_15m),
        loadAverage1m: toNumberOrUndefined(raw.loadAverage1m ?? raw.load_average_1m),
        loadAverage5m: toNumberOrUndefined(raw.loadAverage5m ?? raw.load_average_5m),
        memoryTotal: toNumberOrUndefined(raw.memoryTotal ?? raw.memory_total),
        memoryUsed: toNumberOrUndefined(raw.memoryUsed ?? raw.memory_used),
        numberOfDataNodes: toNumberOrZero(raw.numberOfDataNodes ?? raw.number_of_data_nodes ?? 0),
        numberOfDocuments: toNumberOrZero(raw.numberOfDocuments ?? raw.number_of_documents ?? 0),
        numberOfIndices: toNumberOrZero(raw.numberOfIndices ?? raw.number_of_indices ?? 0),
        numberOfNodes: toNumberOrZero(raw.numberOfNodes ?? raw.number_of_nodes ?? 0),
        relocatingShards: toNumberOrZero(raw.relocatingShards ?? raw.relocating_shards ?? 0),
        unassignedShards: toNumberOrZero(raw.unassignedShards ?? raw.unassigned_shards ?? 0),
      } as ClusterStats;

      return normalized;
    });
  }

  /**
   * Get list of nodes in a cluster with pagination
   *
   * Handles optional fields with default values:
   * - loadAverage defaults to undefined if not provided
   * - uptime defaults to undefined if not provided
   * - tags defaults to empty array if not provided
   *
   * Requirements: 4.6, 14.1, 14.2
   */
    async getNodes(
    clusterId: string,
    page: number = 1,
    pageSize: number = 50,
    filters?: {
      search?: string;
      roles?: string; // comma-separated: 'master,data,ingest'
      nodes?: string; // comma-separated node ids or names to filter
    }
  ): Promise<PaginatedResponse<NodeInfo>> {
    return this.executeWithRetry(async () => {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
        search: filters?.search || '',
      };
      // Only include roles param if it's explicitly set (even empty string)
      // undefined means "no filter", '' means "filter out all", 'x,y' means "filter by x,y"
      if (filters?.roles !== undefined) {
        params.roles = filters.roles;
      }
      if (filters?.nodes !== undefined) {
        // pass through a comma-separated list of node ids or names
        params.nodes = filters.nodes;
      }

      const response = await this.client.get<PaginatedResponse<NodeInfo>>(
        `/clusters/${clusterId}/nodes`,
        { params }
      );

      // Ensure optional fields have proper defaults
      return {
        ...response.data,
        items: response.data.items.map((node) => {
          // Ensure tags and other optional fields have sensible defaults
          const tags = node.tags ?? [];
          const loadAverage = node.loadAverage ?? undefined;
          const uptime = node.uptime ?? undefined;
          const uptimeMillis = Number.isFinite(node.uptimeMillis) ? node.uptimeMillis : undefined;

          // Prefer server-provided heapPercent when valid; otherwise derive it from heapUsed/heapMax
           // heapPercent may be present on older servers as a number; treat unknowns safely
           const nodeRec = node as unknown as Record<string, unknown>;
           const serverHeap = Number.isFinite(nodeRec.heapPercent as number) ? (nodeRec.heapPercent as number) : undefined;
           const heapPercent = serverHeap !== undefined ? serverHeap : computeHeapPercent(node.heapUsed, node.heapMax);
          if (serverHeap === undefined) incrementHeapPercentMissing();

          return {
            ...node,
            tags,
            loadAverage,
            uptime,
            uptimeMillis,
            heapPercent,
          } as NodeInfo;
        }),
      };
    });
  }

  /**
   * Get detailed statistics for a specific node
   *
   * Handles optional fields with default values:
   * - loadAverage defaults to undefined if not provided
   * - uptime defaults to undefined if not provided
   * - threadPools defaults to undefined if not provided
   * - shards defaults to undefined if not provided
   * - indexing defaults to undefined if not provided
   * - search defaults to undefined if not provided
   * - fs defaults to undefined if not provided
   * - network defaults to undefined if not provided
   * - jvm defaults to undefined if not provided
   *
   * Requirements: 14.7, 14.8
   */
  async getNodeStats(clusterId: string, nodeId: string): Promise<NodeDetailStats> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<NodeDetailStats>(
        `/clusters/${clusterId}/nodes/${nodeId}/stats`
      );

      // Ensure optional fields have proper defaults and validate numeric fields
      const data = response.data;

      // Validate that numeric fields are not NaN
      const validateNumber = (value: number | undefined, fieldName: string): number | undefined => {
        if (value === undefined) return undefined;
        if (isNaN(value)) {
          console.warn(`Invalid numeric value for ${fieldName}: NaN`);
          return undefined;
        }
        return value;
      };

      const serverHeapPercent = validateNumber(data.heapPercent, 'heapPercent');
      const heapPercent =
        serverHeapPercent !== undefined
          ? serverHeapPercent
          : computeHeapPercent(data.heapUsed, data.heapMax);
      if (serverHeapPercent === undefined) incrementHeapPercentMissing();

      return {
        ...data,
        cpuPercent: validateNumber(data.cpuPercent, 'cpuPercent'),
        heapPercent,
        loadAverage: data.loadAverage ?? undefined,
        uptime: data.uptime ?? undefined,
        uptimeMillis: validateNumber(data.uptimeMillis, 'uptimeMillis'),
        threadPools: data.threadPools ?? undefined,
        shards: data.shards ?? undefined,
        indexing: data.indexing ?? undefined,
        search: data.search ?? undefined,
        fs: data.fs ?? undefined,
        network: data.network ?? undefined,
        jvm: data.jvm ?? undefined,
      };
    });
  }

  /**
   * Get list of indices in a cluster with pagination
   *
   * Requirements: 4.7
   */
  async getIndices(
    clusterId: string,
    page: number = 1,
    pageSize: number = 50,
    filters?: {
      search?: string;
      health?: string[]; // ['green', 'yellow', 'red']
      status?: string[]; // ['open', 'close']
      showSpecial?: boolean;
      affected?: boolean;
    }
  ): Promise<PaginatedResponse<IndexInfo>> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<PaginatedResponse<IndexInfo>>(
        `/clusters/${clusterId}/indices`,
        {
          params: {
            page,
            page_size: pageSize,
            search: filters?.search || '',
            health: filters?.health?.join(',') || '',
            status: filters?.status?.join(',') || '',
            show_special: filters?.showSpecial ?? true, // Default to true
            affected: filters?.affected || false,
          },
        }
      );

      // Normalize common index fields to guarantee frontend-friendly types
      const data = response.data;
      const normalizedItems = (data.items || []).map((idx: unknown) => {
        const rec = idx as Record<string, unknown>;
        const docsCount = Number(
          rec.docsCount ?? rec.docs_count ?? ((rec.docs as Record<string, unknown>)?.count as number | undefined) ?? 0
        );
        // Normalize store size. The backend may return either a numeric
        // byte count (number) or a human-readable string like "86.7kb" or
        // "624b" (as observed from _cat/indices output). Attempt to
        // coerce to a number of bytes robustly.
        const rawStore: unknown = rec.storeSize ?? rec.store_size ?? ((rec.store as Record<string, unknown>)?.size_in_bytes) ?? rec.storeSize ?? 0;

        const parseHumanSize = (v: string): number => {
          if (!v) return 0;
          const s = String(v).trim().toLowerCase();
          // Accept formats like "123", "123b", "86.7kb", "1.2mb", with optional spaces
          const m = s.match(/^([0-9.,]+)\s*(b|kb|mb|gb|tb)?$/);
          if (!m) return 0;
          const num = parseFloat(m[1].replace(/,/g, ''));
          if (!isFinite(num)) return 0;
          const unit = m[2] || 'b';
          const multipliers: Record<string, number> = {
            b: 1,
            kb: 1024,
            mb: 1024 * 1024,
            gb: 1024 * 1024 * 1024,
            tb: 1024 * 1024 * 1024 * 1024,
          };
          return Math.round(num * (multipliers[unit] ?? 1));
        };

        const storeSize = typeof rawStore === 'number' && Number.isFinite(rawStore)
          ? Number(rawStore)
          : typeof rawStore === 'string'
            ? (() => {
                const n = Number(rawStore as string);
                return Number.isFinite(n) ? n : parseHumanSize(rawStore as string);
              })()
            : 0;
        const primaryShards = Number(rec.primaryShards ?? rec.primary_shards ?? rec.primaryShards ?? 0);
        const replicaShards = Number(rec.replicaShards ?? rec.replica_shards ?? rec.replicaShards ?? 0);
        return {
          ...rec,
          // Convert null uuid to undefined for cleaner frontend usage
          uuid: rec.uuid ?? undefined,
          name: (rec.name as string) ?? (rec.index as string) ?? (rec.index_name as string) ?? '',
          docsCount,
          storeSize,
          primaryShards,
          replicaShards,
          health: (rec.health as string) ?? 'unknown',
          status: (rec.status as string) ?? 'open',
        } as IndexInfo;
      });

      return { ...data, items: normalizedItems } as PaginatedResponse<IndexInfo>;
    });
  }

  /**
   * Get shard allocation information with pagination and filtering
   *
   * Requirements: 4.8
   */
  async getShards(
    clusterId: string,
    page: number = 1,
    pageSize: number = 10,
    filters?: {
      hide_special?: boolean; // exclude indices starting with '.' (default: false)
      show_primaries?: boolean; // include primary shards (default: true)
      show_replicas?: boolean; // include replica shards (default: true)
      state?: string; // comma-separated: 'UNASSIGNED,STARTED'
      search?: string; // search both index and node (OR logic)
      index?: string; // specific index filter (AND logic with node)
      node?: string; // specific node filter (AND logic with index)
    }
  ): Promise<PaginatedShardsWithNodes | PaginatedResponse<ShardInfo>> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<PaginatedResponse<ShardInfo>>(
        `/clusters/${clusterId}/shards`,
        {
          params: {
            page,
            page_size: pageSize,
            hide_special: filters?.hide_special ?? false,
            show_primaries: filters?.show_primaries ?? true,
            show_replicas: filters?.show_replicas ?? true,
            state: filters?.state || '',
            search: filters?.search || '',
            index: filters?.index || '',
            node: filters?.node || '',
          },
        }
      );
      // The backend may return the combined PaginatedShardsWithNodes shape for
      // the Index Visualization flow. If so, preserve and return it; otherwise
      // return the legacy PaginatedResponse<ShardInfo>.
       const dataRec = response.data as unknown as Record<string, unknown>;

       // Normalize relocating_node -> relocatingNode for each shard item so UI helpers
       // that expect relocatingNode are always satisfied. Accept both snake_case and
       // camelCase variants from the backend.
       if (dataRec && Array.isArray(dataRec.items)) {
         const normalizedItems = (dataRec.items as unknown[]).map((sh: unknown) => {
           const rec = sh as Record<string, unknown>;
           return {
             ...rec,
             relocatingNode: rec.relocating_node ?? rec.relocatingNode ?? undefined,
           };
         });
         return { ...dataRec, items: normalizedItems } as PaginatedShardsWithNodes;
       }

       return response.data as PaginatedResponse<ShardInfo>;
    });
  }

  /**
   * Get shards allocated on a specific node
   * For progressive loading in topology view
   *
   * Requirements: 4.8
   */
  async getNodeShards(clusterId: string, nodeId: string): Promise<ShardInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<ShardInfo[]>(
        `/clusters/${clusterId}/nodes/${nodeId}/shards`
      );
      // Normalize relocating_node to relocatingNode for each shard
      return (response.data || []).map((sh: unknown) => {
        const rec = sh as Record<string, unknown>;
        return {
          ...rec,
          relocatingNode: rec.relocating_node ?? rec.relocatingNode ?? undefined,
        } as ShardInfo;
      });
    });
  }

  /**
   * Get per-node shard count summary (lightweight — no full ShardInfo objects).
   *
   * Uses a single _cat/shards call on the backend and returns aggregated
   * primary/replica/unassigned counts per node. Designed for the canvas
   * topology view at L0/L1 zoom where only badge totals are needed and
   * fetching full shard arrays would cause OOM on large clusters.
   *
   * Requirements: 4.9
   */
  async getNodesShardSummary(clusterId: string): Promise<NodeShardSummary[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<NodeShardSummary[]>(
        `/clusters/${clusterId}/nodes/shard-summary`
      );
      return response.data;
    });
  }

  /**
   * Get detailed statistics for a specific shard
   *
   * Requirements: 4.8
   */
  async getShardStats(clusterId: string, indexName: string, shardNum: number): Promise<unknown> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(
        `/clusters/${clusterId}/shards/${encodeURIComponent(indexName)}/${shardNum}`
      );
      return response.data;
    });
  }

  /**
   * Open a closed index
   *
   * Requirements: 5.1
   */
  async openIndex(clusterId: string, indexName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/clusters/${clusterId}/${indexName}/_open`);
    });
  }

  /**
   * Close an open index
   *
   * Requirements: 5.2
   */
  async closeIndex(clusterId: string, indexName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/clusters/${clusterId}/${indexName}/_close`);
    });
  }

  /**
   * Delete an index
   *
   * Requirements: 5.3
   */
  async deleteIndex(clusterId: string, indexName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.delete(`/clusters/${clusterId}/${indexName}`);
    });
  }

  /**
   * Force merge an index
   *
   * Requirements: 5.4
   */
  async forceMergeIndex(
    clusterId: string,
    indexName: string,
    maxNumSegments?: number
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      const params = maxNumSegments ? `?max_num_segments=${maxNumSegments}` : '';
      await this.client.post(`/clusters/${clusterId}/${indexName}/_forcemerge${params}`);
    });
  }

  /**
   * Clear cache for an index
   *
   * Requirements: 5.5
   */
  async clearCacheIndex(clusterId: string, indexName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/clusters/${clusterId}/${indexName}/_cache/clear`);
    });
  }

  /**
   * Refresh an index
   *
   * Requirements: 5.6
   */
  async refreshIndex(clusterId: string, indexName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/clusters/${clusterId}/${indexName}/_refresh`);
    });
  }

  /**
   * Flush an index
   *
   * Requirements: 5.7
   */
  async flushIndex(clusterId: string, indexName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/clusters/${clusterId}/${indexName}/_flush`);
    });
  }

  /**
   * Bulk open multiple closed indices
   *
   * Opens multiple indices in a single operation using comma-separated index names.
   *
   * @param clusterId - Cluster identifier
   * @param indexNames - Array of index names to open
   * @returns Promise that resolves when operation completes
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async bulkOpenIndices(clusterId: string, indexNames: string[]): Promise<void> {
    if (indexNames.length === 0) {
      return Promise.resolve();
    }

    return this.executeWithRetry(async () => {
      const indicesParam = indexNames.join(',');
      await this.client.post(`/clusters/${clusterId}/${indicesParam}/_open`);
    });
  }

  /**
   * Bulk close multiple open indices
   *
   * Closes multiple indices in a single operation using comma-separated index names.
   *
   * @param clusterId - Cluster identifier
   * @param indexNames - Array of index names to close
   * @returns Promise that resolves when operation completes
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async bulkCloseIndices(clusterId: string, indexNames: string[]): Promise<void> {
    if (indexNames.length === 0) {
      return Promise.resolve();
    }

    return this.executeWithRetry(async () => {
      const indicesParam = indexNames.join(',');
      await this.client.post(`/clusters/${clusterId}/${indicesParam}/_close`);
    });
  }

  /**
   * Bulk delete multiple indices
   *
   * Deletes multiple indices in a single operation using comma-separated index names.
   *
   * @param clusterId - Cluster identifier
   * @param indexNames - Array of index names to delete
   * @returns Promise that resolves when operation completes
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async bulkDeleteIndices(clusterId: string, indexNames: string[]): Promise<void> {
    if (indexNames.length === 0) {
      return Promise.resolve();
    }

    return this.executeWithRetry(async () => {
      const indicesParam = indexNames.join(',');
      await this.client.delete(`/clusters/${clusterId}/${indicesParam}`);
    });
  }

  /**
   * Bulk refresh multiple open indices
   *
   * Refreshes multiple open indices in a single operation using comma-separated index names.
   *
   * @param clusterId - Cluster identifier
   * @param indexNames - Array of index names to refresh
   * @returns Promise that resolves when operation completes
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async bulkRefreshIndices(clusterId: string, indexNames: string[]): Promise<void> {
    if (indexNames.length === 0) {
      return Promise.resolve();
    }

    return this.executeWithRetry(async () => {
      const indicesParam = indexNames.join(',');
      await this.client.post(`/clusters/${clusterId}/${indicesParam}/_refresh`);
    });
  }

  /**
   * Bulk set multiple indices to read-only
   *
   * Sets the index.blocks.write setting to true for multiple indices in a single operation.
   *
   * @param clusterId - Cluster identifier
   * @param indexNames - Array of index names to set as read-only
   * @returns Promise that resolves when operation completes
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async bulkSetIndexReadOnly(clusterId: string, indexNames: string[]): Promise<void> {
    if (indexNames.length === 0) {
      return Promise.resolve();
    }

    return this.executeWithRetry(async () => {
      const indicesParam = indexNames.join(',');
      await this.client.put(`/clusters/${clusterId}/${indicesParam}/_settings`, {
        index: {
          blocks: {
            write: true,
          },
        },
      });
    });
  }

  /**
   * Bulk set multiple read-only indices to writable
   *
   * Sets the index.blocks.write setting to false for multiple indices in a single operation.
   *
   * @param clusterId - Cluster identifier
   * @param indexNames - Array of index names to set as writable
   * @returns Promise that resolves when operation completes
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async bulkSetIndexWritable(clusterId: string, indexNames: string[]): Promise<void> {
    if (indexNames.length === 0) {
      return Promise.resolve();
    }

    return this.executeWithRetry(async () => {
      const indicesParam = indexNames.join(',');
      await this.client.put(`/clusters/${clusterId}/${indicesParam}/_settings`, {
        index: {
          blocks: {
            write: false,
          },
        },
      });
    });
  }

  /**
   * Get all aliases in a cluster
   *
   * Requirements: 11.1
   */
  async getAliases(clusterId: string): Promise<AliasInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<Record<string, { aliases: Record<string, unknown> }>>(
        `/clusters/${clusterId}/_alias`
      );

      // Transform the response into a flat array of alias info
      const aliases: AliasInfo[] = [];
      for (const [index, data] of Object.entries(response.data)) {
        for (const [alias, config] of Object.entries(data.aliases)) {
          const aliasConfig = config as Record<string, unknown>;
          aliases.push({
            alias,
            index,
            filter: aliasConfig.filter ? JSON.stringify(aliasConfig.filter) : undefined,
            routing: aliasConfig.routing as string | undefined,
            indexRouting: aliasConfig.index_routing as string | undefined,
            searchRouting: aliasConfig.search_routing as string | undefined,
            isWriteIndex: aliasConfig.is_write_index as boolean | undefined,
          });
        }
      }
      return aliases;
    });
  }

  /**
   * Create or update an alias
   *
   * Requirements: 11.2, 11.3, 11.4, 11.5, 11.6
   */
  async createAlias(clusterId: string, request: CreateAliasRequest): Promise<void> {
    return this.executeWithRetry(async () => {
      // Build the actions array for atomic alias operations
      const actions = request.indices.map((index) => {
        const action: Record<string, unknown> = {
          add: {
            index,
            alias: request.alias,
          },
        };

        const addConfig = action.add as Record<string, unknown>;
        if (request.filter) {
          addConfig.filter = request.filter;
        }
        if (request.routing) {
          addConfig.routing = request.routing;
        }
        if (request.indexRouting) {
          addConfig.index_routing = request.indexRouting;
        }
        if (request.searchRouting) {
          addConfig.search_routing = request.searchRouting;
        }
        if (request.isWriteIndex !== undefined) {
          addConfig.is_write_index = request.isWriteIndex;
        }

        return action;
      });

      await this.client.post(`/clusters/${clusterId}/_aliases`, { actions });
    });
  }

  /**
   * Delete an alias
   *
   * Requirements: 11.7
   */
  async deleteAlias(clusterId: string, index: string, alias: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.delete(`/clusters/${clusterId}/${index}/_alias/${alias}`);
    });
  }

  /**
   * Perform bulk alias operations atomically
   *
   * Requirements: 11.8
   */
  async bulkAliasOperations(
    clusterId: string,
    actions: Array<{ add?: unknown; remove?: unknown }>
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/clusters/${clusterId}/_aliases`, { actions });
    });
  }

  /**
   * Get all index templates in a cluster
   *
   * Requirements: 12.1
   */
  async getTemplates(clusterId: string): Promise<TemplateInfo[]> {
    return this.executeWithRetry(async () => {
      // Try to get composable templates first (ES 7.8+)
      try {
        const response = await this.client.get<Record<string, unknown>>(
          `/clusters/${clusterId}/_index_template`
        );

        const templates: TemplateInfo[] = [];
        const data = response.data as {
          index_templates?: Array<{ name: string; index_template: unknown }>;
        };

        if (data.index_templates) {
          for (const item of data.index_templates) {
            const template = item.index_template as Record<string, unknown>;
            templates.push({
              name: item.name,
              indexPatterns: template.index_patterns as string[],
              priority: template.priority as number | undefined,
              version: template.version as number | undefined,
              settings: template.template
                ? ((template.template as Record<string, unknown>).settings as Record<
                    string,
                    unknown
                  >)
                : undefined,
              mappings: template.template
                ? ((template.template as Record<string, unknown>).mappings as Record<
                    string,
                    unknown
                  >)
                : undefined,
              aliases: template.template
                ? ((template.template as Record<string, unknown>).aliases as Record<
                    string,
                    unknown
                  >)
                : undefined,
              composable: true,
            });
          }
        }

        return templates;
      } catch {
        // Fall back to legacy templates
        const response = await this.client.get<Record<string, unknown>>(
          `/clusters/${clusterId}/_template`
        );

        const templates: TemplateInfo[] = [];
        for (const [name, config] of Object.entries(response.data)) {
          const template = config as Record<string, unknown>;
          templates.push({
            name,
            indexPatterns:
              (template.index_patterns as string[]) || (template.template as string[]) || [],
            order: template.order as number | undefined,
            settings: template.settings as Record<string, unknown> | undefined,
            mappings: template.mappings as Record<string, unknown> | undefined,
            aliases: template.aliases as Record<string, unknown> | undefined,
            composable: false,
          });
        }

        return templates;
      }
    });
  }

  /**
   * Create or update an index template
   *
   * Requirements: 12.2, 12.3, 12.4, 12.5
   */
  async createTemplate(clusterId: string, request: CreateTemplateRequest): Promise<void> {
    return this.executeWithRetry(async () => {
      if (request.composable) {
        // Create composable template (ES 7.8+)
        const body: Record<string, unknown> = {
          index_patterns: request.indexPatterns,
        };

        if (request.priority !== undefined) {
          body.priority = request.priority;
        }
        if (request.version !== undefined) {
          body.version = request.version;
        }

        const template: Record<string, unknown> = {};
        if (request.settings) {
          template.settings = request.settings;
        }
        if (request.mappings) {
          template.mappings = request.mappings;
        }
        if (request.aliases) {
          template.aliases = request.aliases;
        }

        if (Object.keys(template).length > 0) {
          body.template = template;
        }

        await this.client.put(`/clusters/${clusterId}/_index_template/${request.name}`, body);
      } else {
        // Create legacy template
        const body: Record<string, unknown> = {
          index_patterns: request.indexPatterns,
        };

        if (request.order !== undefined) {
          body.order = request.order;
        }
        if (request.version !== undefined) {
          body.version = request.version;
        }
        if (request.settings) {
          body.settings = request.settings;
        }
        if (request.mappings) {
          body.mappings = request.mappings;
        }
        if (request.aliases) {
          body.aliases = request.aliases;
        }

        await this.client.put(`/clusters/${clusterId}/_template/${request.name}`, body);
      }
    });
  }

  /**
   * Delete an index template
   *
   * Requirements: 12.6
   */
  async deleteTemplate(clusterId: string, name: string, composable: boolean): Promise<void> {
    return this.executeWithRetry(async () => {
      if (composable) {
        await this.client.delete(`/clusters/${clusterId}/_index_template/${name}`);
      } else {
        await this.client.delete(`/clusters/${clusterId}/_template/${name}`);
      }
    });
  }

  /**
   * Analyze text with specified analyzer or custom configuration
   *
   * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
   */
  async analyzeText(clusterId: string, request: AnalyzeTextRequest): Promise<AnalyzeTextResponse> {
    return this.executeWithRetry(async () => {
      const body: Record<string, unknown> = {
        text: request.text,
      };

      if (request.analyzer) {
        body.analyzer = request.analyzer;
      }
      if (request.tokenizer) {
        body.tokenizer = request.tokenizer;
      }
      if (request.filter) {
        body.filter = request.filter;
      }
      if (request.charFilter) {
        body.char_filter = request.charFilter;
      }
      if (request.field && request.index) {
        body.field = request.field;
      }

      const endpoint =
        request.field && request.index
          ? `/clusters/${clusterId}/${request.index}/_analyze`
          : `/clusters/${clusterId}/_analyze`;

      // Server returns tokens in snake_case. Map to frontend AnalysisToken (camelCase)
      const response = await this.client.post<Record<string, unknown>>(endpoint, body);
      const raw = response.data as { tokens?: Array<Record<string, unknown>> };
      const tokens = raw.tokens
        ? raw.tokens.map((t) => ({
            token: t.token,
            position: t.position,
            startOffset: t.start_offset,
            endOffset: t.end_offset,
            type: t.type,
            positionLength: t.position_length ?? undefined,
          }))
        : [];

      // Always return tokens array (frontend expects tokens to be defined)
      return { tokens } as AnalyzeTextResponse;
    });
  }

  /**
   * Get analyzers configured for an index
   *
   * Requirements: 16.1, 16.2
   */
  async getIndexAnalyzers(clusterId: string, indexName: string): Promise<IndexAnalyzersResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<
        Record<string, { settings: { index: { analysis: unknown } } }>
      >(`/clusters/${clusterId}/${indexName}/_settings`);

      const indexData = response.data[indexName];
      const analysis =
        (indexData?.settings?.index?.analysis as Record<string, Record<string, unknown>>) || {};

      return {
        analyzers: analysis.analyzer || {},
        tokenizers: analysis.tokenizer || {},
        filters: analysis.filter || {},
        charFilters: analysis.char_filter || {},
      } as IndexAnalyzersResponse;
    });
  }

  /**
   * Helper: fetch index settings and normalize to return the inner settings object
   * The frontend expects response.data[indexName].settings to exist; return
   * an empty object when missing to simplify callers.
   */
  async getIndexSettings(clusterId: string, indexName: string): Promise<Record<string, unknown>> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<Record<string, unknown>>(
        `/clusters/${clusterId}/${indexName}/_settings`
      );

      const responseData = (response.data || {}) as Record<string, unknown>;
      const indexData = responseData[indexName] as Record<string, unknown> | undefined;
      if (!indexData || typeof indexData !== 'object') return {};
      const settings = indexData.settings as Record<string, unknown> | undefined;
      return settings && typeof settings === 'object' ? settings : {};
    });
  }

  /**
   * Helper: fetch index mappings and normalize to return the inner mappings object
   * Return empty object when mappings are missing to simplify callers.
   */
  async getIndexMappings(clusterId: string, indexName: string): Promise<Record<string, unknown>> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<Record<string, unknown>>(
        `/clusters/${clusterId}/${indexName}/_mapping`
      );

      const responseData = (response.data || {}) as Record<string, unknown>;
      const indexData = responseData[indexName] as Record<string, unknown> | undefined;
      if (!indexData || typeof indexData !== 'object') return {};
      const mappings = indexData.mappings as Record<string, unknown> | undefined;
      return mappings && typeof mappings === 'object' ? mappings : {};
    });
  }

  /**
   * Helper: fetch cluster settings and ensure transient/persistent keys exist
   * Consumers currently expect clusterSettings.transient and .persistent to be
   * objects or undefined; normalize to always provide objects to simplify callers.
   */
  async getClusterSettings(
    clusterId: string,
    options?: { includeDefaults?: boolean; flatSettings?: boolean }
  ): Promise<{ transient: Record<string, unknown>; persistent: Record<string, unknown>; defaults?: Record<string, unknown> }> {
    return this.executeWithRetry(async () => {
      const url = `/clusters/${clusterId}/_cluster/settings` +
        (options ? `?${new URLSearchParams({
          ...(options.includeDefaults ? { include_defaults: 'true' } : {}),
          ...(options.flatSettings === false ? { flat_settings: 'false' } : {}),
        }).toString()}` : '');

      const response = await this.client.get<Record<string, unknown>>(url);

      const data = (response.data || {}) as Record<string, unknown>;
      const transient = (data.transient as Record<string, unknown> | undefined) ?? {};
      const persistent = (data.persistent as Record<string, unknown> | undefined) ?? {};
      const defaults = (data.defaults as Record<string, unknown> | undefined) ?? undefined;

      return { transient, persistent, defaults };
    });
  }

  /**
   * Get fields configured for an index with their analyzers
   *
   * Requirements: 16.3, 16.4, 16.5, 16.6
   */
  async getIndexFields(clusterId: string, indexName: string): Promise<IndexFieldsResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<
        Record<string, { mappings: { properties: Record<string, unknown> } }>
      >(`/clusters/${clusterId}/${indexName}/_mapping`);

      const indexData = response.data[indexName];
      // Handle case where index has no mappings (empty index with 0 docs)
      const properties = indexData?.mappings?.properties ?? {};

      const fields: FieldInfo[] = [];

      const extractFields = (props: Record<string, unknown>, prefix = '') => {
        for (const [name, config] of Object.entries(props)) {
          const fieldConfig = config as Record<string, unknown>;
          const fullName = prefix ? `${prefix}.${name}` : name;

          fields.push({
            name: fullName,
            type: (fieldConfig.type as string) || 'object',
            analyzer: fieldConfig.analyzer as string | undefined,
            searchAnalyzer: fieldConfig.search_analyzer as string | undefined,
            normalizer: fieldConfig.normalizer as string | undefined,
            properties: fieldConfig.properties as Record<string, unknown> | undefined,
            searchable: fieldConfig.index !== false,
            aggregatable: fieldConfig.type !== 'text',
            stored: fieldConfig.store === true,
          });

          // Recursively extract nested fields
          if (fieldConfig.properties) {
            extractFields(fieldConfig.properties as Record<string, unknown>, fullName);
          }
        }
      };

      extractFields(properties);

      return { fields };
    });
  }

  /**
   * Get all snapshot repositories in a cluster
   *
   * Requirements: 17.1
   */
  async getRepositories(clusterId: string): Promise<RepositoryInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<
        Record<string, { type: string; settings: Record<string, unknown> }>
      >(`/clusters/${clusterId}/_snapshot`);

      const repositories: RepositoryInfo[] = [];
      for (const [name, config] of Object.entries(response.data)) {
        repositories.push({
          name,
          type: config.type as RepositoryType,
          settings: config.settings,
        });
      }

      return repositories;
    });
  }

  /**
   * Create a snapshot repository
   *
   * Requirements: 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9
   */
  async createRepository(clusterId: string, request: CreateRepositoryRequest): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.put(`/clusters/${clusterId}/_snapshot/${request.name}`, {
        type: request.type,
        settings: request.settings,
      });
    });
  }

  /**
   * Delete a snapshot repository
   *
   * Requirements: 17.10
   */
  async deleteRepository(clusterId: string, name: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.delete(`/clusters/${clusterId}/_snapshot/${name}`);
    });
  }

  /**
   * Get snapshots in a repository
   *
   * Requirements: 18.1
   */
  async getSnapshots(clusterId: string, repository: string): Promise<SnapshotInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<{ snapshots: Array<Record<string, unknown>> }>(
        `/clusters/${clusterId}/_snapshot/${repository}/_all`
      );

    const raw = response.data.snapshots || [];
    // Normalize snake_case fields and compute shards progress if present.
    // Ensure startTime and durationInMillis are always present to satisfy
    // frontend expectations and TypeScript contracts.
       const normalized: SnapshotInfo[] = (raw as unknown[]).map((s: unknown) => {
       const rec = s as Record<string, unknown>;
       const startTime = (rec.start_time as string | undefined) ?? (rec.startTime as string | undefined) ?? new Date(0).toISOString();
       const endTime = (rec.end_time as string | undefined) ?? (rec.endTime as string | undefined) ?? undefined;
       const duration = (rec.duration_in_millis as number | undefined) ?? (rec.durationInMillis as number | undefined) ?? 0;

       const rawShards = rec.shards ?? rec.shards_stats ?? { total: 0, successful: 0, failed: 0 };
       const shards = {
         total: Number((rawShards as Record<string, unknown>).total ?? 0),
         successful: Number((rawShards as Record<string, unknown>).successful ?? 0),
         failed: Number((rawShards as Record<string, unknown>).failed ?? 0),
       };

       const indices = (rec.indices as unknown[]) ?? [];

       return {
         snapshot: rec.snapshot,
         uuid: rec.uuid,
         state: rec.state,
         indices: indices,
         start_time: rec.start_time ?? startTime,
         end_time: rec.end_time ?? endTime,
         duration_in_millis: rec.duration_in_millis ?? duration,
        // Provide camelCase aliases so UI code that reads startTime/durationInMillis
        // can rely on these fields being present after normalization.
        startTime: startTime,
        endTime: endTime,
        durationInMillis: duration,
        shards: shards,
       } as SnapshotInfo;
    });

    return normalized;
    });
  }

  /**
   * Create a snapshot
   *
   * Requirements: 18.2, 18.3, 18.4, 18.5
   */
  async createSnapshot(
    clusterId: string,
    repository: string,
    request: CreateSnapshotRequest
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      const body: Record<string, unknown> = {};

      if (request.indices && request.indices.length > 0) {
        body.indices = request.indices.join(',');
      }
      if (request.ignoreUnavailable !== undefined) {
        body.ignore_unavailable = request.ignoreUnavailable;
      }
      if (request.includeGlobalState !== undefined) {
        body.include_global_state = request.includeGlobalState;
      }
      if (request.partial !== undefined) {
        body.partial = request.partial;
      }

      await this.client.put(
        `/clusters/${clusterId}/_snapshot/${repository}/${request.snapshot}`,
        body
      );
    });
  }

  /**
   * Delete a snapshot
   *
   * Requirements: 18.7
   */
  async deleteSnapshot(clusterId: string, repository: string, snapshot: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.delete(`/clusters/${clusterId}/_snapshot/${repository}/${snapshot}`);
    });
  }

  /**
   * Restore a snapshot
   *
   * Requirements: 18.8, 18.9
   */
  async restoreSnapshot(
    clusterId: string,
    repository: string,
    snapshot: string,
    request: RestoreSnapshotRequest
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      const body: Record<string, unknown> = {};

      if (request.indices && request.indices.length > 0) {
        body.indices = request.indices.join(',');
      }
      if (request.ignoreUnavailable !== undefined) {
        body.ignore_unavailable = request.ignoreUnavailable;
      }
      if (request.includeGlobalState !== undefined) {
        body.include_global_state = request.includeGlobalState;
      }
      if (request.renamePattern) {
        body.rename_pattern = request.renamePattern;
      }
      if (request.renameReplacement) {
        body.rename_replacement = request.renameReplacement;
      }
      if (request.includeAliases !== undefined) {
        body.include_aliases = request.includeAliases;
      }
      if (request.partial !== undefined) {
        body.partial = request.partial;
      }

      await this.client.post(
        `/clusters/${clusterId}/_snapshot/${repository}/${snapshot}/_restore`,
        body
      );
    });
  }

  /**
   * Get available Cat API endpoints
   *
   * Requirements: 20.1
   */
  async getCatEndpoints(_clusterId: string): Promise<string[]> {
    return this.executeWithRetry(async () => {
      // Return a predefined list of common Cat API endpoints
      // These are standard Elasticsearch Cat APIs
      return [
        'aliases',
        'allocation',
        'count',
        'fielddata',
        'health',
        'indices',
        'master',
        'nodeattrs',
        'nodes',
        'pending_tasks',
        'plugins',
        'recovery',
        'repositories',
        'segments',
        'shards',
        'snapshots',
        'tasks',
        'templates',
        'thread_pool',
      ];
    });
  }

  /**
   * Execute a Cat API request
   *
   * Requirements: 20.2, 20.3
   */
  async executeCatApi(
    clusterId: string,
    endpoint: string,
    params?: Record<string, string>
  ): Promise<Array<Record<string, string | number>>> {
    return this.executeWithRetry(async () => {
      // Build query parameters
      const queryParams = new URLSearchParams({
        format: 'json',
        ...params,
      });

      const response = await this.client.get<Array<Record<string, string | number>>>(
        `/clusters/${clusterId}/_cat/${endpoint}?${queryParams.toString()}`
      );

      return response.data;
    });
  }

  /**
   * Get help text for a Cat API endpoint
   *
   * Requirements: 20.7
   */
  async getCatApiHelp(clusterId: string, endpoint: string): Promise<string> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<string>(
        `/clusters/${clusterId}/_cat/${endpoint}?help`
      );

      return response.data;
    });
  }

  /**
   * Get index statistics
   *
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   */
  async getIndexStats(clusterId: string, indexName: string): Promise<IndexStats> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<Record<string, unknown>>(
        `/clusters/${clusterId}/${indexName}/_stats`
      );

      // The response is an object with indices as keys; treat as unknown and
      // perform runtime normalization to avoid TypeScript complaints about
      // snake_case vs camelCase shapes coming from the server.
      const indicesObj = response.data.indices as Record<string, unknown> | undefined;
      const indexDataRaw = indicesObj ? indicesObj[indexName] : undefined;

      if (!indexDataRaw) {
        throw new Error(`Statistics not found for index: ${indexName}`);
      }

      // Normalize a minimal stats shape used by the UI (IndexStatistics page).
      // Convert snake_case fields to camelCase and ensure numeric defaults.
      const normalizeNumber = (v: unknown) => (v === undefined || v === null ? 0 : Number(v as number));

       const idxRec = indexDataRaw as Record<string, unknown> | undefined;
       // Prefer idxRec.total, fall back to idxRec._all, otherwise empty object.
       let total: Record<string, unknown> = {};
       if (idxRec) {
         const t = idxRec.total as Record<string, unknown> | undefined;
         const all = idxRec._all as Record<string, unknown> | undefined;
         if (t && typeof t === 'object') total = t;
         else if (all && typeof all === 'object') total = all;
       }

       let primaries: Record<string, unknown> = {};
       if (idxRec) {
         const p = idxRec.primaries as Record<string, unknown> | undefined;
         if (p && typeof p === 'object') primaries = p;
       }

       // Narrow dynamic groups to Record to perform safe lookups
       const totalRec = total as Record<string, unknown>;
       const primariesRec = primaries as Record<string, unknown>;

       const normalized: IndexStats = {
         total: {
           docs: {
             count: normalizeNumber(
               // check nested docs object then snake_case count then fallback 0
               ((totalRec.docs as Record<string, unknown> | undefined)?.count) ?? totalRec.docs_count ?? 0
             ),
             deleted: normalizeNumber(
               ((totalRec.docs as Record<string, unknown> | undefined)?.deleted) ?? totalRec.docs_deleted ?? 0
             ),
           },
           store: {
             sizeInBytes: normalizeNumber(
               ((totalRec.store as Record<string, unknown> | undefined)?.size_in_bytes) ??
                 ((totalRec.store as Record<string, unknown> | undefined)?.sizeInBytes) ??
                 totalRec.store_size_in_bytes ?? 0
             ),
           },
         },
         primaries: {
           docs: {
             count: normalizeNumber(
               ((primariesRec.docs as Record<string, unknown> | undefined)?.count) ?? primariesRec.docs_count ?? 0
             ),
             deleted: normalizeNumber(
               ((primariesRec.docs as Record<string, unknown> | undefined)?.deleted) ?? primariesRec.docs_deleted ?? 0
             ),
           },
           store: {
             sizeInBytes: normalizeNumber(
               ((primariesRec.store as Record<string, unknown> | undefined)?.size_in_bytes) ??
                 ((primariesRec.store as Record<string, unknown> | undefined)?.sizeInBytes) ??
                 primariesRec.store_size_in_bytes ?? 0
             ),
           },
         },
       } as IndexStats;

      // Indexing/search/segments/merges/refresh/flush/search fields the UI expects
      // may be nested under total or primaries. Copy over common groups if present.
       const pickGroup = (src: Record<string, unknown> | undefined, dst: Record<string, unknown>, groupName: string) => {
         if (!src) return;
         const alt = groupName.replace(/([A-Z])/g, '_$1').toLowerCase();
         const g = src[groupName] ?? src[alt];
         if (g && typeof g === 'object') {
           dst[groupName] = Object.keys(g as Record<string, unknown>).reduce((acc: Record<string, unknown>, k) => {
             // convert snake_case keys to camelCase for commonly used fields
             const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
             acc[camel] = (g as Record<string, unknown>)[k];
             return acc;
           }, {} as Record<string, unknown>);
         }
       };

      pickGroup(total as Record<string, unknown> | undefined, normalized.total as Record<string, unknown>, 'indexing');
      pickGroup(total as Record<string, unknown> | undefined, normalized.total as Record<string, unknown>, 'search');
      pickGroup(total as Record<string, unknown> | undefined, normalized.total as Record<string, unknown>, 'segments');
      pickGroup(total as Record<string, unknown> | undefined, normalized.total as Record<string, unknown>, 'merges');
      pickGroup(total as Record<string, unknown> | undefined, normalized.total as Record<string, unknown>, 'refresh');
      pickGroup(total as Record<string, unknown> | undefined, normalized.total as Record<string, unknown>, 'flush');

      pickGroup(primaries as Record<string, unknown> | undefined, normalized.primaries as Record<string, unknown>, 'indexing');
      pickGroup(primaries as Record<string, unknown> | undefined, normalized.primaries as Record<string, unknown>, 'search');
      pickGroup(primaries as Record<string, unknown> | undefined, normalized.primaries as Record<string, unknown>, 'segments');
      pickGroup(primaries as Record<string, unknown> | undefined, normalized.primaries as Record<string, unknown>, 'merges');
      pickGroup(primaries as Record<string, unknown> | undefined, normalized.primaries as Record<string, unknown>, 'refresh');
      pickGroup(primaries as Record<string, unknown> | undefined, normalized.primaries as Record<string, unknown>, 'flush');

      return normalized;
    });
  }

  /**
   * Relocate a shard from one node to another
   *
   * Executes the Elasticsearch cluster reroute API to move a shard.
   * The shard will be copied to the destination node and then removed
   * from the source node.
   *
   * Requirements: 6.1, 6.2, 6.5, 6.6, 6.7
   */
  async relocateShard(
    clusterId: string,
    request: RelocateShardRequest
  ): Promise<RelocateShardResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post<RelocateShardResponse>(
        `/clusters/${clusterId}/shards/relocate`,
        request
      );
      return response.data;
    });
  }

  /**
   * Get cluster metrics from Prometheus
   *
   * Requirements: 1.0, 1.1
   */
  async getClusterMetrics(
    clusterId: string,
    params?: { start?: number; end?: number }
  ): Promise<ClusterMetricsHistoryResponse> {
    return this.executeWithRetry(async () => {
      const url = new URL(`/api/clusters/${clusterId}/metrics`, window.location.origin);
      if (params?.start) url.searchParams.append('start', String(params.start));
      if (params?.end) url.searchParams.append('end', String(params.end));

      const response = await fetch(url.toString(), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const raw = (await response.json()) as unknown;

      // Normalize into a consistent frontend-friendly shape:
      // { data: Array<Point>, prometheus_queries?: Record, raw_metrics?: Record }
      const normalizePoint = (p: unknown) => {
        const rec = asRecord(p);
        const timestampIso = parseTimestamp(rec);

        return {
          ...rec,
          date: timestampIso,
          node_count: numOrUndefined(rec.node_count ?? rec.nodeCount ?? rec.nodes ?? rec.node_count),
          index_count: numOrUndefined(rec.index_count ?? rec.indexCount ?? rec.indices ?? rec.index_count),
          document_count: numOrUndefined(
            rec.document_count ?? rec.documentCount ?? rec.documents ?? rec.document_count
          ),
          shard_count: numOrUndefined(rec.shard_count ?? rec.shardCount ?? rec.shards ?? rec.shard_count),
          unassigned_shards: numOrUndefined(
            rec.unassigned_shards ?? rec.unassignedShards ?? rec.unassigned ?? rec.unassigned_shards
          ),
          cpu_percent: numOrUndefined(rec.cpu_percent ?? rec.cpuPercent ?? rec.cpu ?? rec.cpu_percent),
          memory_used_bytes: numOrUndefined(
            rec.memory_used_bytes ?? rec.memoryUsedBytes ?? rec.memory ?? rec.memory_used_bytes
          ),
          disk_used_bytes: numOrUndefined(rec.disk_used_bytes ?? rec.diskUsedBytes ?? rec.disk ?? rec.disk_used_bytes),
        };
      };

       const dataArr: unknown[] = getDataArray(raw).map(normalizePoint);

       const rawRec = asRecord(raw);
       const normalized = {
         cluster_id: pickFirstString(rawRec, ['cluster_id', 'clusterId'], clusterId),
         time_range: rawRec.time_range ?? rawRec.timeRange ?? { start: params?.start ?? 0, end: params?.end ?? 0 },
         data: dataArr,
         prometheus_queries: asRecord(rawRec.prometheus_queries ?? rawRec.prometheusQueries ?? {}),
         raw_metrics: asRecord(rawRec.raw_metrics ?? rawRec.rawMetrics ?? {}),
       } as ClusterMetricsHistoryResponse;

      return normalized;
    });
  }

  /**
   * Get cluster metrics history for heatmap
   *
   * Requirements: 3.0
   */
  async getClusterMetricsHistory(
    clusterId: string,
    params?: { start?: number; end?: number }
  ): Promise<ClusterMetricsHistoryResponse> {
    return this.executeWithRetry(async () => {
      const url = new URL(`/api/clusters/${clusterId}/metrics/history`, window.location.origin);
      if (params?.start) url.searchParams.append('start', String(params.start));
      if (params?.end) url.searchParams.append('end', String(params.end));

      const response = await fetch(url.toString(), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics history: ${response.statusText}`);
      }

      const raw = (await response.json()) as unknown;

      // Reuse the same normalization helpers as getClusterMetrics
      const normalizePoint = (p: unknown) => {
        const rec = asRecord(p);
        const timestampIso = parseTimestamp(rec);
        return {
          ...rec,
          date: timestampIso,
          node_count: numOrUndefined(rec.node_count ?? rec.nodeCount ?? rec.nodes ?? rec.node_count),
          index_count: numOrUndefined(rec.index_count ?? rec.indexCount ?? rec.indices ?? rec.index_count),
          document_count: numOrUndefined(
            rec.document_count ?? rec.documentCount ?? rec.documents ?? rec.document_count
          ),
          shard_count: numOrUndefined(rec.shard_count ?? rec.shardCount ?? rec.shards ?? rec.shard_count),
          unassigned_shards: numOrUndefined(
            rec.unassigned_shards ?? rec.unassignedShards ?? rec.unassigned ?? rec.unassigned_shards
          ),
          cpu_percent: numOrUndefined(rec.cpu_percent ?? rec.cpuPercent ?? rec.cpu ?? rec.cpu_percent),
          memory_used_bytes: numOrUndefined(
            rec.memory_used_bytes ?? rec.memoryUsedBytes ?? rec.memory ?? rec.memory_used_bytes
          ),
          disk_used_bytes: numOrUndefined(rec.disk_used_bytes ?? rec.diskUsedBytes ?? rec.disk ?? rec.disk_used_bytes),
        };
      };

      const dataArr: unknown[] = getDataArray(raw).map(normalizePoint);
      const rawRec = asRecord(raw);
      const normalized = {
        cluster_id: pickFirstString(rawRec, ['cluster_id', 'clusterId'], clusterId),
        time_range: rawRec.time_range ?? rawRec.timeRange ?? { start: params?.start ?? 0, end: params?.end ?? 0 },
        data: dataArr,
        prometheus_queries: asRecord(rawRec.prometheus_queries ?? rawRec.prometheusQueries ?? {}),
        raw_metrics: asRecord(rawRec.raw_metrics ?? rawRec.rawMetrics ?? {}),
      } as ClusterMetricsHistoryResponse;

      return normalized;
    });
  }

  /**
   * Get node metrics from Prometheus (heap, CPU, disk over time)
   *
   * Requirements: 1.0, 1.1
   */
  async getNodeMetrics(
   clusterId: string,
   nodeId: string,
   params?: { start?: number; end?: number }
  ): Promise<NodeMetricsHistoryResponse> {
   return this.executeWithRetry(async () => {
      const url = new URL(`/api/clusters/${clusterId}/metrics/nodes/${nodeId}`, window.location.origin);
      if (params?.start) url.searchParams.append('start', String(params.start));
      if (params?.end) url.searchParams.append('end', String(params.end));

      const response = await fetch(url.toString(), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch node metrics: ${response.statusText}`);
      }

      const raw = (await response.json()) as unknown;

      const normalizePoint = (p: unknown) => {
        const rec = asRecord(p);
        const timestampIso = parseTimestamp(rec);
        return {
          ...rec,
          date: timestampIso,
          cpu_percent: numOrUndefined(rec.cpu_percent ?? rec.cpuPercent ?? rec.cpu),
          memory_used_bytes: numOrUndefined(rec.memory_used_bytes ?? rec.memoryUsedBytes ?? rec.memory),
          disk_used_bytes: numOrUndefined(rec.disk_used_bytes ?? rec.diskUsedBytes ?? rec.disk),
          heap_used_bytes: numOrUndefined(rec.heap_used_bytes ?? rec.heapUsedBytes ?? rec.heap),
        };
      };

      const dataArr: unknown[] = getDataArray(raw).map(normalizePoint);
      const rawRec = asRecord(raw);
      const normalized = {
        cluster_id: pickFirstString(rawRec, ['cluster_id', 'clusterId'], clusterId),
        node_id: pickFirstString(rawRec, ['node_id', 'nodeId'], nodeId),
        time_range: rawRec.time_range ?? rawRec.timeRange ?? { start: params?.start ?? 0, end: params?.end ?? 0 },
        data: dataArr,
        prometheus_queries: asRecord(rawRec.prometheus_queries ?? rawRec.prometheusQueries ?? {}),
      } as NodeMetricsHistoryResponse;

      return normalized;
    });
  }

  /**
  * Get all active tasks in a cluster with optional filtering
  *
  * Requirements: 1, 2, 3 (Task display with filtering)
  */
  async getTasks(
   clusterId: string,
   filters?: {
     types?: string[];
     actions?: string[];
     idFilter?: string;
     cancellable?: string[];
   }
  ): Promise<TasksListResponse> {
   return this.executeWithRetry(async () => {
     const params: Record<string, string> = {};
     if (filters?.types && filters.types.length > 0) {
       params.type_filter = filters.types.join(',');
     }
     if (filters?.actions && filters.actions.length > 0) {
       params.action_filter = filters.actions.join(',');
     }
     if (filters?.idFilter) {
       params.id_filter = filters.idFilter;
     }
     if (filters?.cancellable && filters.cancellable.length > 0) {
       params.cancellable_filter = filters.cancellable.join(',');
     }

     const response = await this.client.get<TasksListResponse>(
       `/clusters/${clusterId}/tasks`,
       { params }
     );
     return response.data;
   });
  }

  /**
  * Get detailed information about a specific task
  *
  * Requirements: 4 (Task details modal)
  */
  async getTaskDetails(clusterId: string, taskId: string): Promise<TaskDetailsResponse> {
   return this.executeWithRetry(async () => {
     const response = await this.client.get<TaskDetailsResponse>(
       `/clusters/${clusterId}/tasks/${taskId}`
     );
     return response.data;
   });
  }

  /**
  * Cancel a specific task
  *
  * Requirements: 5 (Cancel task action)
  */
  async cancelTask(clusterId: string, taskId: string): Promise<CancelTaskResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post<CancelTaskResponse>(
        `/clusters/${clusterId}/tasks/${taskId}/_cancel`
      );
      return response.data;
    });
  }

  /**
   * Get Sankey diagram data for a cluster — shard flow from indices to nodes.
   *
   * Requirements: topology-sankey-view 2.1
   */
   async getSankeyData(
     clusterId: string,
     params?: SankeyQueryParams
   ): Promise<SankeyResponse> {
    return this.executeWithRetry(async () => {
      const queryParams: Record<string, string | number | boolean> = {};
      if (params?.topIndices !== undefined) queryParams['topIndices'] = params.topIndices;
      if (params?.includeUnassigned !== undefined) queryParams['includeUnassigned'] = params.includeUnassigned;
      if (params?.roles) queryParams['roles'] = params.roles;
      if (params?.states) queryParams['states'] = params.states;
      if (params?.excludeSpecial !== undefined) queryParams['excludeSpecial'] = params.excludeSpecial;
      if (params?.sortBy) queryParams['sortBy'] = params.sortBy;
      const response = await this.client.get<SankeyResponse>(
        `/clusters/${clusterId}/topology/sankey`,
        { params: queryParams }
      );

      // Narrow node.kind to the frontend expected union where possible.
       const data = asRecord(response.data);
       const nodes = asArray(data.nodes).map((n: unknown) => {
         const rec = asRecord(n);
        const kindRaw = (rec.kind as string | undefined) ?? 'index';
        // Normalize any server variants to one of the three frontend kinds
        const kind: 'index' | 'node' | 'unassigned' =
          kindRaw === 'node' || kindRaw === 'NODE'
            ? 'node'
            : kindRaw === 'unassigned' || kindRaw === 'unassigned_shard' || kindRaw === 'unassignedShard'
            ? 'unassigned'
            : 'index';

        return {
          id: rec.id as string,
          kind,
          totalShards: Number(rec.totalShards ?? rec.total_shards ?? rec.total ?? 0),
          primaryShards: Number(rec.primaryShards ?? rec.primary_shards ?? rec.primary ?? 0),
          replicaShards: Number(rec.replicaShards ?? rec.replica_shards ?? rec.replica ?? 0),
          storeBytes: Number(rec.storeBytes ?? rec.store_bytes ?? 0),
        };
      });

       const links = asArray(data.links).map((l: unknown) => {
         const r = asRecord(l);
        return {
          source: r.source as string,
          target: r.target as string,
          totalShards: Number(r.totalShards ?? r.total_shards ?? r.value ?? 0),
          primaryShards: Number(r.primaryShards ?? r.primary_shards ?? 0),
          replicaShards: Number(r.replicaShards ?? r.replica_shards ?? 0),
        };
      });

      return { nodes, links, meta: data.meta ?? {} } as SankeyResponse;
    });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();
