/**
 * Frontend OpenTelemetry Configuration
 * 
 * Reads OTEL_* environment variables from the backend-injected config
 * or uses sensible defaults for development.
 */

// Configuration interface
export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  collectorEndpoint: string;
  resourceAttributes: Record<string, string>;
}

// Default configuration
// NOTE: serviceName should be consistent with backend - the backend injects
// its service name via meta tag, so we default to 'secan' to match
const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true, // Enable by default in development
  serviceName: 'secan',
  serviceVersion: '1.2.28',
  collectorEndpoint: '/v1/traces', // Same-origin proxy endpoint
  resourceAttributes: {},
};

/**
 * Parse resource attributes from OTEL_RESOURCE_ATTRIBUTES format
 * Format: "key1=value1,key2=value2"
 */
function parseResourceAttributes(attributesString: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  
  if (!attributesString) {
    return attributes;
  }
  
  const pairs = attributesString.split(',');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.trim().split('=');
    if (key && valueParts.length > 0) {
      attributes[key.trim()] = valueParts.join('=').trim();
    }
  }
  
  return attributes;
}

/**
 * Get telemetry configuration from environment
 * 
 * In production, these values are injected by the backend via meta tags
 * or window.__OTEL_CONFIG
 */
export function getTelemetryConfig(): TelemetryConfig {
  // Check for backend-injected config (window.__OTEL_CONFIG)
  const windowConfig = (window as unknown as { __OTEL_CONFIG?: Partial<TelemetryConfig> }).__OTEL_CONFIG;
  
  // Check for meta tags (fallback)
  const getMetaTag = (name: string): string | null => {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta?.getAttribute('content') || null;
  };
  
  // Determine if telemetry is enabled
  // OTEL_SDK_DISABLED=false means ENABLED
  const disabledValue = windowConfig?.enabled !== undefined 
    ? !windowConfig.enabled 
    : getMetaTag('otel-sdk-disabled');
  const enabled = disabledValue === 'false' || disabledValue === false;
  
  // Service name
  const serviceName = windowConfig?.serviceName 
    || getMetaTag('otel-service-name') 
    || DEFAULT_CONFIG.serviceName;
  
  // Service version
  const serviceVersion = windowConfig?.serviceVersion 
    || getMetaTag('otel-service-version') 
    || DEFAULT_CONFIG.serviceVersion;
  
  // Collector endpoint
  const collectorEndpoint = windowConfig?.collectorEndpoint 
    || getMetaTag('otel-exporter-otlp-endpoint') 
    || DEFAULT_CONFIG.collectorEndpoint;
  
  // Resource attributes
  const resourceAttributesString = getMetaTag('otel-resource-attributes') || '';
  const resourceAttributes = {
    ...DEFAULT_CONFIG.resourceAttributes,
    ...parseResourceAttributes(resourceAttributesString),
    ...(windowConfig?.resourceAttributes || {}),
  };
  
  return {
    enabled,
    serviceName,
    serviceVersion,
    collectorEndpoint,
    resourceAttributes,
  };
}

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  return getTelemetryConfig().enabled;
}