# Release Process

This document describes the release process for Cerebro.

## Overview

Cerebro uses GitHub Actions for automated cross-platform builds and releases. When a version tag is pushed, the CI/CD pipeline automatically:

1. Builds binaries for all supported platforms
2. Runs tests on all platforms
3. Creates a GitHub release with release notes
4. Uploads binary artifacts
5. Builds and pushes Docker images

## Supported Platforms

### Binary Releases
- **Linux x86_64** (`x86_64-unknown-linux-gnu`)
- **Linux ARM64** (`aarch64-unknown-linux-gnu`)
- **macOS x86_64** (`x86_64-apple-darwin`)
- **macOS ARM64** (`aarch64-apple-darwin`) - Apple Silicon
- **Windows x86_64** (`x86_64-pc-windows-msvc`)

### Docker Images
- **linux/amd64**
- **linux/arm64**

## Creating a Release

### Prerequisites

1. Ensure you're on the `main` or `master` branch
2. Ensure all changes are committed
3. Ensure all tests pass locally:
   ```bash
   # Backend tests
   cd backend && cargo test --all-features
   
   # Frontend tests
   cd frontend && npm test
   ```

### Automated Release (Recommended)

Use the provided release script:

```bash
./scripts/create-release.sh v0.1.0
```

This script will:
1. Validate the version format
2. Check for uncommitted changes
3. Update version numbers in `Cargo.toml` and `package.json`
4. Commit the version changes
5. Create a git tag
6. Provide instructions for pushing

Then push the changes:
```bash
git push origin main && git push origin v0.1.0
```

### Manual Release

1. **Update version numbers**:
   ```bash
   # Update backend/Cargo.toml
   version = "0.1.0"
   
   # Update frontend/package.json
   "version": "0.1.0"
   ```

2. **Commit version changes**:
   ```bash
   git add backend/Cargo.toml frontend/package.json
   git commit -m "chore: bump version to v0.1.0"
   ```

3. **Create and push tag**:
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin main
   git push origin v0.1.0
   ```

## Version Numbering

Cerebro follows [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `v1.2.3`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Pre-release Versions

For pre-release versions, append a suffix:
- **Alpha**: `v0.1.0-alpha.1`
- **Beta**: `v0.1.0-beta.1`
- **Release Candidate**: `v0.1.0-rc.1`

Pre-release versions are automatically marked as "pre-release" on GitHub.

## Release Workflow

### 1. Trigger

The release workflow is triggered when:
- A tag matching `v*.*.*` is pushed
- Manual workflow dispatch (for re-running releases)

### 2. Build Process

For each platform:
1. Checkout code
2. Install Rust toolchain with target
3. Build frontend assets
4. Build backend binary (using `cross` for ARM64 Linux)
5. Create compressed archive (`.tar.gz` for Unix, `.zip` for Windows)
6. Generate SHA256 checksum

### 3. Release Creation

1. Generate release notes from git commits
2. Create GitHub release
3. Upload binary artifacts
4. Build and push multi-platform Docker images

### 4. Docker Images

Docker images are pushed to GitHub Container Registry:
```
ghcr.io/<owner>/<repo>:v0.1.0
ghcr.io/<owner>/<repo>:0.1
ghcr.io/<owner>/<repo>:0
ghcr.io/<owner>/<repo>:latest
```

## Release Notes

Release notes are automatically generated from git commits between tags. The format includes:

- **Changes**: List of commits since last release
- **Downloads**: Links to binary artifacts
- **Installation**: Instructions for binary and Docker installation
- **Configuration**: Link to configuration documentation

### Improving Release Notes

For better release notes, use conventional commit messages:
```
feat: add cluster health monitoring
fix: resolve session timeout issue
docs: update configuration examples
chore: bump dependencies
```

## Testing Releases

### Testing Binaries

After release, test each binary:

```bash
# Linux/macOS
./cerebro-linux-x86_64 --version
./cerebro-linux-x86_64 --help

# Windows
cerebro-windows-x86_64.exe --version
cerebro-windows-x86_64.exe --help
```

### Testing Docker Images

```bash
# Pull and test
docker pull ghcr.io/<owner>/<repo>:v0.1.0
docker run --rm ghcr.io/<owner>/<repo>:v0.1.0 --version

# Run with configuration
docker run -p 9000:9000 \
  -v $(pwd)/config.yaml:/config.yaml \
  -e CEREBRO_CONFIG=/config.yaml \
  ghcr.io/<owner>/<repo>:v0.1.0
```

## Rollback

If a release has issues:

1. **Delete the tag locally and remotely**:
   ```bash
   git tag -d v0.1.0
   git push origin :refs/tags/v0.1.0
   ```

2. **Delete the GitHub release**:
   - Go to GitHub Releases
   - Click "Delete" on the problematic release

3. **Fix the issues and create a new release**:
   ```bash
   # Fix issues, commit changes
   ./scripts/create-release.sh v0.1.1
   git push origin main && git push origin v0.1.1
   ```

## Hotfix Releases

For urgent fixes:

1. Create a hotfix branch from the release tag:
   ```bash
   git checkout -b hotfix/v0.1.1 v0.1.0
   ```

2. Make and commit the fix:
   ```bash
   git commit -m "fix: critical security issue"
   ```

3. Create the hotfix release:
   ```bash
   ./scripts/create-release.sh v0.1.1
   git push origin hotfix/v0.1.1
   git push origin v0.1.1
   ```

4. Merge back to main:
   ```bash
   git checkout main
   git merge hotfix/v0.1.1
   git push origin main
   ```

## Troubleshooting

### Build Failures

If builds fail:
1. Check GitHub Actions logs
2. Test locally with the same Rust version
3. Ensure all dependencies are available
4. Check for platform-specific issues

### Cross-compilation Issues

For ARM64 Linux builds using `cross`:
- Ensure Docker is available on the runner
- Check `cross` compatibility with dependencies
- Consider using native ARM64 runners if issues persist

### Docker Build Failures

If Docker builds fail:
1. Test locally: `docker build -t cerebro:test .`
2. Check Dockerfile syntax
3. Ensure frontend assets are built
4. Verify base image availability

## CI/CD Configuration

### Required Secrets

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Optional Secrets

For private registries or additional features:
- Docker Hub credentials (if pushing to Docker Hub)
- Signing keys (for binary signing)

## Best Practices

1. **Test before releasing**: Always run full test suite
2. **Use semantic versioning**: Follow semver strictly
3. **Write good commit messages**: They become release notes
4. **Test release artifacts**: Download and test each binary
5. **Document breaking changes**: Clearly note in release notes
6. **Keep changelog**: Maintain CHANGES.md for major changes
7. **Announce releases**: Notify users of new releases

## Release Checklist

Before creating a release:

- [ ] All tests pass locally
- [ ] Documentation is up to date
- [ ] CHANGES.md is updated (for major releases)
- [ ] Version numbers are correct
- [ ] No uncommitted changes
- [ ] On correct branch (main/master)

After creating a release:

- [ ] Verify all binaries built successfully
- [ ] Test at least one binary per platform
- [ ] Verify Docker images are available
- [ ] Check release notes are accurate
- [ ] Announce release (if applicable)

## Support

For issues with the release process:
1. Check GitHub Actions logs
2. Review this documentation
3. Open an issue on GitHub
