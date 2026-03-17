/**
 * Frontend OpenTelemetry Telemetry Module
 * 
 * This module provides distributed tracing capabilities for the Secan frontend.
 * It uses the OpenTelemetry Web SDK to instrument fetch/XHR requests and
 * export traces to the backend's OTLP proxy endpoint.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { initializeTelemetry, getTracer } from './telemetry';
 * 
 * // Initialize early in app lifecycle
 * initializeTelemetry();
 * 
 * // Create manual spans when needed
 * const tracer = getTracer('my-component');
 * const span = tracer.startSpan('user-action');
 * // ... do work ...
 * span.end();
 * ```
 * 
 * ## Configuration
 * 
 * The backend injects OTEL configuration via meta tags or window.__OTEL_CONFIG:
 * - meta[name="otel-sdk-disabled"]: "false" to enable
 * - meta[name="otel-service-name"]: Service name
 * - meta[name="otel-service-version"]: Service version
 * - meta[name="otel-exporter-otlp-endpoint"]: OTLP endpoint (default: /v1/traces)
 * 
 * ## Architecture
 * 
 * Frontend (Browser) → /v1/traces (Backend Proxy) → OTLP Collector → Jaeger/Zipkin
 * 
 * The browser sends traces via HTTP to the backend's /v1/traces endpoint,
 * which proxies them to the OTLP collector (can use gRPC for better performance).
 */

// Main initialization and instrumentation
export {
  initializeTelemetry,
  shutdownTelemetry,
  getTracer,
} from './instrumentation';

// Configuration
export {
  getTelemetryConfig,
  isTelemetryEnabled,
} from './config';

// Types
export type { TelemetryConfig } from './config';

// Re-export OpenTelemetry API for advanced usage
export { trace, context, propagation } from '@opentelemetry/api';