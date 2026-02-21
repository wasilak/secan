# GitHub Actions Workflows

This directory contains the CI/CD workflows for Cerebro.

## Workflows

### build.yml - Continuous Integration

**Triggers:**
- Push to `main`, `master`, or `develop` branches
- Pull requests to `main`, `master`, or `develop` branches
- Manual workflow dispatch

**Jobs:**

1. **test** - Run tests on all platforms
   - Runs on: Ubuntu, macOS, Windows
   - Steps:
     - Checkout code
     - Install Rust toolchain with rustfmt and clippy
     - Cache cargo dependencies
     - Install Node.js and frontend dependencies
     - Build frontend
     - Run frontend tests and linter
     - Check Rust formatting
     - Run Clippy (with warnings as errors)
     - Build backend in release mode
     - Run backend tests with all features

2. **build** - Build release binaries
   - Depends on: test job passing
   - Builds for all supported platforms:
     - Linux x86_64 (native)
     - Linux ARM64 (cross-compilation)
     - macOS x86_64 (native)
     - macOS ARM64 (native)
     - Windows x86_64 (native)
   - Uploads artifacts for each platform

3. **docker** - Build Docker image
   - Depends on: test job passing
   - Builds Docker image using Buildx
   - Uses GitHub Actions cache for layers
   - Tests the built image

### release.yml - Release Automation

**Triggers:**
- Push of tags matching `v*.*.*` (e.g., `v0.1.0`)
- Manual workflow dispatch with tag input

**Jobs:**

1. **create-release** - Create GitHub Release
   - Extracts version from tag
   - Generates release notes from git commits
   - Creates GitHub release with:
     - Changelog since last tag
     - Download links for all platforms
     - Installation instructions
     - Configuration documentation link
   - Marks pre-release for alpha/beta/rc versions

2. **build-release** - Build and upload binaries
   - Depends on: create-release job
   - Builds for all platforms (same as build.yml)
   - Creates compressed archives:
     - `.tar.gz` for Unix/macOS
     - `.zip` for Windows
   - Generates SHA256 checksums
   - Uploads to GitHub release

3. **docker-release** - Build and push Docker images
   - Depends on: create-release job
   - Builds multi-platform images (linux/amd64, linux/arm64)
   - Pushes to GitHub Container Registry (ghcr.io)
   - Tags with:
     - Full version (e.g., `v0.1.0`)
     - Major.minor (e.g., `0.1`)
     - Major (e.g., `0`)
     - `latest`

## Caching Strategy

All workflows use GitHub Actions cache for:
- Cargo registry
- Cargo git index
- Cargo build artifacts
- npm dependencies

This significantly speeds up builds by reusing dependencies.

## Cross-Compilation

Linux ARM64 builds use [cross](https://github.com/cross-rs/cross) for cross-compilation, which provides a Docker-based environment with the necessary toolchain.

## Secrets Required

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
  - Used for creating releases
  - Used for pushing to GitHub Container Registry

## Testing Workflows Locally

### Using act

You can test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash  # Linux

# Run the build workflow
act push -W .github/workflows/build.yml

# Run a specific job
act -j test
```

### Manual Testing

Test the build process manually:

```bash
# Backend
cd backend
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
cargo test --all-features

# Frontend
cd frontend
npm ci
npm run lint
npm run build
npm test
```

## Troubleshooting

### Build Failures

1. **Rust compilation errors**: Check Cargo.toml dependencies and Rust version
2. **Frontend build errors**: Check package.json dependencies and Node version
3. **Cross-compilation errors**: Check cross compatibility with dependencies

### Release Failures

1. **Tag format**: Ensure tag matches `v*.*.*` pattern
2. **Permissions**: Ensure GITHUB_TOKEN has necessary permissions
3. **Duplicate release**: Delete existing release/tag before retrying

### Docker Failures

1. **Build context**: Ensure Dockerfile is in repository root
2. **Frontend assets**: Ensure frontend builds before Docker build
3. **Registry auth**: Check GITHUB_TOKEN permissions for packages

## Best Practices

1. **Always run tests locally** before pushing
2. **Use conventional commits** for better release notes
3. **Test on multiple platforms** when possible
4. **Keep dependencies updated** for security
5. **Monitor workflow runs** for failures
6. **Review release notes** before publishing

## Maintenance

### Updating Rust Version

Update the Rust toolchain in both workflows:
```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    toolchain: stable  # or specific version like "1.75.0"
```

### Updating Node Version

Update Node.js version in both workflows:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '25'  # or other LTS version
```

### Adding New Platforms

To add a new platform:
1. Add to the matrix in both `build.yml` and `release.yml`
2. Specify the target triple
3. Set `use_cross: true` if cross-compilation is needed
4. Update release notes template

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Rust GitHub Actions](https://github.com/actions-rs)
- [cross - Cross-compilation tool](https://github.com/cross-rs/cross)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)
