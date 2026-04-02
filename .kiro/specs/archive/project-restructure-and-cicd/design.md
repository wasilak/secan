# Design Document: Project Restructure and CI/CD

## Overview

This design document outlines the technical approach for restructuring the Secan project and implementing comprehensive CI/CD automation using GitHub Actions. The restructuring will modernize the project layout to follow Rust conventions, consolidate documentation, and change the license to GPL v3. The CI/CD implementation will automate building, testing, and releasing across multiple platforms and architectures.

### Goals

1. Restructure project to follow standard Rust conventions (code at root)
2. Consolidate documentation into a single README.md
3. Change license from MIT to GPL v3
4. Implement automated CI/CD with GitHub Actions
5. Build and publish multi-architecture Docker images
6. Build and release cross-platform binaries
7. Automate testing and quality checks

### Non-Goals

- Changing the application's functionality or features
- Modifying the frontend or backend architecture
- Changing the build system (cargo/npm remain the same)
- Implementing new deployment platforms beyond Docker and binaries

## Architecture

### Project Structure (Before)

```
secan/
├── backend/
│   ├── src/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── config.yaml
│   ├── examples/
│   └── docs/
├── frontend/
│   ├── src/
│   └── package.json
├── README.md
├── API.md
├── CONFIGURATION.md
├── CONTRIBUTING.md
├── DOCKER.md
├── SHARD_RELOCATION.md
├── LICENSE (MIT)
└── Dockerfile
```

### Project Structure (After)

```
secan/
├── src/              # Rust source (moved from backend/src)
├── frontend/
│   ├── src/
│   └── package.json
├── Cargo.toml        # Moved from backend/
├── Cargo.lock        # Moved from backend/
├── config.example.yaml  # Moved from backend/config.yaml
├── README.md         # Consolidated documentation
├── LICENSE           # GPL v3
├── Dockerfile        # Updated paths
└── .github/
    └── workflows/
        ├── ci.yml
        ├── release.yml
        └── docker.yml
```

### CI/CD Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                                                              │
│  Push to main ──────────────┐                               │
│  Push tag v*.*.* ───────────┼──────────────┐                │
│                             │              │                │
└─────────────────────────────┼──────────────┼────────────────┘
                              │              │
                              ▼              ▼
                    ┌──────────────┐  ┌──────────────┐
                    │  CI Workflow │  │   Release    │
                    │              │  │   Workflow   │
                    │ - Run tests  │  │              │
                    │ - Lint       │  │ - Build bins │
                    │ - Format     │  │ - Build imgs │
                    │              │  │ - Create rel │
                    └──────────────┘  └──────┬───────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                         ▼                   ▼                   ▼
                  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                  │   GitHub    │    │    GHCR     │    │   GitHub    │
                  │  Artifacts  │    │   Docker    │    │   Release   │
                  │             │    │   Images    │    │             │
                  │ - Binaries  │    │ - amd64     │    │ - Notes     │
                  │ - Checksums │    │ - arm64     │    │ - Assets    │
                  └─────────────┘    └─────────────┘    └─────────────┘
