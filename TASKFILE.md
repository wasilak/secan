# Taskfile Usage

This project uses [Task](https://taskfile.dev/) for build automation.

## Installation

### macOS
```bash
brew install go-task
```

### Linux
```bash
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin
```

### Windows
```powershell
choco install go-task
```

Or download from: https://github.com/go-task/task/releases

## Available Tasks

### Development

```bash
# Build frontend, build backend, and run server
task dev

# Full development setup (start ES, bootstrap data, run server)
task full-dev
```

### Building

```bash
# Build frontend only
task build-frontend

# Build backend only
task build-backend
```

### Testing

```bash
# Run all tests
task test

# Run backend tests only
task test-backend

# Run frontend tests only
task test-frontend
```

### Linting

```bash
# Run all linters
task lint

# Run backend linter (clippy + fmt check)
task lint-backend

# Run frontend linter
task lint-frontend
```

### Data Management

```bash
# Bootstrap test data in Elasticsearch
task bootstrap-data

# Clean up test data
task cleanup-data
```

### Docker

```bash
# Start Elasticsearch
task docker-up

# Stop Elasticsearch
task docker-down
```

### Cleanup

```bash
# Remove all build artifacts
task clean
```

## Quick Start

1. Install Task (see above)
2. Start Elasticsearch: `task docker-up`
3. Wait a few seconds for ES to start
4. Bootstrap test data: `task bootstrap-data`
5. Run the dev server: `task dev`
6. Open http://localhost:27182

Or simply run: `task full-dev` (does all of the above)

## Notes

- The `dev` task will rebuild the frontend and backend before running
- Task uses file watching to determine if rebuilds are needed
- The backend serves the embedded frontend assets from `backend/assets/`
- Frontend builds output to `backend/assets/` directory
