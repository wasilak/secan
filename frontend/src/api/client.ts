import axios, { AxiosInstance, AxiosError, Method } from 'axios';
import {
  ClusterInfo,
  ClusterHealth,
  LoginRequest,
  ApiError,
  ApiClientError,
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
 * API client for communicating with the Cerebro backend
 * 
 * Handles authentication, error handling, retry logic with exponential backoff,
 * and provides typed methods for all backend API endpoints.
 * 
 * Requirements: 25.4
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
      this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt);
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
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>
  ): Promise<T> {
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
        return Promise.reject(
          new ApiClientError('Authentication required', 401, data)
        );
      }

      // Handle authorization errors (403)
      if (status === 403) {
        return Promise.reject(
          new ApiClientError('Access forbidden', 403, data)
        );
      }

      // Handle other HTTP errors
      const message = data?.message || error.message || 'An error occurred';
      return Promise.reject(new ApiClientError(message, status, data));
    }

    // Handle network errors
    if (error.request) {
      return Promise.reject(
        new ApiClientError('Network error - unable to reach server', 0)
      );
    }

    // Handle other errors
    return Promise.reject(
      new ApiClientError(error.message || 'An unexpected error occurred', 0)
    );
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
   * Requirements: 21.5, 21.6, 23.4, 25.4
   */
  async proxyRequest<T = unknown>(
    clusterId: string,
    method: Method,
    path: string,
    body?: unknown
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      // Ensure path starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      const response = await this.client.request<T>({
        method,
        url: `/clusters/${clusterId}${normalizedPath}`,
        data: body,
      });

      return response.data;
    });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();
