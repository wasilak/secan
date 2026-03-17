/**
 * Frontend OpenTelemetry Instrumentation
 * 
 * Initializes the OpenTelemetry Web SDK with automatic instrumentation
 * for fetch/XHR requests and manual span creation capabilities.
 */

import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { getTelemetryConfig, isTelemetryEnabled, TelemetryConfig } from './config';

// Logger for telemetry debugging
const logger = {
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[OTel]', ...args);
    }
  },
  info: (...args: unknown[]) => console.info('[OTel]', ...args),
  warn: (...args: unknown[]) => console.warn('[OTel]', ...args),
  error: (...args: unknown[]) => console.error('[OTel]', ...args),
};

/**
 * Initialize OpenTelemetry for the browser
 * 
 * This should be called early in the application lifecycle,
 * ideally before any network requests are made.
 */
export function initializeTelemetry(): void {
  if (!isTelemetryEnabled()) {
    logger.info('Telemetry disabled');
    return;
  }

  try {
    const config = getTelemetryConfig();
    logger.info('Initializing telemetry...', { 
      serviceName: config.serviceName,
      endpoint: config.collectorEndpoint 
    });

    // Enable diagnostic logging in development
    if (process.env.NODE_ENV === 'development') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
      'browser.user_agent': navigator.userAgent,
      'browser.language': navigator.language,
      'browser.platform': navigator.platform,
      ...config.resourceAttributes,
    });

    // Create the OTLP exporter
    // The backend proxy will forward these traces to the OTLP collector
    const exporter = new OTLPTraceExporter({
      url: config.collectorEndpoint,
      headers: {
        'Content-Type': 'application/x-protobuf',
      },
    });

    // Create the tracer provider
    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(exporter, {
          // Buffer spans and export in batches
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
        }),
      ],
    });

    // Register the provider
    provider.register({
      contextManager: new ZoneContextManager(),
      propagator: new W3CTraceContextPropagator(),
    });

    // Register auto-instrumentations
    registerInstrumentations({
      instrumentations: [
        // Instrument fetch API (for modern browsers)
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            // Propagate trace context to same-origin requests
            /.*/, // All URLs (same-origin policy will handle CORS)
          ],
          clearTimingResources: true,
        }),
        // Instrument XMLHttpRequest (for legacy code/libraries)
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /.*/, // All URLs
          ],
        }),
      ],
    });

    // Store provider globally for shutdown
    (window as unknown as { __OTEL_PROVIDER?: WebTracerProvider }).__OTEL_PROVIDER = provider;

    logger.info('Telemetry initialized successfully');

    // Add trace ID to console for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.debug('OTel config:', config);
    }
  } catch (error) {
    logger.error('Failed to initialize telemetry:', error);
    // Don't throw - telemetry failures shouldn't break the app
  }
}

/**
 * Shutdown telemetry gracefully
 * 
 * This should be called when the application is shutting down
 * to ensure all pending spans are exported.
 */
export async function shutdownTelemetry(): Promise<void> {
  const provider = (window as unknown as { __OTEL_PROVIDER?: WebTracerProvider }).__OTEL_PROVIDER;
  
  if (!provider) {
    return;
  }

  try {
    logger.info('Shutting down telemetry...');
    await provider.shutdown();
    logger.info('Telemetry shutdown complete');
  } catch (error) {
    logger.error('Error during telemetry shutdown:', error);
  }
}

/**
 * Get the tracer instance for manual span creation
 * 
 * @param name - Tracer name (typically module/component name)
 */
export function getTracer(name: string) {
  return trace.getTracer(name, '1.2.28');
}

// Re-export config functions
export { getTelemetryConfig, isTelemetryEnabled };
export type { TelemetryConfig };