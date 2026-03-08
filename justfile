# Secan project justfile
# Run `just` to see all available recipes

# Show all available recipes and groups
@default:
    just --list

[group('dev')]
dev: frontend-build backend-build backend-run
    # Build frontend, build backend, and run the server

[group('dev')]
full-dev: docker-up
    # Start Elasticsearch, bootstrap data, and run dev server
    sleep 5
    @just data-bootstrap
    @just dev

[group('frontend')]
frontend-build:
    # Build the frontend React application
    cd frontend && npm ci && npm run build

[group('backend')]
backend-build:
    # Build the Rust backend
    cargo build

[group('backend')]
backend-run:
    # Run the backend server
    cargo run

[group('build')]
clean:
    # Clean all build artifacts
    rm -rf frontend/node_modules
    rm -rf frontend/dist
    rm -rf target
    rm -rf assets

[group('test')]
test: test-backend test-frontend
    # Run all tests

[group('test')]
test-backend:
    # Run backend tests
    cargo test

[group('test')]
test-frontend:
    # Run frontend tests
    cd frontend && npm test

[group('lint')]
lint: lint-backend lint-frontend
    # Run all linters

[group('lint')]
lint-backend:
    # Run Rust linter
    # Use -- -D warnings to match CI/CD strictness (catches dead_code, unused imports, etc.)
    cargo clippy -- -D warnings
    cargo fmt --check

[group('lint')]
lint-frontend:
    # Run TypeScript/React linter
    cd frontend && npm run lint

[group('ci')]
ci: ci-backend ci-frontend
    # Run complete CI/CD pipeline for backend and frontend

[group('ci')]
ci-backend:
    # Run complete backend CI/CD checks
    echo "=== BACKEND CI/CD ==="
    echo "1. Cargo fmt check..."
    cargo fmt --check
    echo "✅ PASSED"
    echo ""
    echo "2. Cargo clippy..."
    cargo clippy -- -D warnings
    echo "✅ PASSED"
    echo ""
    echo "3. Cargo test..."
    cargo test
    echo "✅ PASSED"
    echo ""
    echo "=== BACKEND CI/CD COMPLETE ==="

[group('ci')]
ci-frontend:
    # Run complete frontend CI/CD checks
    echo "=== FRONTEND CI/CD ==="
    echo "4. NPM lint..."
    cd frontend && npm run lint
    echo "✅ PASSED"
    echo ""
    echo "5. NPM test..."
    cd frontend && npm test
    echo "✅ PASSED"
    echo ""
    echo "6. NPM build..."
    cd frontend && npm run build
    echo "✅ PASSED"
    echo ""
    echo "=== FRONTEND CI/CD COMPLETE ==="

[group('format')]
format:
    # Format all code
    cargo fmt --all
    cd frontend && npx prettier --write src/

[group('data')]
data-bootstrap:
    # Bootstrap test data in Elasticsearch
    ./scripts/bootstrap-test-data.sh

[group('data')]
data-cleanup:
    # Clean up test data from Elasticsearch
    ./scripts/cleanup-test-data.sh

[group('docker')]
docker-up:
    # Start Elasticsearch with Docker Compose
    docker-compose up -d

[group('docker')]
docker-down:
    # Stop Elasticsearch
    docker-compose down

[group('docker')]
docker-build-amd64:
    # Build Docker image for amd64 (uses version from Cargo.toml)
    #!/bin/bash
    VERSION=$(grep '^version = ' Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
    docker build --platform linux/amd64 -t secan:$VERSION -t secan:latest .

[group('docker')]
docker-build-multiarch:
    # Build Docker image for multiple architectures (uses version from Cargo.toml)
    #!/bin/bash
    VERSION=$(grep '^version = ' Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
    docker buildx build --platform linux/amd64,linux/arm64 -t secan:$VERSION -t secan:latest .

[group('release')]
release-frontend:
    # Build frontend for release
    cd frontend && npm ci && npm run build

[group('release')]
release-backend:
    # Build backend for release
    cargo build --release

[group('release')]
release-backend-target:
    # Build backend for specific target (set TARGET env var)
    cargo build --release --target $TARGET

[group('cross-compile')]
cross-install:
    # Install cross-compilation tool
    cargo install cross --git https://github.com/cross-rs/cross

[group('cross-compile')]
cross-build:
    # Build backend using cross for specific target (set TARGET env var)
    cross build --release --target $TARGET

[group('release')]
pkg-binary:
    # Package binary as tarball (set TARGET and NAME env vars)
    mkdir -p artifacts
    cd target/$TARGET/release && tar czf ../../artifacts/secan-$NAME.tar.gz secan && sha256sum secan-$NAME.tar.gz > ../../artifacts/secan-$NAME.tar.gz.sha256

[group('version')]
version-bump TAG:
    # Bump version and create git tag (usage: just version-bump 1.3.0)
    ./scripts/bump-version.sh {{TAG}}

[group('docs')]
docs-install:
    # Install Docusaurus dependencies
    cd docs && npm ci

[group('docs')]
docs-dev:
    # Start Docusaurus development server (serves at http://localhost:3000/secan/)
    cd docs && npm run start

[group('docs')]
docs-build:
    # Build Docusaurus documentation for production
    cd docs && npm run build

[group('docs')]
docs-preview:
    # Preview production Docusaurus build (serves at http://localhost:3000/secan/)
    cd docs && npm run serve

[group('docs')]
docs-rust-api:
    # Generate Rust API documentation
    cargo doc --no-deps --document-private-items

[group('docs')]
docs-build-complete: frontend-build docs-rust-api docs-build
    # Build complete documentation site (Docusaurus + Rust API)
    mkdir -p docs/build/api
    cp -r target/doc/* docs/build/api/
