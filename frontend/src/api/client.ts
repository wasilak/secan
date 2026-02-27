import axios, { AxiosInstance, AxiosError, Method } from 'axios';
import {
  ClusterInfo,
  ClusterHealth,
  ClusterStats,
  NodeInfo,
  NodeDetailStats,
  IndexInfo,
  ShardInfo,
  LoginRequest,
  ApiError,
  ApiClientError,
  AliasInfo,
  CreateAliasRequest,
  TemplateInfo,
  CreateTemplateRequest,
  ClusterSettings,
  UpdateClusterSettingsRequest,
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
  ClusterMetrics,
  ClusterMetricsHistoryResponse,
} from '../types/api';

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
  maxRetries: 3,
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
      headers: {
        'Content-Type': 'application/json',
      },
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
        window.location.href = '/login';
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
        // Check if this is an Elasticsearch error response
        const responseData = data as unknown as Record<string, unknown>;
        if (responseData.error && typeof responseData.error === 'object') {
          elasticsearchError = responseData as unknown as ApiError;
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
      return Promise.reject(new ApiClientError('Network error - unable to reach server', 0));
    }

    // Handle other errors
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
   * Get list of accessible clusters
   *
   * Requirements: 23.4, 25.4
   */
  async getClusters(): Promise<ClusterInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<ClusterInfo[]>('/clusters');
      return response.data;
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
      const response = await this.client.get<ClusterStats>(`/clusters/${clusterId}/stats`);
      return response.data;
    });
  }

  /**
   * Get list of nodes in a cluster
   *
   * Handles optional fields with default values:
   * - loadAverage defaults to undefined if not provided
   * - uptime defaults to undefined if not provided
   * - tags defaults to empty array if not provided
   *
   * Requirements: 4.6, 14.1, 14.2
   */
  async getNodes(clusterId: string): Promise<NodeInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<NodeInfo[]>(`/clusters/${clusterId}/nodes`);

      // Ensure optional fields have proper defaults
      return response.data.map((node) => ({
        ...node,
        tags: node.tags ?? [],
        loadAverage: node.loadAverage ?? undefined,
        uptime: node.uptime ?? undefined,
        uptimeMillis: node.uptimeMillis ?? undefined,
      }));
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

      return {
        ...data,
        cpuPercent: validateNumber(data.cpuPercent, 'cpuPercent'),
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
   * Get list of indices in a cluster
   *
   * Requirements: 4.7
   */
  async getIndices(clusterId: string): Promise<IndexInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<IndexInfo[]>(`/clusters/${clusterId}/indices`);
      return response.data;
    });
  }

  /**
   * Get shard allocation information
   *
   * Requirements: 4.8
   */
  async getShards(clusterId: string): Promise<ShardInfo[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<ShardInfo[]>(`/clusters/${clusterId}/shards`);
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
   * Get cluster settings
   *
   * Requirements: 13.1, 13.2
   */
  async getClusterSettings(
    clusterId: string,
    includeDefaults: boolean = false
  ): Promise<ClusterSettings> {
    return this.executeWithRetry(async () => {
      const params = includeDefaults ? '?include_defaults=true' : '';
      const response = await this.client.get<ClusterSettings>(
        `/clusters/${clusterId}/_cluster/settings${params}`
      );
      return response.data;
    });
  }

  /**
   * Update cluster settings
   *
   * Requirements: 13.3, 13.4, 13.5
   */
  async updateClusterSettings(
    clusterId: string,
    request: UpdateClusterSettingsRequest
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.put(`/clusters/${clusterId}/_cluster/settings`, request);
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

      const response = await this.client.post<AnalyzeTextResponse>(endpoint, body);
      return response.data;
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
      const properties = indexData?.mappings?.properties || {};

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
      const response = await this.client.get<{ snapshots: SnapshotInfo[] }>(
        `/clusters/${clusterId}/_snapshot/${repository}/_all`
      );

      return response.data.snapshots || [];
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
      const response = await this.client.get<{ indices: Record<string, IndexStats> }>(
        `/clusters/${clusterId}/${indexName}/_stats`
      );

      // The response is an object with indices as keys
      const indexData = response.data.indices?.[indexName];

      if (!indexData) {
        throw new Error(`Statistics not found for index: ${indexName}`);
      }

      return indexData;
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
  ): Promise<ClusterMetrics[]> {
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

      return response.json() as Promise<ClusterMetrics[]>;
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

      return response.json() as Promise<ClusterMetricsHistoryResponse>;
    });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();
