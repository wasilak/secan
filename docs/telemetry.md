# OpenTelemetry Distributed Tracing

Secan supports distributed tracing using OpenTelemetry, allowing you to monitor and debug requests as they flow through the application and to Elasticsearch clusters.

## Overview

The telemetry implementation provides:

- **HTTP Request Tracing**: Automatic spans for all incoming HTTP requests
- **Elasticsearch Operation Tracing**: Child spans for all ES cluster operations
- **W3C Trace Context**: Standard trace propagation for distributed tracing
- **OTLP Export**: Send traces to any OpenTelemetry-compatible collector (Jaeger, Zipkin, etc.)
- **Zero Overhead**: Completely disabled by default with no runtime cost

## Quick Start

### 1. Enable Telemetry

Set the `OTEL_SDK_DISABLED` environment variable:

```bash
export OTEL_SDK_DISABLED=false
```

### 2. Configure the Collector

By default, traces are sent to `http://localhost:4318` (OTLP HTTP). To use a different endpoint:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf  # or "grpc"
```

### 3. Run Secan

```bash
./secan
```

You should see a log message:
```
INFO OpenTelemetry telemetry initialized successfully
```

## Configuration Reference

All configuration is done via environment variables following OpenTelemetry standards:

### Basic Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_SDK_DISABLED` | Set to `true` to disable telemetry | `false` (enabled) |
| `OTEL_SERVICE_NAME` | Service name shown in traces | `secan` |
| `OTEL_SERVICE_VERSION` | Service version | From `Cargo.toml` |
| `OTEL_RESOURCE_ATTRIBUTES` | Additional attributes (comma-separated key=value pairs) | (empty) |

### OTLP Export Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector URL | `http://localhost:4318` (HTTP) or `http://localhost:4317` (gRPC) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Transport protocol: `http/protobuf` or `grpc` | `http/protobuf` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Authentication headers (comma-separated key=value pairs) | (empty) |

### Sampling Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_TRACES_SAMPLER` | Sampling strategy: `always_on`, `always_off`, `traceidratio`, `parentbased_always_on` | `always_on` |
| `OTEL_TRACES_SAMPLER_ARG` | Argument for ratio-based samplers (0.0 to 1.0) | (none) |

### Batch Export Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_BSP_MAX_QUEUE_SIZE` | Maximum pending spans before dropping | `2048` |
| `OTEL_BSP_SCHEDULE_DELAY` | Export interval in milliseconds | `5000` (5 seconds) |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | Maximum spans per batch | `512` |
| `OTEL_BSP_EXPORT_TIMEOUT` | Export timeout in milliseconds | `30000` (30 seconds) |

## Example Configurations

### Local Development with Jaeger

```bash
# Start Jaeger
 docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Configure Secan
export OTEL_SDK_DISABLED=false
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=secan-dev

# Run Secan
./secan
```

Access Jaeger UI at http://localhost:16686

### Production with Authentication

```bash
export OTEL_SDK_DISABLED=false
export OTEL_SERVICE_NAME=secan-production
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your-token-here"
export OTEL_TRACES_SAMPLER=traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1
export OTEL_RESOURCE_ATTRIBUTES="env=production,region=us-east-1,team=platform"
```

### Using Zipkin

```bash
export OTEL_SDK_DISABLED=false
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:9411/api/v2/spans
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### Console Output (Development/Debugging)

```bash
export OTEL_SDK_DISABLED=false
export OTEL_TRACES_EXPORTER=console
```

This prints traces to stdout instead of sending to a collector (useful for debugging).

## Trace Structure

### HTTP Request Span

When a request comes in, a span is created with:

```
http_request
├── http.method: GET
├── http.route: /api/clusters/{id}
├── http.target: /api/clusters/123
├── http.scheme: https
├── http.host: localhost:3000
├── http.status_code: 200
└── http.response_content_length: 1024
```

### Elasticsearch Operation Span

When querying ES, a child span is created:

```
elasticsearch.query
├── db.system: elasticsearch
├── db.operation: _cluster/health
├── db.statement: {"timeout":"30s"}
├── elasticsearch.cluster_id: production-cluster
├── http.method: GET
├── http.url: http://es-node:9200/_cluster/health
├── http.status_code: 200
└── http.response_content_length: 256
```

### Trace Hierarchy

```
Trace ID: abc123...
├── Span: http_request (GET /api/clusters/{id}/health)
│   ├── http.route: /api/clusters/{id}/health
│   └── http.status_code: 200
│
└── Span: elasticsearch.query (parent: http_request)
    ├── db.operation: _cluster/health
    └── http.status_code: 200