```

## Components and Interfaces

### Component 1: Project Restructuring Script

**Purpose:** Automate the file and directory reorganization.

**Responsibilities:**
- Move Rust code from backend/ to root
- Move configuration files
- Update path references in code
- Remove obsolete directories

**Interface:**
- Input: Current project structure
- Output: Restructured project with updated paths
- Execution: Manual script or step-by-step instructions

**Implementation Notes:**
- Use git mv to preserve history
- Update all hardcoded paths in source code
- Update rust-embed asset paths
- Update documentation references

### Component 2: Documentation Consolidation

**Purpose:** Merge multiple documentation files into a single comprehensive README.

**Responsibilities:**
- Extract essential content from each doc file
- Organize content logically in README
- Maintain clarity and readability
- Add table of contents

**Interface:**
- Input: API.md, CONFIGURATION.md, CONTRIBUTING.md, DOCKER.md, SHARD_RELOCATION.md
- Output: Enhanced README.md
- Removed: Original documentation files

**Content Mapping:**
- API.md → README: Brief API overview with link to full docs (if needed)
- CONFIGURATION.md → README: Quick start configuration examples
- CONTRIBUTING.md → README: Brief contribution guidelines
- DOCKER.md → README: Docker quick start
- SHARD_RELOCATION.md → README: Feature overview

### Component 3: CI Workflow (ci.yml)

**Purpose:** Run tests and quality checks on every push.

**Responsibilities:**
- Run backend tests (cargo test)
- Run backend linting (cargo clippy)
- Run backend formatting check (cargo fmt --check)
- Run frontend tests (npm test)
- Run frontend linting (npm run lint)
- Cache dependencies for faster builds

**Triggers:**
- Push to any branch
- Pull request to main

**Jobs:**
1. **backend-test**: Test Rust code
2. **frontend-test**: Test TypeScript/React code
3. **lint**: Run all linters

**Caching Strategy:**
- Cache cargo registry and target/
- Cache node_modules/

### Component 4: Docker Build Workflow (docker.yml)

**Purpose:** Build and publish multi-architecture Docker images.

**Responsibilities:**
- Build frontend assets
- Build Docker images for amd64 and arm64
- Push images to GitHub Container Registry
- Tag images with version and "latest"

**Triggers:**
- Push to main branch
- Push tag v*.*.*

**Build Process:**
1. Set up Docker Buildx for multi-arch
2. Build frontend (npm run build)
3. Build Docker image with embedded frontend
4. Push to ghcr.io with appropriate tags

**Image Tags:**
- `ghcr.io/[owner]/secan:latest` (main branch)
- `ghcr.io/[owner]/secan:v1.0.0` (version tag)
- `ghcr.io/[owner]/secan:sha-abc123` (commit SHA)

### Component 5: Release Workflow (release.yml)

**Purpose:** Build cross-platform binaries and create GitHub releases.

**Responsibilities:**
- Build binaries for all supported platforms
- Generate checksums for binaries
- Create GitHub release
- Attach binaries to release
- Generate release notes

**Triggers:**
- Push tag matching v*.*.*

**Build Matrix:**
| Platform | Architecture | Target Triple |
|----------|-------------|---------------|
| Linux | amd64 | x86_64-unknown-linux-musl |
| Linux | arm64 | aarch64-unknown-linux-musl |
| macOS | amd64 | x86_64-apple-darwin |
| macOS | arm64 | aarch64-apple-darwin |
| Windows | amd64 | x86_64-pc-windows-msvc |

**Build Process:**
1. Build frontend assets once
2. For each target platform:
   - Set up cross-compilation toolchain
   - Build Rust binary with embedded frontend
   - Strip and compress binary
   - Generate SHA256 checksum
3. Create GitHub release
4. Upload all binaries and checksums

### Component 6: License Update

**Purpose:** Change project license from MIT to GPL v3.

**Responsibilities:**
- Replace LICENSE file content
- Update package metadata
- Add license headers to source files
- Update documentation

**Files to Update:**
- LICENSE (full GPL v3 text)
- Cargo.toml (license field)
- frontend/package.json (license field)
- README.md (license section)
- Source files (optional headers)

### Component 7: Configuration Management

**Purpose:** Provide example configuration and prevent sensitive data commits.

**Responsibilities:**
- Rename config.yaml to config.example.yaml
- Update .gitignore
- Update application config loading logic
- Document configuration setup

**Configuration Loading Priority:**
1. Command-line argument: --config path/to/config.yaml
2. Environment variable: SECAN_CONFIG_PATH
3. Current directory: ./config.yaml
4. User config: ~/.config/secan/config.yaml
5. System config: /etc/secan/config.yaml

### Component 8: Dockerfile Updates

**Purpose:** Update Dockerfile to work with new project structure.

**Changes Required:**
- Update COPY paths (backend/ → root)
- Update WORKDIR paths
- Optimize layer caching
- Ensure multi-arch compatibility

**Dockerfile Structure:**
```dockerfile
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM rust:alpine AS backend-builder
RUN apk add --no-cache musl-dev openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
COPY --from=frontend-builder /app/frontend/dist ./assets/assets
RUN cargo build --release

# Stage 3: Runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
RUN addgroup -g 1000 secan && adduser -D -u 1000 -G secan secan
WORKDIR /app
COPY --from=backend-builder /app/target/release/secan /app/secan
USER secan
EXPOSE 9000
CMD ["/app/secan"]
```

## Data Models

### GitHub Actions Workflow Configuration

**CI Workflow (ci.yml):**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rust-lang/setup-rust-toolchain@v1
      - uses: Swatinem/rust-cache@v2
      - run: cargo test --all-features
      - run: cargo clippy -- -D warnings
      - run: cargo fmt --check

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm test
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
```

