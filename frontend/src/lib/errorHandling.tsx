import { notifications } from '@mantine/notifications';
import { IconX, IconAlertCircle } from '@tabler/icons-react';
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

  // Handle Axios/Fetch errors with response
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: ApiError; status?: number; statusText?: string; headers?: Record<string, string> } }).response;
    
    if (response?.data) {
      return {
        error: response.data.error || 'api_error',
        message: response.data.message || 'An error occurred',
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
        message: 'Network error. Please check your connection.',
        details: err.message,
      };
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
 * Display a user-friendly error notification
 * 
 * @param error - Error object to display
 * @param title - Optional custom title for the notification
 * 
 * Requirements: 29.6
 */
export function showErrorNotification(error: unknown, title?: string) {
  const errorDetails = parseError(error);
  
  notifications.show({
    title: title || 'Error',
    message: errorDetails.message,
    color: 'red',
    icon: <IconX size={18} />,
    autoClose: 5000,
  });
}

/**
 * Display a warning notification
 * 
 * @param message - Warning message to display
 * @param title - Optional custom title for the notification
 */
export function showWarningNotification(message: string, title?: string) {
  notifications.show({
    title: title || 'Warning',
    message,
    color: 'yellow',
    icon: <IconAlertCircle size={18} />,
    autoClose: 5000,
  });
}

/**
 * Format error details for display in expandable sections
 * 
 * @param errorDetails - Structured error details
 * @returns Formatted error details as a string
 * 
 * Requirements: 29.7
 */
export function formatErrorDetails(errorDetails: ErrorDetails): string {
  const parts: string[] = [];
  
  if (errorDetails.error) {
    parts.push(`Error Code: ${errorDetails.error}`);
  }
  
  if (errorDetails.statusCode) {
    parts.push(`Status Code: ${errorDetails.statusCode}`);
  }
  
  if (errorDetails.requestId) {
    parts.push(`Request ID: ${errorDetails.requestId}`);
  }
  
  if (errorDetails.details) {
    parts.push(`Details: ${JSON.stringify(errorDetails.details, null, 2)}`);
  }
  
  return parts.join('\n');
}

/**
 * Error boundary fallback component props
 */
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Get a user-friendly error message based on error type
 * 
 * @param error - Error object
 * @returns User-friendly error message
 */
export function getUserFriendlyMessage(error: ErrorDetails): string {
  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    network_error: 'Unable to connect to the server. Please check your internet connection.',
    timeout_error: 'The request took too long to complete. Please try again.',
    unauthorized: 'You are not authorized to perform this action. Please log in.',
    forbidden: 'You do not have permission to access this resource.',
    not_found: 'The requested resource was not found.',
    server_error: 'A server error occurred. Please try again later.',
    cluster_not_found: 'The specified cluster was not found.',
    proxy_failed: 'Failed to communicate with the Elasticsearch cluster.',
  };
  
  return errorMessages[error.error || ''] || error.message;
}
