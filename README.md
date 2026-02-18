# Secan

![build](https://github.com/lmenezes/cerebro/workflows/build/badge.svg?branch=master)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

**Secan** (Old English: *sēcan* - to seek, to inquire)

A modern, lightweight Elasticsearch cluster management tool built with Rust and React. Provides a full-width, responsive interface for managing Elasticsearch clusters with features including cluster monitoring, index management, shard visualization, and interactive shard reallocation.

Heavily inspired by [Cerebro](https://github.com/lmenezes/cerebro), the original Elasticsearch web admin tool.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
  - [Binary Installation](#binary-installation)
  - [Docker](#docker)
  - [Building from Source](#building-from-source)
- [Configuration](#configuration)
  - [Basic Configuration](#basic-configuration)
  - [Authentication Modes](#authentication-modes)
  - [Cluster Configuration](#cluster-configuration)
  - [Environment Variables](#environment-variables)
- [Shard Relocation](#shard-relocation)
- [API Reference](#api-reference)
- [Docker Deployment](#docker-deployment)
- [Development](#development)
  - [Prerequisites](#prerequisites)
  - [Development Workflow](#development-workflow)
  - [Running Tests](#running-tests)
- [Contributing](#contributing)
- [Architecture](#architecture)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- **Modern Architecture**: Built with Rust (backend) and React + TypeScript (frontend)
- **Full-Width Interface**: Optimized for modern wide screens with responsive design
- **Interactive Shard Management**: Visual grid-based shard allocation with click-to-relocate
- **Multiple Authentication Modes**: Open mode, local users, and OIDC support
- **Cluster Monitoring**: Real-time cluster health, node statistics, and index metrics
- **REST Console**: Execute Elasticsearch queries directly from the UI
- **Single Binary**: Embedded frontend assets for easy deployment
- **Docker Support**: Ready-to-use Docker images for containerized deployments
- **Multi-Architecture**: Supports Linux (amd64/arm64), macOS (amd64/arm64), and Windows (amd64)

## Requirements

- No runtime dependencies (single binary includes everything)
- Supports Elasticsearch 7.x, 8.x, 9.x and OpenSearch

## Quick Start

### Binary Installation

1. Download the latest release for your platform from [GitHub Releases](https://github.com/lmenezes/cerebro/releases)
2. Extract the archive
3. Copy the example configuration:
   ```bash
   cp config.example.yaml config.yaml
   ```
4. Run the binary:
   ```bash
   # Linux/macOS
   ./secan
   
   # Windows
   secan.exe
   ```
5. Access the UI at http://localhost:9000

### Docker

```bash
# Pull and run from GitHub Container Registry
docker pull ghcr.io/lmenezes/secan:latest
docker run -p 9000:9000 ghcr.io/lmenezes/secan:latest

# Or use Docker Compose
docker-compose up -d
```

Access Secan at http://localhost:9000

### Building from Source

```bash
# Build frontend
cd frontend
npm install
npm run build

# Build backend (includes embedded frontend)
cd ..
cargo build --release

# Run
./target/release/secan
```

## Configuration

Secan uses a YAML configuration file. Copy `config.example.yaml` to `config.yaml` and customize it for your environment.

```bash
cp config.example.yaml config.yaml
```

Configuration files are searched in this order:
1. `./config.yaml` (current directory)
2. `/etc/secan/config.yaml`
3. `~/.config/secan/config.yaml`

You can also specify a custom config file:
```bash
./secan --config /path/to/config.yaml
```

### Basic Configuration

```yaml
server:
  host: "0.0.0.0"
  port: 9000

auth:
  mode: "open"  # No authentication required
  session_timeout_minutes: 30

clusters:
  - id: "local"
    name: "Local Development"
    nodes:
      - "http://localhost:9200"
    auth:
      type: "none"
    tls:
      verify: false
```

### Authentication Modes

#### Open Mode (No Authentication)
Perfect for development and testing:

```yaml
auth:
  mode: "open"
```

#### Local Users
Authenticate with username/password:

```yaml
auth:
  mode: "local_users"
  local_users:
    - username: "admin"
      password_hash: "$2b$12$..."  # bcrypt hash
      roles: ["admin"]
  roles:
    - name: "admin"
      cluster_patterns: ["*"]
```

Generate password hash:
```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your_password', bcrypt.gensalt()).decode())"
```

#### OIDC (OpenID Connect)
Integrate with identity providers:

```yaml
auth:
  mode: "oidc"
  oidc:
    discovery_url: "https://accounts.google.com/.well-known/openid-configuration"
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    redirect_uri: "http://localhost:9000/api/auth/oidc/callback"
```

### Cluster Configuration

Connect to multiple Elasticsearch clusters:

```yaml
clusters:
  - id: "production"
    name: "Production Cluster"
    nodes:
      - "https://es-prod-1.example.com:9200"
      - "https://es-prod-2.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "your-password"
    tls:
      verify: true
      ca_cert_file: "/path/to/ca.crt"
```

#### Cluster Authentication Types

- **None**: No authentication
  ```yaml
  auth:
    type: "none"
  ```

- **Basic**: Username and password
  ```yaml
  auth:
    type: "basic"
    username: "elastic"
    password: "changeme"
  ```

- **API Key**: Elasticsearch API key
  ```yaml
  auth:
    type: "api_key"
    key: "your-base64-encoded-api-key"
  ```

### Environment Variables

Override configuration with environment variables:

```bash
# Server settings
export SERVER_HOST=0.0.0.0
export SERVER_PORT=9000

# Authentication
export AUTH_MODE=open

# Cluster configuration
export CLUSTERS_0_NODES_0=http://elasticsearch:9200

# Run Secan
./secan
```

## Shard Relocation

Secan provides an interactive visual interface for manually relocating Elasticsearch shards between nodes.

### Quick Start

1. Navigate to a cluster and click the "Topology" tab
2. Click on any green (STARTED) shard
3. Select "Select for relocation" from the context menu
4. Click on a purple destination indicator
5. Confirm the relocation

The grid updates in real-time to show relocation progress.

### Features

- **Visual Grid**: See all shards organized by node and index
- **Color-Coded States**: Green (healthy), yellow (initializing), orange (relocating), red (unassigned)
- **Smart Validation**: Only valid destinations are shown
- **Real-Time Progress**: Watch shards relocate with auto-refresh
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Shard Type Indicators**: Easily identify primary (P) and replica (R) shards

### Shard States

| State | Color | Description |
|-------|-------|-------------|
| STARTED | Green | Healthy, active shard |
| INITIALIZING | Yellow | Shard is being initialized |
| RELOCATING | Orange | Shard is currently moving |
| UNASSIGNED | Red | Shard has no assigned node |

### Best Practices

1. Relocate during low-traffic periods when possible
2. Relocate one shard at a time for large shards
3. Monitor cluster health during relocation
4. Check node resources before relocating
5. Avoid relocating multiple shards simultaneously unless necessary

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Focus next shard |
| Shift+Tab | Focus previous shard |
| Enter / Space | Open context menu |
| Arrow Keys | Navigate menu |
| Escape | Close menu or exit relocation mode |

## API Reference

Secan provides a RESTful API for programmatic cluster management. All endpoints are prefixed with `/api`.

### Authentication

API authentication depends on the configured mode:
- **Open Mode**: No authentication required
- **Local Users**: Session-based with cookies
- **OIDC**: Session-based with OIDC tokens

### Key Endpoints

#### Clusters
- `GET /api/clusters` - List all configured clusters
- `GET /api/clusters/:id/stats` - Get cluster health and statistics
- `GET /api/clusters/:id/nodes` - Get node information
- `GET /api/clusters/:id/indices` - Get index information
- `GET /api/clusters/:id/shards` - Get shard information

#### Shard Management
- `POST /api/clusters/:id/shards/relocate` - Relocate a shard
  ```json
  {
    "index": "logs-2024",
    "shard": 0,
    "from_node": "node-1",
    "to_node": "node-2"
  }
  ```

#### Proxy
- `ANY /api/clusters/:id/proxy/*path` - Forward requests to Elasticsearch

### Response Format

Success:
```json
{
  "data": { ... }
}
```

Error:
```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

### Examples

```bash
# Get cluster stats
curl http://localhost:9000/api/clusters/local/stats

# Relocate shard
curl -X POST http://localhost:9000/api/clusters/local/shards/relocate \
  -H "Content-Type: application/json" \
  -d '{"index":"logs-2024","shard":0,"from_node":"node-1","to_node":"node-2"}'
```

## Docker Deployment

### Quick Start with Docker

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/lmenezes/secan:latest

# Run with default settings
docker run -d \
  --name secan \
  -p 9000:9000 \
  ghcr.io/lmenezes/secan:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  secan:
    image: ghcr.io/lmenezes/secan:latest
    ports:
      - "9000:9000"
    environment:
      - SECAN_AUTH_MODE=open
      - SECAN_SERVER_PORT=9000
    volumes:
      - ./config.yaml:/config/config.yaml:ro
    restart: unless-stopped
```

### Configuration with Docker

Mount a configuration file:

```bash
docker run -d \
  --name secan \
  -p 9000:9000 \
  -v $(pwd)/config.yaml:/config/config.yaml:ro \
  ghcr.io/lmenezes/secan:latest
```

Or use environment variables:

```bash
docker run -d \
  --name secan \
  -p 9000:9000 \
  -e SECAN_AUTH_MODE=open \
  -e SECAN_SERVER_PORT=9000 \
  ghcr.io/lmenezes/secan:latest
```

### TLS Certificates

Mount certificates for secure cluster connections:

```bash
docker run -d \
  --name secan \
  -p 9000:9000 \
  -v $(pwd)/config.yaml:/config/config.yaml:ro \
  -v $(pwd)/certs:/certs:ro \
  ghcr.io/lmenezes/secan:latest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secan
spec:
  replicas: 2
  selector:
    matchLabels:
      app: secan
  template:
    metadata:
      labels:
        app: secan
    spec:
      containers:
      - name: secan
        image: ghcr.io/lmenezes/secan:latest
        ports:
        - containerPort: 9000
        env:
        - name: SECAN_AUTH_MODE
          value: "open"
        livenessProbe:
          httpGet:
            path: /health
            port: 9000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "500m"
            memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: secan
spec:
  selector:
    app: secan
  ports:
  - port: 80
    targetPort: 9000
  type: LoadBalancer
```

## Development

### Prerequisites
- Rust 1.75 or newer
- Node.js 18 or newer
- npm or yarn

### Development Workflow

```bash
# Start Elasticsearch (optional)
docker-compose up -d elasticsearch

# Terminal 1: Run backend in watch mode
cargo watch -x run

# Terminal 2: Run frontend in dev mode
cd frontend
npm run dev
```

Frontend dev server runs on http://localhost:5173 and proxies API requests to the backend.

### Running Tests

```bash
# Backend tests
cargo test
cargo clippy
cargo fmt --check

# Frontend tests
cd frontend
npm test
npm run lint

# Run all tests with Task
task test
```

### Task Automation

Secan uses [Task](https://taskfile.dev) for build automation:

```bash
# Install Task
# macOS
brew install go-task/tap/go-task

# Linux
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin

# Available tasks
task dev          # Run development servers
task build        # Build everything
task test         # Run all tests
task clean        # Clean build artifacts
```

See [Taskfile.yml](Taskfile.yml) for all available tasks.

## Contributing

We welcome contributions! Here's how to get started:

### Bug Reports

When reporting bugs, please include:
- Secan version and Elasticsearch version
- Configuration details (sanitized)
- Steps to reproduce
- Expected vs actual behavior

### Pull Requests

Before submitting a PR:

1. Open an issue to discuss the feature or fix
2. Include tests for your changes
3. Run all tests and linters:
   ```bash
   cargo test && cargo clippy && cargo fmt
   cd frontend && npm test && npm run lint
   ```
4. Squash development commits
5. Rebase against main before submitting

### Code Style

**Rust Backend:**
- Follow standard Rust conventions
- Run `cargo fmt` before committing
- Address all `cargo clippy` warnings
- Add documentation for public APIs

**TypeScript Frontend:**
- Follow TypeScript best practices
- Use functional components with hooks
- Run `npm run lint` before committing
- Add JSDoc for complex functions

### Development Tips

- Use `cargo watch -x run` for auto-reload during backend development
- Frontend dev server proxies API requests to backend
- Check both backend and frontend logs when debugging
- Test with real Elasticsearch clusters when possible

## Architecture

- **Backend**: Rust with Axum web framework, async/await with Tokio
- **Frontend**: React 18 + TypeScript with Vite build system
- **UI Framework**: Mantine UI components
- **State Management**: Zustand for client state, TanStack Query for server state
- **Deployment**: Single binary with embedded frontend assets via rust-embed

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

### GPL v3 Summary

Secan is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

### Attribution Requirements

When distributing Secan or derivative works:
- Include the full GPL v3 license text
- Provide source code or written offer to provide source
- Document any modifications made
- Preserve copyright notices

## Acknowledgments

Secan is heavily inspired by [Cerebro](https://github.com/lmenezes/cerebro), the original Elasticsearch web admin tool created by Leonardo Menezes. We're grateful to the Cerebro project and its contributors for pioneering this space and providing the foundation that inspired Secan's development.

Special thanks to:
- The Cerebro project and community
- The Rust and React communities
- All contributors to Secan
- The Elasticsearch team for their excellent database
