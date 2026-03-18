/**
 * Simple W3C Trace Context generator
 * 
 * Generates traceparent headers to link frontend requests with backend traces.
 * This is a minimal implementation - no actual span creation, just header injection.
 */

/**
 * Generate a random hex string of specified length
 */
function generateHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a W3C traceparent header
 * Format: 00-<32-char-trace-id>-<16-char-span-id>-<flags>
 */
export function generateTraceparent(): string {
  const version = '00';
  const traceId = generateHex(32);  // 128-bit trace ID
  const spanId = generateHex(16);   // 64-bit span ID  
  const flags = '01';               // 01 = sampled
  
  return `${version}-${traceId}-${spanId}-${flags}`;
}

/**
 * Get traceparent for current request
 * Generates a new one each time (each request is its own trace from frontend perspective)
 */
export function getTraceparent(): string {
  return generateTraceparent();
}
