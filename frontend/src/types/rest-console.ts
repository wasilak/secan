/**
 * REST Console types
 *
 * Type definitions for the REST Console feature that allows users to
 * execute arbitrary Elasticsearch API requests.
 *
 * Requirements: 13.3, 13.4
 */

/**
 * HTTP methods supported by the REST Console
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH';

/**
 * REST request parsed from console input
 *
 * Format: METHOD /endpoint
 * Optional JSON body on subsequent lines
 */
export interface RestRequest {
  method: HttpMethod;
  path: string;
  body?: string;
}

/**
 * REST response from Elasticsearch
 *
 * Includes status, data, and timing information
 */
export interface RestResponse {
  status: number;
  statusText: string;
  data: unknown;
  timing: number;
  headers?: Record<string, string>;
}

/**
 * Request history item stored in localStorage
 *
 * Tracks executed requests with timestamps for history feature
 */
export interface RequestHistoryItem {
  id: string;
  timestamp: number;
  request: RestRequest;
  response?: RestResponse;
}

/**
 * Console preferences for user customization
 */
export interface ConsolePreferences {
  maxHistoryEntries: number;
  autoFormat: boolean;
  theme: 'light' | 'dark';
}

/**
 * Default console preferences
 */
export const DEFAULT_CONSOLE_PREFERENCES: ConsolePreferences = {
  maxHistoryEntries: 100,
  autoFormat: true,
  theme: 'dark',
};
