---
title: Installation
description: Install Secan as a binary or using Docker
slug: 1.2/1.1/1.0/getting-started/installation
---

## Installation Methods

Choose the installation method that best fits your environment.

## Binary Installation

### Download

1. Visit the [GitHub Releases page](https://github.com/wasilak/secan/releases)
2. Download the latest release for your platform:
   * `secan-linux-amd64` for Linux (x86\_64)
   * `secan-linux-arm64` for Linux (ARM64)
   * `secan-macos-amd64` for macOS (Intel)
   * `secan-macos-arm64` for macOS (Apple Silicon)
   * `secan-windows-amd64.exe` for Windows

### Extract and Run

```bash
# Linux/macOS
tar -xzf secan-linux-amd64.tar.gz
cd secan
cp config.example.yaml config.yaml

# Edit config.yaml with your Elasticsearch cluster details
./secan

# Windows
# Extract the ZIP file and open the folder
# Copy config.example.yaml to config.yaml
# Edit config.yaml with your cluster details
# Run secan.exe
```

### Access the UI

Open your browser and navigate to:

```
http://localhost:27182
```

## Docker Installation

### Pull and Run

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/wasilak/secan:1.1

# Run Secan
docker run -d \
  --name secan \
  -p 27182:27182 \
  ghcr.io/wasilak/secan:1.1
```

Access Secan at `http://localhost:27182`

### With Configuration File

```bash
docker run -d \
  --name secan \
  -p 27182:27182 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/wasilak/secan:1.1
```

### Docker Compose

Create `docker-compose.yml`:

```yaml

services:
  secan:
    image: ghcr.io/wasilak/secan:1.1
    ports:
      - "27182:27182"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
    environment:
      - SECAN_AUTH_MODE=open
    restart: unless-stopped
```

Run:

```bash
docker-compose up -d
```

## Building from Source

### Prerequisites

* Rust 1.75 or newer
* Node.js 18 or newer
* npm or yarn

### Build Steps

```bash
# Clone the repository
git clone https://github.com/wasilak/secan.git
cd secan

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Build backend (includes embedded frontend)
cargo build --release

# Run
./target/release/secan
```

The compiled binary will be at `target/release/secan` (or `secan.exe` on Windows).

## Next Steps

1. Read the [Configuration guide](/1.2/1.1/1.0/configuration/authentication/) to set up authentication and clusters
2. Learn about [Features](/1.2/1.1/1.0/features/dashboard/) and what you can do with Secan
3. Check out [Cluster Details](/1.2/1.1/1.0/features/cluster-details/) to understand the interface
