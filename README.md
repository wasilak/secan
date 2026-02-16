Secan
------------
![build](https://github.com/lmenezes/cerebro/workflows/build/badge.svg?branch=master)

**Secan** (Old English: *sēcan* - to seek, to inquire)

Heavily inspired by Cerebro, a now few years out of date Elasticsearch admin tool.

Secan is a modern, lightweight Elasticsearch cluster management tool built with Rust and React. It provides a full-width, responsive interface for managing Elasticsearch clusters with features including cluster monitoring, index management, shard visualization, and interactive shard reallocation.

## Features

- **Modern Architecture**: Built with Rust (backend) and React + TypeScript (frontend)
- **Full-Width Interface**: Optimized for modern wide screens with responsive design
- **Interactive Shard Management**: Visual grid-based shard allocation with click-to-relocate ([User Guide](SHARD_RELOCATION.md))
- **Multiple Authentication Modes**: Open mode, local users, and OIDC support
- **Cluster Monitoring**: Real-time cluster health, node statistics, and index metrics
- **REST Console**: Execute Elasticsearch queries directly from the UI
- **Single Binary**: Embedded frontend assets for easy deployment
- **Docker Support**: Ready-to-use Docker images for containerized deployments

## Requirements

- No runtime dependencies (single binary includes everything)
- Supports Elasticsearch 7.x, 8.x, 9.x and OpenSearch

## Quick Start

### Binary Installation

1. Download the latest release for your platform from [Releases](https://github.com/lmenezes/cerebro/releases)
2. Extract the archive
3. Run the binary:
   ```bash
   # Linux/macOS
   ./secan
   
   # Windows
   secan.exe
   ```
4. Access the UI at http://localhost:8080

### Docker

```bash
# Run with Docker
docker run -p 8080:8080 ghcr.io/lmenezes/cerebro:latest

# Or use Docker Compose
docker-compose up -d
```

Access Secan at http://localhost:8080

### Building from Source

```bash
# Build frontend
cd frontend
npm install
npm run build

# Build backend (includes embedded frontend)
cd ../backend
cargo build --release

# Run
./target/release/secan
```

## Configuration

Secan uses a YAML configuration file. By default, it looks for `config.yaml` in the current directory.

### Basic Configuration

```yaml
server:
  host: "0.0.0.0"
  port: 8080

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

#### OIDC (OpenID Connect)
Integrate with identity providers:

```yaml
auth:
  mode: "oidc"
  oidc:
    discovery_url: "https://accounts.google.com/.well-known/openid-configuration"
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    redirect_uri: "http://localhost:8080/api/auth/oidc/callback"
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

See [CONFIGURATION.md](CONFIGURATION.md) for detailed configuration options.

## Shard Relocation

Secan provides an interactive visual interface for manually relocating Elasticsearch shards between nodes.

### Quick Start

1. Navigate to a cluster and click the "Shards" tab
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

See [SHARD_RELOCATION.md](SHARD_RELOCATION.md) for the complete user guide.

## Environment Variables

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

## Docker Deployment

See [DOCKER.md](DOCKER.md) for comprehensive Docker deployment guide including:
- Docker Compose setup
- Environment variable configuration
- TLS certificate mounting
- Kubernetes deployment examples
- Production best practices

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
cd backend
cargo watch -x run

# Terminal 2: Run frontend in dev mode
cd frontend
npm run dev
```

Frontend dev server runs on http://localhost:5173 and proxies API requests to the backend.

### Running Tests

```bash
# Backend tests
cd backend
cargo test

# Frontend tests
cd frontend
npm test

# Run all tests
task test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Task Automation

Secan uses [Task](https://taskfile.dev) for build automation:

```bash
# Install Task (if not already installed)
# macOS
brew install go-task/tap/go-task

# Linux
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin

# Run development server
task dev

# Build everything
task build-frontend
task build-backend

# Run tests
task test

# Clean build artifacts
task clean
```

See [Taskfile.yml](Taskfile.yml) for all available tasks.

## API

Secan provides a RESTful API for programmatic cluster management. See [API.md](API.md) for complete API reference including:

- Cluster statistics and health
- Node information and metrics
- Index management
- Shard relocation
- Elasticsearch proxy endpoint

## Architecture

- **Backend**: Rust with Axum web framework, async/await with Tokio
- **Frontend**: React 18 + TypeScript with Vite build system
- **UI Framework**: Mantine UI components
- **State Management**: Zustand for client state, TanStack Query for server state
- **Deployment**: Single binary with embedded frontend assets via rust-embed

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

Secan is heavily inspired by [Cerebro](https://github.com/lmenezes/cerebro), the original Elasticsearch web admin tool. We're grateful to the Cerebro project and its contributors for pioneering this space.
