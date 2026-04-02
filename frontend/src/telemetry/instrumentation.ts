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
  // Log config for debugging
  const config = getTelemetryConfig();
  logger.info('Telemetry config:', {
    enabled: config.enabled,
    serviceName: config.serviceName,
    endpoint: config.collectorEndpoint
  });

  if (!config.enabled) {
    logger.info('Telemetry disabled - skipping initialization');
    return;
  }

  try {
    logger.info('Initializing telemetry...');

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

    // Create the OTLP exporter with debug logging
    // The backend proxy will forward these traces to the OTLP collector
    const exporter = new OTLPTraceExporter({
      url: config.collectorEndpoint,
      headers: {
        'Content-Type': 'application/x-protobuf',
      },
    });

    // Wrap the exporter to log success/failure
    const originalExport = exporter.export.bind(exporter);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exporter.export = (items: any, resultCallback: any) => {
      logger.info(`Exporting ${items.length} span(s) to ${config.collectorEndpoint}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalExport(items, (result: any) => {
        if (result.error) {
          logger.error('Export failed:', result.error);
        } else {
          logger.info(`Successfully exported ${items.length} span(s)`);
        }
        resultCallback(result);
      });
    };

    // Register auto-instrumentations BEFORE creating provider
    // This is critical - instrumentations must be registered first
    registerInstrumentations({
      instrumentations: [
        // Instrument fetch API (for modern browsers)
        // Each fetch creates its own root span (separate trace) - this is correct for SPAs
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            // Propagate trace context to same-origin requests
            /.*/, // All URLs (same-origin policy will handle CORS)
          ],
          clearTimingResources: true,
          // Apply custom attributes to fetch spans
          applyCustomAttributesOnSpan: (span, request, result) => {
            if (request.method) {
              span.setAttribute('http.request.method', request.method);
            }
            // request can be Request or RequestInit, url only exists on Request
            if ('url' in request && request.url) {
              span.setAttribute('http.request.url', request.url);
            }
            if (result instanceof Response) {
              span.setAttribute('http.response.status_code', result.status);
            }
          },
        }),
        // Instrument XMLHttpRequest (for legacy code/libraries)
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /.*/, // All URLs
          ],
        }),
      ],
    });

    // Create the tracer provider
    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(exporter, {
          // Buffer spans and export in batches
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 1000, // Export every 1s for quicker visibility
          exportTimeoutMillis: 30000,
        }),
      ],
    });

    // Flush spans on page unload to ensure they're exported
    const flushSpans = () => {
      provider.forceFlush().catch((err) => {
        logger.error('Failed to flush spans:', err);
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSpans();
      }
    };

    // Store references for cleanupTelemetry()
    _onVisibilityChange = onVisibilityChange;
    _flushSpans = flushSpans;

    // Flush on page visibility change (user switches tabs)
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Flush before page unload
    window.addEventListener('beforeunload', flushSpans);
    window.addEventListener('pagehide', flushSpans);

    // Register the provider (instrumentations are already registered above)
    provider.register({
      contextManager: new ZoneContextManager(),
      propagator: new W3CTraceContextPropagator(),
    });

    // DEBUG: Force export a test span to verify the pipeline
    const tracer = provider.getTracer('secan-frontend', '1.2.28');
    const testSpan = tracer.startSpan('test-initialization');
    testSpan.setAttribute('test', true);
    testSpan.end();
    logger.info('Sent test span to verify pipeline');

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

// Exported listener references for cleanup (populated by initTelemetry).
// Stored at module scope so cleanupTelemetry() can remove them.
let _onVisibilityChange: (() => void) | null = null;
let _flushSpans: (() => void) | null = null;

/**
 * Remove all global event listeners registered by `initTelemetry`.
 * Should be called on application teardown (e.g. in test afterEach or HMR).
 */
export function cleanupTelemetry(): void {
  if (_onVisibilityChange) {
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    _onVisibilityChange = null;
  }
  if (_flushSpans) {
    window.removeEventListener('beforeunload', _flushSpans);
    window.removeEventListener('pagehide', _flushSpans);
    _flushSpans = null;
  }
}