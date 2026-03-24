import { ApiError } from '../types/api';

/**
 * Error details interface for structured error information
 */
export interface ErrorDetails {
  error?: string;
  message: string;
  details?: unknown;
  statusCode?: number;
  requestId?: string;
}

/**
 * Parse error from various sources into a structured format
 *
 * @param error - Error object from API call or other source
 * @returns Structured error details
 *
 * Requirements: 29.6, 29.7
 */
export function parseError(error: unknown): ErrorDetails {
  // Log to console for debugging
  console.error('Error occurred:', error);

  // Handle ApiClientError instances (from our API client)
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ApiClientError' &&
    'message' in error &&
    'statusCode' in error
  ) {
    const apiError = error as {
      message: string;
      statusCode: number;
      error?: ApiError;
    };

    // Try to extract Elasticsearch error from the error property
    if (apiError.error) {
      const esError = extractElasticsearchError(apiError.error);
      if (esError) {
        return {
          error: 'elasticsearch_error',
          message: esError,
          statusCode: apiError.statusCode,
          details: apiError.error,
        };
      }
    }

    return {
      error: 'api_error',
      message: apiError.message,
      statusCode: apiError.statusCode,
      details: apiError.error,
    };
  }

  // Handle Axios/Fetch errors with response
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (
      error as {
        response?: {
          data?: ApiError;
          status?: number;
          statusText?: string;
          headers?: Record<string, string>;
        };
      }
    ).response;

    if (response?.data) {
      // Try to extract Elasticsearch error if present
      const esError = extractElasticsearchError(response.data);

      return {
        error: response.data.error || 'api_error',
        message: esError || response.data.message || 'An error occurred',
        details: response.data.details,
        statusCode: response.status,
        requestId: response.headers?.['x-request-id'],
      };
    }

    return {
      error: 'http_error',
      message: `HTTP ${response?.status || 'Unknown'}: ${response?.statusText || 'Request failed'}`,
      statusCode: response?.status,
    };
  }

  // Handle network errors
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as Error;

    if (err.message.includes('Network') || err.message.includes('fetch')) {
      return {
        error: 'network_error',
        message: 'Network error - unable to reach server. Please ensure the backend is running.',
        details: err.message,
      };
    }

    // Check if it's an HTTP error with status
    if ('statusCode' in error || 'status' in error) {
      const httpError = error as { statusCode?: number; status?: number; message?: string };
      const status = httpError.statusCode || httpError.status;
      if (status) {
        return {
          error: 'http_error',
          message: `HTTP ${status}: ${httpError.message || getStatusText(status)}`,
          statusCode: status,
        };
      }
    }

    return {
      error: 'error',
      message: err.message,
      details: err.stack,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      error: 'error',
      message: error,
    };
  }

  // Unknown error type
  return {
    error: 'unknown_error',
    message: 'An unexpected error occurred',
    details: error,
  };
}

/**
 * Extract Elasticsearch error message from API error response
 *
 * @param data - API error response data
 * @returns Elasticsearch error message if found, null otherwise
 */
function extractElasticsearchError(data: ApiError | Record<string, unknown>): string | null {
  const errorData = data as Record<string, unknown>;

  if (errorData.error && typeof errorData.error === 'object') {
    const esError = errorData.error as Record<string, unknown>;

    if (esError.reason && typeof esError.reason === 'string') {
      let message = `Elasticsearch Error: (${esError.type || 'unknown'}) - ${esError.reason}`;

      if (
        esError.root_cause &&
        Array.isArray(esError.root_cause) &&
        esError.root_cause.length > 0
      ) {
        const rootCause = esError.root_cause[0] as Record<string, unknown>;
        if (rootCause.reason && rootCause.reason !== esError.reason) {
          message += `\nRoot Cause: ${rootCause.reason}`;
        }
      }

      return message;
    }
  }

  if ('details' in errorData && errorData.details && typeof errorData.details === 'object') {
    const details = errorData.details as Record<string, unknown>;

    if (details.error && typeof details.error === 'object') {
      const esError = details.error as Record<string, unknown>;

      if (esError.reason && typeof esError.reason === 'string') {
        let message = `Elasticsearch Error: (${esError.type || 'unknown'}) - ${esError.reason}`;

        if (
          esError.root_cause &&
          Array.isArray(esError.root_cause) &&
          esError.root_cause.length > 0
        ) {
          const rootCause = esError.root_cause[0] as Record<string, unknown>;
          if (rootCause.reason && rootCause.reason !== esError.reason) {
            message += `\nRoot Cause: ${rootCause.reason}`;
          }
        }

        return message;
      }
    }
  }

  return null;
}

/**
 * Get HTTP status text
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found - the index or resource does not exist',
    409: 'Conflict',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || `Error ${status}`;
}

/**
 * Error boundary fallback component props
 */
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}
