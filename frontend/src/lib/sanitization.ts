/**
 * Input sanitization utilities for preventing XSS attacks
 * 
 * Requirements: 30.6
 */

/**
 * Sanitize HTML string to prevent XSS
 * 
 * Removes potentially dangerous HTML tags and attributes
 * 
 * @param input - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(input: string): string {
  // Create a temporary div element
  const temp = document.createElement('div');
  
  // Set text content (this automatically escapes HTML)
  temp.textContent = input;
  
  // Return the escaped HTML
  return temp.innerHTML;
}

/**
 * Sanitize string for use in URLs
 * 
 * Encodes special characters to prevent injection
 * 
 * @param input - The string to sanitize
 * @returns URL-safe string
 */
export function sanitizeUrl(input: string): string {
  return encodeURIComponent(input);
}

/**
 * Sanitize string for use in JSON
 * 
 * Escapes special characters
 * 
 * @param input - The string to sanitize
 * @returns JSON-safe string
 */
export function sanitizeJson(input: string): string {
  return JSON.stringify(input).slice(1, -1); // Remove surrounding quotes
}

/**
 * Validate and sanitize index name
 * 
 * Index names must:
 * - Be lowercase
 * - Not start with _, -, or +
 * - Not be . or ..
 * - Not contain /, \, *, ?, ", <, >, |, space, comma, #
 * - Not be longer than 255 bytes
 * 
 * @param name - The index name to validate
 * @returns Validation result with error message if invalid
 */
export function validateIndexName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Index name cannot be empty' };
  }
  
  if (name.length > 255) {
    return { valid: false, error: 'Index name cannot be longer than 255 bytes' };
  }
  
  if (name.startsWith('_') || name.startsWith('-') || name.startsWith('+')) {
    return { valid: false, error: 'Index name cannot start with _, -, or +' };
  }
  
  if (name === '.' || name === '..') {
    return { valid: false, error: 'Index name cannot be . or ..' };
  }
  
  const invalidChars = ['/', '\\', '*', '?', '"', '<', '>', '|', ' ', ',', '#'];
  for (const char of invalidChars) {
    if (name.includes(char)) {
      return { valid: false, error: `Index name cannot contain '${char}'` };
    }
  }
  
  if (name !== name.toLowerCase()) {
    return { valid: false, error: 'Index name must be lowercase' };
  }
  
  return { valid: true };
}

/**
 * Validate JSON string
 * 
 * @param input - The JSON string to validate
 * @returns Validation result with error message if invalid
 */
export function validateJson(input: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON' 
    };
  }
}

/**
 * Sanitize user input string
 * 
 * Removes control characters and limits length
 * 
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  // Trim whitespace
  let sanitized = input.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Escape HTML entities in a string
 * 
 * Converts <, >, &, ", ' to their HTML entity equivalents
 * 
 * @param input - The string to escape
 * @returns Escaped string
 */
export function escapeHtml(input: string): string {
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  
  return input.replace(/[&<>"']/g, (char) => entityMap[char] || char);
}

/**
 * Validate cluster ID format
 * 
 * Cluster IDs must be alphanumeric with hyphens and underscores only
 * 
 * @param id - The cluster ID to validate
 * @returns Validation result with error message if invalid
 */
export function validateClusterId(id: string): { valid: boolean; error?: string } {
  if (!id || id.length === 0) {
    return { valid: false, error: 'Cluster ID cannot be empty' };
  }
  
  if (id.length > 100) {
    return { valid: false, error: 'Cluster ID cannot be longer than 100 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { 
      valid: false, 
      error: 'Cluster ID can only contain alphanumeric characters, hyphens, and underscores' 
    };
  }
  
  return { valid: true };
}
