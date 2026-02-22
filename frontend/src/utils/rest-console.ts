/**
 * REST Console utility functions
 *
 * Provides request parsing and validation for the REST Console feature.
 *
 * Requirements: 13.3, 13.4, 13.6
 */

import { RestRequest, HttpMethod } from '../types/rest-console';

/**
 * Valid HTTP methods for REST Console
 */
const VALID_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];

/**
 * Parse a REST Console request string
 *
 * Expected format:
 * ```
 * METHOD /endpoint
 * {
 *   "optional": "json body"
 * }
 * ```
 *
 * The first line must contain the HTTP method and endpoint path.
 * Subsequent lines are treated as the optional JSON body.
 *
 * @param input - Raw request string from the console editor
 * @returns Parsed REST request
 * @throws Error if the request format is invalid
 *
 * Requirements: 13.3, 13.4
 */
export function parseRequest(input: string): RestRequest {
  if (!input || input.trim().length === 0) {
    throw new Error('Request cannot be empty');
  }

  const lines = input.trim().split('\n');
  const firstLine = lines[0].trim();

  if (!firstLine) {
    throw new Error('First line cannot be empty');
  }

  // Parse method and path from first line
  const parts = firstLine.split(/\s+/);

  if (parts.length < 2) {
    throw new Error('Request must include both method and path (e.g., "GET /_cluster/health")');
  }

  const method = parts[0].toUpperCase();
  const path = parts[1];

  // Validate HTTP method
  if (!VALID_METHODS.includes(method as HttpMethod)) {
    throw new Error(
      `Invalid HTTP method: ${method}. Valid methods are: ${VALID_METHODS.join(', ')}`
    );
  }

  // Validate path starts with /
  if (!path.startsWith('/')) {
    throw new Error('Path must start with / (e.g., "/_cluster/health")');
  }

  // Extract body (everything after first line)
  const bodyLines = lines.slice(1);
  const body = bodyLines.join('\n').trim();

  return {
    method: method as HttpMethod,
    path,
    body: body || undefined,
  };
}

/**
 * Validate JSON body syntax
 *
 * Attempts to parse the JSON body to ensure it's valid JSON.
 * Returns true if valid or if body is empty/undefined.
 *
 * @param body - JSON body string to validate
 * @returns True if valid JSON or empty
 * @throws Error with descriptive message if JSON is invalid
 *
 * Requirements: 13.7
 */
export function validateJsonBody(body?: string): boolean {
  if (!body || body.trim().length === 0) {
    return true;
  }

  try {
    JSON.parse(body);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid JSON body: ${error.message}`);
    }
    throw new Error('Invalid JSON body');
  }
}

/**
 * Format JSON string with proper indentation
 *
 * @param json - JSON string to format
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns Formatted JSON string
 */
export function formatJson(json: string, indent: number = 2): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, indent);
  } catch {
    // If parsing fails, return original string
    return json;
  }
}

/**
 * Parse and validate a complete REST Console request
 *
 * Combines parsing and validation into a single function.
 *
 * @param input - Raw request string from the console editor
 * @returns Parsed and validated REST request
 * @throws Error if the request is invalid
 *
 * Requirements: 13.3, 13.4, 13.7
 */
export function parseAndValidateRequest(input: string): RestRequest {
  const request = parseRequest(input);

  // Validate JSON body if present
  if (request.body) {
    validateJsonBody(request.body);
  }

  return request;
}
