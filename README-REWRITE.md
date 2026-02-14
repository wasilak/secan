# Cerebro Rewrite

Modern Elasticsearch web administration tool built with Rust and TypeScript/React.

## Quick Start

### Run the Application (Single Binary)

```bash
# Build frontend assets (first time only)
cd frontend
npm install
npm run build

# Run the backend (serves both API and UI)
cd ../backend
cargo run
```

Open `http://localhost:8080` in your browser.

### Configuration

The app is pre-configured for testing with **no authentication required**:

```yaml
# backend/config.yaml
auth:
  mode: "open"  # No login needed!
```

See [CONFIGURATION.md](CONFIGURATION.md) for all authentication modes and options.

### Troubleshooting

If you see errors, check [TEST_API.md](TEST_API.md) for diagnostic steps.

## Features

✅ Single binary distribution (embedded frontend)  
✅ Multi-cluster management  
✅ Three authentication modes (Open, Local Users, OIDC)  
✅ Role-based access control (RBAC)  
✅ Index management (create, settings, mappings, operations)  
✅ REST console with history  
✅ Snapshot management  
✅ Text analysis tools  
✅ Cat API access  
✅ Dark/light theme  
✅ Keyboard navigation (Cmd/Ctrl+K)  
✅ Responsive design  

## Documentation

- [CONFIGURATION.md](CONFIGURATION.md) - Complete configuration guide
- [TEST_API.md](TEST_API.md) - API testing and troubleshooting
- [RUNNING.md](RUNNING.md) - Running and deployment guide

## Architecture

- **Backend**: Rust + Axum (embedded frontend assets via rust-embed)
- **Frontend**: TypeScript + React + Mantine UI
- **Distribution**: Single binary with embedded assets
- **Database**: None (configuration file + browser storage)

## Development

### Backend Development
```bash
cd backend
cargo run
```

### Frontend Development (with hot reload)
```bash
# Terminal 1: Backend
cd backend
cargo run

# Terminal 2: Frontend
cd frontend
npm run dev
```

Frontend dev server proxies API requests to the backend.

## Building for Production

```bash
# Build frontend
cd frontend
npm run build

# Build backend (includes embedded frontend)
cd ../backend
cargo build --release

# Binary is at: backend/target/release/cerebro_backend
```

## Requirements

- Rust 1.70+
- Node.js 18+
- Elasticsearch 7/8/9 or OpenSearch (for cluster connections)
- REST console with request history
- Snapshot and repository management
- Analysis tools for text and analyzers
- Dark/Light/System theme support
- Responsive design for all screen sizes

## Prerequisites

### Backend Development
- Rust 1.75 or later
- Cargo (comes with Rust)

### Frontend Development
- Node.js 18 or later
- npm or yarn

### Optional
- Docker (for containerized deployment)
- Elasticsearch or OpenSearch cluster (for testing)

## Project Structure

```
cerebro-rewrite/
├── backend/              # Rust backend
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── lib.rs       # Library exports
│   │   ├── config/      # Configuration management
│   │   ├── auth/        # Authentication
│   │   ├── cluster/     # Cluster management
│   │   └── routes/      # API routes
│   ├── assets/          # Embedded frontend (generated)
│   └── Cargo.toml       # Rust dependencies
├── frontend/            # React frontend
│   ├── src/
│   │   ├── main.tsx     # Entry point
│   │   ├── App.tsx      # Root component
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── api/         # API client
│   │   └── types/       # TypeScript types
│   ├── index.html       # HTML template
│   ├── vite.config.ts   # Vite configuration
│   └── package.json     # Node dependencies
└── README-REWRITE.md    # This file
```

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cerebro-rewrite
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies and build
cargo build

# Run in development mode
cargo run

# Run with custom config
cargo run -- --config config.yaml

# Run tests
cargo test

# Check code quality
cargo clippy
cargo fmt
```

The backend will start on `http://localhost:9000` by default.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

The frontend dev server will start on `http://localhost:3000` and proxy API requests to the backend.

### 4. Full Stack Development