**Docker Workflow (docker.yml):**
```yaml
name: Docker Build
on:
  push:
    branches: [main]
    tags: ['v*.*.*']

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Release Workflow (release.yml):**
```yaml
name: Release
on:
  push:
    tags: ['v*.*.*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: x86_64-unknown-linux-musl
            name: linux-amd64
          - os: ubuntu-latest
            target: aarch64-unknown-linux-musl
            name: linux-arm64
          - os: macos-latest
            target: x86_64-apple-darwin
            name: macos-amd64
          - os: macos-latest
            target: aarch64-apple-darwin
            name: macos-arm64
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            name: windows-amd64
    
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Install Rust
        uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          target: ${{ matrix.target }}
      
      - name: Build binary
        run: cargo build --release --target ${{ matrix.target }}
      
      - name: Package binary
        run: |
          cd target/${{ matrix.target }}/release
          tar czf secan-${{ matrix.name }}.tar.gz secan
          sha256sum secan-${{ matrix.name }}.tar.gz > secan-${{ matrix.name }}.tar.gz.sha256
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: secan-${{ matrix.name }}
          path: target/${{ matrix.target }}/release/secan-${{ matrix.name }}.*
  
  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Download artifacts
        uses: actions/download-artifact@v4
      
      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            secan-*/secan-*
          generate_release_notes: true
```

### Git Ignore Configuration

**.gitignore additions:**
```
# Kiro specs
.kiro/

# Configuration (keep example tracked)
config.yaml

# Rust build artifacts
/target/
Cargo.lock

# Frontend build artifacts
frontend/dist/
frontend/node_modules/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
```

### License File (GPL v3)

The LICENSE file will contain the full text of the GNU General Public License version 3.0. The file will be approximately 35KB and include:
- Preamble explaining copyleft principles
- Terms and conditions for copying, distribution, and modification
- How to apply the license to your programs

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Project Structure Consistency

*For any* file path reference in the codebase after restructuring, the referenced file should exist at the specified location and the application should build successfully.

**Validates: Requirements 3.4, 3.7, 3.9**

### Property 2: Documentation Completeness

*For any* essential information in the removed documentation files (API.md, CONFIGURATION.md, CONTRIBUTING.md, DOCKER.md, SHARD_RELOCATION.md), that information should be present in the consolidated README.md in some form.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 3: CI Test Coverage

*For any* code push to the repository, all automated tests (backend and frontend) should run and must pass before any build or deployment proceeds.

**Validates: Requirements 1.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

### Property 4: Multi-Architecture Docker Build

*For any* Docker image published to GHCR, the image should support both amd64 and arm64 architectures and users should be able to pull the correct architecture automatically.

**Validates: Requirements 1.2, 7.4, 9.4, 9.7**

### Property 5: Cross-Platform Binary Completeness

*For any* release created, binaries should be generated for all five target platforms (Linux amd64/arm64, macOS amd64/arm64, Windows amd64) and all binaries should be attached to the GitHub release.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.9**

### Property 6: Frontend Asset Embedding

*For any* binary or Docker image built, the frontend assets should be embedded correctly and the application should serve the frontend UI when accessed via HTTP.

**Validates: Requirements 1.6, 7.8, 8.6**

### Property 7: Configuration File Safety

*For any* developer cloning the repository, config.yaml should not be tracked in git (preventing accidental commits of sensitive data) while config.example.yaml should be tracked and available.

**Validates: Requirements 4.2, 4.3, 6.2, 6.3**

### Property 8: License Consistency

*For all* license-related files and metadata (LICENSE, Cargo.toml, package.json, README.md), they should consistently indicate GPL v3 as the project license.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: Semantic Version Tagging

*For any* git tag pushed that matches the pattern v*.*.*, the CI/CD system should trigger a release workflow that creates a GitHub release with the same version number.

**Validates: Requirements 1.3, 1.8, 11.1, 11.3**

### Property 10: Docker Image Tagging Consistency

*For any* Docker image pushed to GHCR, if it's built from a version tag, the image should be tagged with both the version number and "latest", and both tags should point to the same image digest.

**Validates: Requirements 9.2, 9.3**

### Property 11: Build Artifact Integrity

*For any* binary released, a SHA256 checksum file should be generated and included in the release, allowing users to verify the binary's integrity.

**Validates: Requirements 11.6**

### Property 12: Workflow Permission Minimization

*For any* GitHub Actions workflow, the workflow should only request the minimum permissions necessary to complete its tasks (e.g., read-only for CI, write for releases).

**Validates: Requirements 12.6**

## Error Handling

### Restructuring Errors

**File Move Failures:**
- Error: File or directory doesn't exist at source path
- Handling: Verify source path, check for typos, ensure file wasn't already moved
- Recovery: Manual verification and correction

**Path Reference Updates:**
- Error: Missed path reference causing build failure
- Handling: Search codebase for hardcoded paths, use grep/ripgrep
- Recovery: Update missed references, rebuild, test

**Git History Issues:**
- Error: Git history not preserved during move
- Handling: Use `git mv` instead of regular `mv`
- Recovery: If history lost, document in commit message

### CI/CD Errors

**Test Failures:**
- Error: Tests fail during CI run
- Handling: Workflow fails immediately, no deployment proceeds
- Recovery: Fix failing tests, push fix, CI re-runs automatically

**Build Failures:**
- Error: Compilation error during binary or Docker build
- Handling: Workflow fails with error output
- Recovery: Fix compilation error, push fix, workflow re-runs

**Cross-Compilation Failures:**
- Error: Target platform build fails
- Handling: Specific job fails, other platforms continue
- Recovery: Install missing dependencies, update toolchain, retry

**Docker Push Failures:**
- Error: Authentication failure or network issue
- Handling: Workflow fails, images not published
- Recovery: Check GITHUB_TOKEN permissions, retry workflow

**Release Creation Failures:**
- Error: GitHub API error or permission issue
- Handling: Workflow fails, release not created
- Recovery: Check repository permissions, retry with corrected settings

### Documentation Errors

**Missing Content:**
- Error: Essential information not migrated to README
- Handling: User reports missing documentation
- Recovery: Add missing content to README, update

**Broken Links:**
- Error: Internal links broken after restructuring
- Handling: 404 errors or broken references
- Recovery: Update links to reflect new structure

### Configuration Errors

**Missing config.yaml:**
- Error: Application can't find configuration file
- Handling: Application logs error and exits with helpful message
- Recovery: Copy config.example.yaml to config.yaml, customize

**Invalid Configuration:**
- Error: YAML syntax error or invalid values
- Handling: Application fails to start with validation error
- Recovery: Fix configuration syntax, validate against schema

### License Errors

**Incompatible Dependencies:**
- Error: Dependency license incompatible with GPL v3
- Handling: Legal review required
- Recovery: Replace dependency or seek legal advice

## Testing Strategy

### Manual Testing

**Project Restructuring:**
1. Verify all files moved to correct locations
2. Verify no broken path references
3. Build backend from root: `cargo build --release`
4. Build frontend: `cd frontend && npm run build`
5. Run application and verify it starts correctly
6. Access UI and verify frontend loads
7. Test basic functionality (connect to cluster, view data)

**Documentation:**
1. Read through consolidated README.md
2. Verify all essential information is present
3. Test all code examples and commands
4. Verify links work correctly
5. Check for clarity and organization

**CI/CD Workflows:**
1. Push to feature branch, verify CI runs
2. Create PR, verify CI runs on PR
3. Push tag v0.0.1-test, verify release workflow runs
4. Verify Docker images appear in GHCR
5. Verify binaries attached to GitHub release
6. Download and test binaries on each platform
7. Pull and run Docker images on amd64 and arm64

**Configuration:**
1. Clone fresh repository
2. Verify config.yaml is not present
3. Verify config.example.yaml is present
4. Copy config.example.yaml to config.yaml
5. Customize configuration
6. Run application with custom config
7. Verify git status doesn't show config.yaml

### Automated Testing

**Unit Tests:**
- Existing backend tests: `cargo test`
- Existing frontend tests: `npm test`
- No new unit tests required (no functionality changes)

**Integration Tests:**
- CI workflow tests: Triggered automatically on push
- Docker build tests: Triggered automatically on push/tag
- Release workflow tests: Triggered on version tag push

**Property-Based Tests:**

Not applicable for this restructuring project. The changes are primarily organizational and infrastructure-related rather than algorithmic. Manual verification and CI automation provide sufficient coverage.

### Test Execution

**Local Development:**
```bash
# Test backend
cargo test
cargo clippy
cargo fmt --check

# Test frontend
cd frontend
npm test
npm run lint

# Test full build
cargo build --release
cd frontend && npm run build
```

**CI Environment:**
- Automated on every push
- Runs in parallel (backend and frontend)
- Caches dependencies for speed
- Fails fast on first error

**Release Testing:**
- Automated on version tag push
- Builds all platforms in parallel
- Generates checksums automatically
- Creates release with all artifacts

### Testing Checklist

**Before Restructuring:**
- [ ] Backup current working state
- [ ] Document current file locations
- [ ] Verify all tests pass in current structure

**During Restructuring:**
- [ ] Move files using git mv
- [ ] Update path references incrementally
- [ ] Test build after each major change
- [ ] Commit frequently with clear messages

**After Restructuring:**
- [ ] Full build test (backend and frontend)
- [ ] Run all tests
- [ ] Verify application starts and runs
- [ ] Test UI functionality
- [ ] Verify documentation accuracy

**CI/CD Verification:**
- [ ] Push to test branch, verify CI runs
- [ ] Create test PR, verify CI runs
- [ ] Push test tag, verify release workflow
- [ ] Verify Docker images published
- [ ] Download and test binaries
- [ ] Pull and run Docker images

**Final Verification:**
- [ ] All tests passing
- [ ] Documentation complete and accurate
- [ ] CI/CD workflows functioning
- [ ] Binaries working on all platforms
- [ ] Docker images working on both architectures
- [ ] License updated everywhere
- [ ] Configuration management working
