# Secan

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GitHub](https://img.shields.io/badge/GitHub-wasilak/secan-blue?logo=github)](https://github.com/wasilak/secan)

**Secan** (Old English: *sēcan* - to seek, to inquire)

A modern, lightweight Elasticsearch cluster management tool built with Rust and React. Manage multiple Elasticsearch clusters from a unified, responsive web interface with real-time monitoring, index management, interactive shard visualization, and REST console.

Heavily inspired by [Cerebro](https://github.com/lmenezes/cerebro).

## Quick Start

**📖 See full documentation at [https://wasilak.github.io/secan/](https://wasilak.github.io/secan/)**

### Installation

```bash
# Download the latest release
# https://github.com/wasilak/secan/releases

# Extract and run
./secan
```

Visit http://localhost:9000

## Key Features

- **Cluster Management**: Monitor multiple Elasticsearch clusters from one dashboard
- **Index Management**: Create, delete, and configure indices
- **Shard Visualization**: Interactive grid-based shard allocation and relocation
- **REST Console**: Execute queries directly from the UI
- **Authentication**: Open mode, local users, or OIDC support
- **Single Binary**: No dependencies, easy deployment
- **Multi-Platform**: Linux, macOS, Windows (amd64/arm64)

## Documentation

Complete documentation including installation, configuration, deployment, and development guides available at:

**[https://wasilak.github.io/secan/](https://wasilak.github.io/secan/)**

## Development

### Prerequisites

- Rust 1.70+ (for backend)
- Node.js 18+ (for frontend and documentation)
- Just command runner (optional, but recommended)

### Quick Start

```bash
# View available build tasks
just --list

# Common development tasks
just dev              # Run development servers (backend + frontend)
just test             # Run all tests
just lint             # Run all linters
```

### Documentation

The documentation is built with [Docusaurus](https://docusaurus.io/):

```bash
# Development server (serves at http://localhost:3000/secan/)
just docs-dev

# Build documentation
just docs-build

# Build complete documentation (Docusaurus + Rust API docs)
just docs-build-complete

# Preview production build
just docs-preview
```

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linters (`just test && just lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

For documentation changes:
- Documentation source files are in `docs/docs/`
- Run `just docs-dev` to preview changes locally
- Ensure all links work and images display correctly

## License

GNU General Public License v3.0 - see [LICENSE](./LICENSE) for details.

## Acknowledgments

Heavily inspired by [Cerebro](https://github.com/lmenezes/cerebro), the original Elasticsearch web admin tool.
