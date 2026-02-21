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
    cd frontend && npm run build

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
    cargo clippy
    cargo fmt --check

[group('lint')]
lint-frontend:
    # Run TypeScript/React linter
    cd frontend && npm run lint

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
    # Build Docker image for amd64
    docker build --platform linux/amd64 -t secan:latest .

[group('docker')]
docker-build-multiarch:
    # Build Docker image for multiple architectures
    docker buildx build --platform linux/amd64,linux/arm64 -t secan:latest .

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
    # Bump version and create git tag (usage: just version-bump v0.2.0)
    ./scripts/bump-version.sh {{TAG}}

[group('docs')]
docs-dev:
    # Start documentation development server
    cd docs && npm run dev

[group('docs')]
docs-build:
    # Build documentation for production
    cd docs && npm ci && npm run build

[group('docs')]
docs-preview:
    # Preview production documentation build
    cd docs && npm run preview

[group('docs')]
docs-rust-api:
    # Generate Rust API documentation
    cargo doc --no-deps --release

[group('docs')]
docs-integrate-api:
    # Integrate Rust API docs into Starlight output
    mkdir -p docs/dist/api
    cp -r target/doc/secan/* docs/dist/api/

[group('docs')]
docs-build-complete: docs-rust-api docs-build docs-integrate-api
    # Build complete documentation site (Starlight + Rust API)
