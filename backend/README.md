# Secan Backend

Secan (Old English: *sēcan* - to seek, to inquire) is a lightweight Elasticsearch cluster management tool built with Rust.

## Overview

The Secan backend is built using:
- **Axum** - Modern web framework for Rust
- **Tokio** - Async runtime
- **Elasticsearch Rust SDK** - Official Elasticsearch client
- **rust-embed** - Embedded frontend assets for single binary distribution

## Building

```bash
cargo build --release
```

The compiled binary will be available at `target/release/secan`.

## Configuration

Secan can be configured using:
1. Configuration file (`config.yaml`)
2. Environment variables (prefixed with `SECAN_`)

### Configuration File

Create a `config.yaml` file:

```yaml
server:
  host: "0.0.0.0"
  port: 27182

auth:
  mode: "local"  # or "oidc"
  session_timeout_minutes: 60

clusters:
  - id: "local"
    name: "Local Cluster"
    nodes:
      - "http://localhost:9200"
```

### Environment Variables

Environment variables use the `SECAN_` prefix with double underscores for nested fields:

```bash
# Server configuration
export SECAN_SERVER__HOST="0.0.0.0"
export SECAN_SERVER__PORT=27182

# Configuration file path
export SECAN_CONFIG_FILE="/path/to/config.yaml"
```

## Running

```bash
# Using default config.yaml
./secan

# Using custom configuration file
SECAN_CONFIG_FILE=/path/to/config.yaml ./secan

# With environment variable overrides
SECAN_SERVER__PORT=8080 ./secan
```

## Development

### Running Tests

```bash
cargo test
```

### Code Quality

```bash
# Format code
cargo fmt

# Run linter
cargo clippy
```

## Features

- Multi-cluster management
- TLS support for Elasticsearch connections
- Authentication (local users and OIDC)
- Session management
- Embedded frontend assets (single binary distribution)
- Structured logging with tracing

## License

MIT