```

## Trace Context Propagation

Secan supports W3C Trace Context for distributed tracing:

### Incoming Requests

If a request includes a `traceparent` header, Secan will:
1. Extract the trace ID and parent span ID
2. Continue the trace from the caller
3. Create child spans for all operations

Example:
```bash
curl -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
     http://localhost:3000/api/clusters
```

### Outgoing Requests (Future Enhancement)

When querying Elasticsearch, Secan injects the trace context so ES can continue the trace (if ES has tracing enabled).

## Performance Considerations

### Overhead

When **disabled** (default):
- Zero runtime overhead
- No allocations
- No network connections

When **enabled**:
- ~1ms latency added per request (span creation)
- Async batch export (non-blocking)
- Memory usage: ~50MB for span buffer

### Sampling

For high-traffic environments, use sampling to reduce overhead:

```bash
# Sample 10% of traces
export OTEL_TRACES_SAMPLER=traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1

# Or use parent-based sampling (sample if parent is sampled)
export OTEL_TRACES_SAMPLER=parentbased_traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1
```

### Batch Configuration

For high-throughput scenarios, tune batch settings:

```bash
# More frequent exports (lower latency, more CPU)
export OTEL_BSP_SCHEDULE_DELAY=1000
export OTEL_BSP_MAX_EXPORT_BATCH_SIZE=256

# Larger queue (more memory, less dropping)
export OTEL_BSP_MAX_QUEUE_SIZE=8192
```

## Troubleshooting

### Telemetry Not Initializing

Check logs for:
```
ERROR Failed to initialize telemetry: ...
```

Common issues:
- Invalid OTLP endpoint URL
- Network connectivity to collector
- Invalid protocol specification

### No Traces in Collector

1. Verify telemetry is enabled:
   ```bash
   echo $OTEL_SDK_DISABLED  # Should be "false" or unset
   ```

2. Check collector is running and accessible:
   ```bash
   curl http://localhost:4318/v1/traces  # Should return 405 (method not allowed) or similar
   ```

3. Enable debug logging:
   ```bash
   export RUST_LOG=opentelemetry=debug
   ```

### High Memory Usage

If the span queue fills up:
```
WARN Dropping spans, queue full
```

Solutions:
- Increase `OTEL_BSP_MAX_QUEUE_SIZE`
- Decrease `OTEL_BSP_SCHEDULE_DELAY` (export more frequently)
- Check collector is responsive
- Enable sampling to reduce span volume

### Console Exporter Not Working

The console exporter is for development only:
```bash
export OTEL_TRACES_EXPORTER=console
```

Note: This requires telemetry to be enabled (`OTEL_SDK_DISABLED=false`).

## Supported Collectors

Secan uses standard OTLP, so it works with any OpenTelemetry-compatible collector:

- **Jaeger**: Native OTLP support (v1.35+)
- **Zipkin**: Via OTLP bridge
- **Prometheus**: Via OpenTelemetry Collector
- **Datadog**: Via OpenTelemetry Collector
- **Honeycomb**: Native OTLP support
- **New Relic**: Native OTLP support
- **AWS X-Ray**: Via OpenTelemetry Collector
- **Google Cloud Trace**: Via OpenTelemetry Collector
- **Azure Monitor**: Via OpenTelemetry Collector

## Architecture

```
┌─────────────┐     HTTP      ┌─────────────┐    OTLP/HTTP    ┌─────────────┐
│   Client    │ ────────────► │   Secan     │ ──────────────► │   Jaeger    │
│             │   Request     │  (Traces)   │    or gRPC      │   Zipkin    │
│             │               │             │                 │   etc.      │
└─────────────┘               └─────────────┘                 └─────────────┘
                                    │
                                    │ Internal
                                    ▼
                          ┌─────────────────────┐
                          │  ES Cluster Client  │
                          │   (Child Spans)     │
                          └─────────────────────┘
```

## Future Enhancements

Phase 2 will add:

- **Frontend Tracing**: Browser-side OpenTelemetry instrumentation
- **End-to-End Traces**: Full request lifecycle from browser through backend to ES
- **Metrics**: OpenTelemetry metrics (counters, histograms)
- **Logs**: Structured log correlation with traces

## References

- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OTLP Protocol](https://opentelemetry.io/docs/specs/otlp/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Rust](https://github.com/open-telemetry/opentelemetry-rust)

## Getting Help

For issues or questions:
1. Check the troubleshooting section above
2. Enable debug logging: `RUST_LOG=opentelemetry=debug`
3. Review the [OpenTelemetry Rust documentation](https://docs.rs/opentelemetry/)
4. Open an issue on the Secan repository