For full stack development, run both backend and frontend concurrently:

**Terminal 1 (Backend):**
```bash
cd backend
cargo run
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Building for Production

### Single Binary Build

```bash
# Build frontend
cd frontend
npm run build

# Build backend (frontend assets are embedded)
cd ../backend
cargo build --release

# Binary is at: backend/target/release/cerebro-backend
```

### Cross-Platform Builds

```bash
# Install cross-compilation tool
cargo install cross

# Build for Linux x86_64
cross build --release --target x86_64-unknown-linux-gnu

# Build for Linux ARM64
cross build --release --target aarch64-unknown-linux-gnu

# Build for macOS x86_64
cross build --release --target x86_64-apple-darwin

# Build for macOS ARM64 (Apple Silicon)
cross build --release --target aarch64-apple-darwin

# Build for Windows x86_64
cross build --release --target x86_64-pc-windows-gnu
```

## Configuration

### Configuration File

Create a `config.yaml` file:

```yaml
server:
  host: "0.0.0.0"
  port: 9000

auth:
  mode: "open"  # or "local_users" or "oidc"
  session_timeout_minutes: 60

clusters:
  - id: "local"
    name: "Local Elasticsearch"
    nodes:
      - "http://localhost:9200"
    auth:
      type: "none"
    tls:
      verify: false
    client_type: "http"
```

### Environment Variables

Override configuration with environment variables:

```bash
export CEREBRO_SERVER_PORT=8080
export CEREBRO_AUTH_MODE=open
export CEREBRO_CLUSTERS='[{"id":"prod","name":"Production","nodes":["https://es.example.com:9200"]}]'
```

## Running

### Development Mode

```bash
# Backend with auto-reload (requires cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Frontend with hot reload
npm run dev
```

### Production Mode

```bash
# Run the binary
./target/release/cerebro-backend --config config.yaml

# Or with environment variables
CEREBRO_SERVER_PORT=8080 ./target/release/cerebro-backend
```

### Docker

```bash
# Build Docker image
docker build -t cerebro:latest .

# Run container
docker run -p 9000:9000 \
  -v $(pwd)/config.yaml:/config.yaml:ro \
  cerebro:latest
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run property-based tests
cargo test --test property

# Run integration tests
cargo test --test integration
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/components/Dashboard.test.tsx

# Run in watch mode (development)
npm test -- --watch
```

## Code Quality

### Backend

```bash
# Format code
cargo fmt

# Check formatting
cargo fmt -- --check

# Lint code
cargo clippy

# Lint with all warnings
cargo clippy -- -D warnings
```

### Frontend

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint -- --fix
```

## Documentation

- [Requirements Document](.kiro/specs/cerebro-rewrite/requirements.md)
- [Design Document](.kiro/specs/cerebro-rewrite/design.md)
- [Implementation Tasks](.kiro/specs/cerebro-rewrite/tasks.md)

## Architecture

### Backend (Rust + Axum)

- **Axum**: Web framework for HTTP server
- **Tokio**: Async runtime
- **Serde**: Serialization/deserialization
- **rust-embed**: Embed frontend assets
- **elasticsearch-rs**: Elasticsearch client
- **reqwest**: HTTP client for cluster communication

### Frontend (React + Mantine)

- **React 18**: UI framework
- **Mantine UI**: Component library
- **React Router**: Client-side routing
- **Zustand**: State management
- **TanStack Query**: Server state management
- **Axios**: HTTP client
- **Monaco Editor**: Code editor for REST console

## Contributing

1. Follow the Rust and TypeScript best practices in `.kiro/steering/`
2. Write tests for new features
3. Run code quality checks before committing
4. Follow the implementation plan in `tasks.md`

## License

MIT License - See LICENSE file for details

## Migration from Legacy Cerebro

See the migration guide in the documentation for instructions on migrating from the legacy Scala-based Cerebro to this rewrite.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Status

🚧 **Work in Progress** - This is an active rewrite project. See `tasks.md` for current implementation status.

Current Phase: **Phase 1 - Project Setup and Core Infrastructure**
