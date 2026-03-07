# Requirements Document

## Introduction

This specification defines the requirements for restructuring the Secan project and implementing comprehensive CI/CD automation. Secan is a modern Elasticsearch cluster management tool built with Rust (backend) and React/TypeScript (frontend). The project currently lacks automated build and release processes, has documentation spread across multiple files, and uses a non-standard directory structure with backend code in a subdirectory.

The restructuring will modernize the project layout, consolidate documentation, change the license, and implement professional CI/CD workflows for automated builds, testing, and releases across multiple platforms and architectures.

## Glossary

- **Secan**: The Elasticsearch cluster management tool (Old English: *sēcan* - to seek, to inquire)
- **CI/CD**: Continuous Integration and Continuous Deployment automation
- **GitHub Actions**: GitHub's built-in CI/CD platform
- **GHCR**: GitHub Container Registry (ghcr.io) for hosting Docker images
- **Multi-arch**: Supporting multiple CPU architectures (amd64, arm64)
- **Cross-compilation**: Building binaries for different operating systems and architectures
- **rust-embed**: Rust crate for embedding static assets into the binary
- **Semantic Versioning**: Version numbering scheme (MAJOR.MINOR.PATCH)
- **Git Tag**: A named reference to a specific commit, used for releases
- **Binary Release**: Standalone executable file for a specific platform
- **Docker Image**: Containerized application package
- **GPL v3**: GNU General Public License version 3

## Requirements

### Requirement 1: GitHub Actions CI/CD Implementation

**User Story:** As a project maintainer, I want automated CI/CD workflows, so that builds, tests, and releases are consistent and require minimal manual intervention.

#### Acceptance Criteria

1. WHEN code is pushed to the main branch, THE CI_System SHALL run all tests (backend and frontend) before building
2. WHEN all tests pass, THE CI_System SHALL build Docker images for amd64 and arm64 architectures
3. WHEN a git tag matching semantic versioning is pushed, THE CI_System SHALL create a GitHub release with attached binaries
4. WHEN building Docker images, THE CI_System SHALL push them to GitHub Container Registry (ghcr.io)
5. WHEN building release binaries, THE CI_System SHALL create executables for Linux (amd64, arm64), macOS (amd64, arm64), and Windows (amd64)
6. WHEN building the backend, THE CI_System SHALL first build the frontend and embed the assets using rust-embed
7. WHEN a build fails, THE CI_System SHALL report the failure with clear error messages
8. THE CI_System SHALL use semantic versioning based on git tags (e.g., v1.0.0, v1.0.1)

### Requirement 2: Documentation Consolidation

**User Story:** As a user or contributor, I want all essential documentation in one place, so that I can quickly find information without navigating multiple files.

#### Acceptance Criteria

1. THE Documentation_System SHALL maintain only README.md as the primary documentation file at the repository root
2. WHEN removing API.md, THE Documentation_System SHALL extract crucial API information and add it to README.md in brief form
3. WHEN removing CONFIGURATION.md, THE Documentation_System SHALL extract essential configuration examples and add them to README.md
4. WHEN removing CONTRIBUTING.md, THE Documentation_System SHALL extract key contribution guidelines and add them to README.md
5. WHEN removing DOCKER.md, THE Documentation_System SHALL extract Docker quick start information and add it to README.md
6. WHEN removing SHARD_RELOCATION.md, THE Documentation_System SHALL extract shard relocation overview and add it to README.md
7. THE README.md SHALL include proper acknowledgments for Cerebro and other projects used
8. THE README.md SHALL include correct repository URLs and status badges
9. THE README.md SHALL be organized with clear sections and table of contents

### Requirement 3: Project Structure Reorganization

**User Story:** As a developer, I want the Rust code at the repository root, so that the project follows standard Rust conventions and tooling works correctly.

#### Acceptance Criteria

1. THE Project_Structure SHALL move all Rust source code from backend/ to the repository root
2. THE Project_Structure SHALL move Cargo.toml and Cargo.lock from backend/ to the repository root
3. THE Project_Structure SHALL keep frontend/ directory in its current location
4. THE Project_Structure SHALL update all path references in code to reflect the new structure
5. THE Project_Structure SHALL remove backend/examples/ directory
6. THE Project_Structure SHALL remove backend/docs/ directory
7. THE Project_Structure SHALL update rust-embed asset paths to reference frontend/dist
8. THE Project_Structure SHALL update all documentation references to reflect new paths
9. WHEN the restructuring is complete, THE Project_Structure SHALL ensure cargo build works from the repository root

### Requirement 4: Configuration File Management

**User Story:** As a user, I want a clear example configuration file, so that I can easily set up Secan without accidentally committing sensitive data.

#### Acceptance Criteria

1. THE Config_System SHALL move backend/config.yaml to config.example.yaml at the repository root
2. THE Config_System SHALL add config.yaml to .gitignore to prevent accidental commits
3. THE Config_System SHALL keep config.example.yaml tracked in git
4. THE Config_System SHALL update documentation to reference config.example.yaml
5. THE Config_System SHALL update the application to look for config.yaml in the repository root by default
6. WHEN a user clones the repository, THE Config_System SHALL provide clear instructions to copy config.example.yaml to config.yaml

### Requirement 5: License Change to GPL v3

**User Story:** As a project maintainer, I want to change the license to GPL v3, so that the project has stronger copyleft protections.

#### Acceptance Criteria

1. THE License_System SHALL replace the MIT license with GNU GPL v3 in the LICENSE file
2. THE License_System SHALL update Cargo.toml to reflect the GPL-3.0 license
3. THE License_System SHALL update package.json to reflect the GPL-3.0 license
4. THE License_System SHALL update README.md to indicate GPL v3 license
5. THE License_System SHALL ensure proper attribution requirements are documented in README.md
6. THE License_System SHALL add GPL v3 license headers to source files where appropriate

### Requirement 6: Git Ignore Configuration

**User Story:** As a developer, I want proper git ignore rules, so that build artifacts and sensitive files are not accidentally committed.

#### Acceptance Criteria

1. THE Git_System SHALL ensure .kiro/ folder is in .gitignore
2. THE Git_System SHALL ensure config.yaml is in .gitignore
3. THE Git_System SHALL ensure config.example.yaml is NOT in .gitignore
4. THE Git_System SHALL ensure target/ directory is in .gitignore
5. THE Git_System SHALL ensure node_modules/ directory is in .gitignore
6. THE Git_System SHALL ensure frontend/dist/ directory is in .gitignore
7. THE Git_System SHALL ensure all build artifacts are properly ignored

### Requirement 7: Dockerfile Updates for New Structure

**User Story:** As a DevOps engineer, I want the Dockerfile to work with the new project structure, so that Docker builds succeed and produce optimized images.

#### Acceptance Criteria

1. WHEN building the Docker image, THE Dockerfile SHALL reference Rust code at the repository root instead of backend/
2. WHEN building the Docker image, THE Dockerfile SHALL build the frontend first and copy assets to the correct location
3. WHEN building the Docker image, THE Dockerfile SHALL use multi-stage builds to minimize final image size
4. WHEN building the Docker image, THE Dockerfile SHALL produce images for both amd64 and arm64 architectures
5. THE Dockerfile SHALL optimize layer caching for faster rebuilds
6. THE Dockerfile SHALL run as a non-root user for security
7. THE Dockerfile SHALL include a health check endpoint
8. WHEN the Docker image runs, THE Application SHALL serve the embedded frontend assets correctly

### Requirement 8: Cross-Platform Binary Builds

**User Story:** As a user, I want pre-built binaries for my platform, so that I can run Secan without installing build tools.

#### Acceptance Criteria

1. WHEN a release is created, THE Build_System SHALL produce a Linux amd64 binary
2. WHEN a release is created, THE Build_System SHALL produce a Linux arm64 binary
3. WHEN a release is created, THE Build_System SHALL produce a macOS amd64 binary
4. WHEN a release is created, THE Build_System SHALL produce a macOS arm64 binary
5. WHEN a release is created, THE Build_System SHALL produce a Windows amd64 binary
6. WHEN building binaries, THE Build_System SHALL embed frontend assets in each binary
7. WHEN building binaries, THE Build_System SHALL use release optimization flags
8. WHEN building binaries, THE Build_System SHALL compress binaries to reduce download size
9. THE Build_System SHALL attach all binaries to the GitHub release

### Requirement 9: Docker Image Publishing

**User Story:** As a user, I want to pull Docker images from a public registry, so that I can deploy Secan easily without building from source.

#### Acceptance Criteria

1. WHEN a release is created, THE Docker_System SHALL push images to ghcr.io/[owner]/secan
2. WHEN pushing images, THE Docker_System SHALL tag them with the version number (e.g., v1.0.0)
3. WHEN pushing images, THE Docker_System SHALL tag the latest release as "latest"
4. WHEN pushing images, THE Docker_System SHALL include both amd64 and arm64 architectures in a multi-arch manifest
5. THE Docker_System SHALL authenticate with GitHub Container Registry using GitHub tokens
6. THE Docker_System SHALL make images publicly accessible
7. WHEN a user runs docker pull, THE Docker_System SHALL automatically select the correct architecture

### Requirement 10: Build and Test Automation

**User Story:** As a developer, I want automated testing on every push, so that bugs are caught early and code quality is maintained.

#### Acceptance Criteria

1. WHEN code is pushed, THE Test_System SHALL run cargo test for the backend
2. WHEN code is pushed, THE Test_System SHALL run cargo clippy to check for code quality issues
3. WHEN code is pushed, THE Test_System SHALL run cargo fmt --check to verify formatting
4. WHEN code is pushed, THE Test_System SHALL run npm test for the frontend
5. WHEN code is pushed, THE Test_System SHALL run npm run lint for the frontend
6. WHEN any test fails, THE Test_System SHALL fail the workflow and report the error
7. THE Test_System SHALL run tests in parallel when possible to reduce CI time
8. THE Test_System SHALL cache dependencies (cargo and npm) to speed up builds

### Requirement 11: Release Workflow Automation

**User Story:** As a project maintainer, I want to create releases by pushing a git tag, so that the release process is simple and consistent.

#### Acceptance Criteria

1. WHEN a tag matching v*.*.* is pushed, THE Release_System SHALL trigger the release workflow
2. WHEN the release workflow runs, THE Release_System SHALL build all binaries and Docker images
3. WHEN builds complete, THE Release_System SHALL create a GitHub release with the tag name
4. WHEN creating the release, THE Release_System SHALL generate release notes from commits since the last tag
5. WHEN creating the release, THE Release_System SHALL attach all binary artifacts
6. WHEN creating the release, THE Release_System SHALL include checksums for all binaries
7. THE Release_System SHALL mark the release as a pre-release if the version contains -alpha, -beta, or -rc
8. THE Release_System SHALL publish Docker images with the same version tag

### Requirement 12: Workflow Configuration and Secrets

**User Story:** As a project maintainer, I want workflows to use GitHub secrets securely, so that credentials are not exposed in code.

#### Acceptance Criteria

1. THE Workflow_System SHALL use GITHUB_TOKEN for authentication with GitHub APIs
2. THE Workflow_System SHALL use GITHUB_TOKEN for pushing to GitHub Container Registry
3. THE Workflow_System SHALL not hardcode any credentials in workflow files
4. THE Workflow_System SHALL use environment variables for configurable values
5. THE Workflow_System SHALL document required secrets in README.md
6. THE Workflow_System SHALL use least-privilege permissions for each workflow job

### Requirement 13: Documentation Updates for CI/CD

**User Story:** As a contributor, I want clear documentation on the CI/CD process, so that I understand how builds and releases work.

#### Acceptance Criteria

1. THE Documentation SHALL explain how to trigger a release by pushing a git tag
2. THE Documentation SHALL explain the semantic versioning scheme used
3. THE Documentation SHALL list all platforms and architectures supported
4. THE Documentation SHALL explain where to find Docker images (ghcr.io)
5. THE Documentation SHALL explain where to find binary releases (GitHub Releases)
6. THE Documentation SHALL document the build process for local development
7. THE Documentation SHALL include badges for build status and latest release

### Requirement 14: Backward Compatibility During Transition

**User Story:** As a developer, I want the transition to be smooth, so that existing development workflows continue to work during restructuring.

#### Acceptance Criteria

1. WHEN restructuring is in progress, THE System SHALL ensure existing git history is preserved
2. WHEN restructuring is complete, THE System SHALL provide migration instructions for developers with local changes
3. THE System SHALL document any breaking changes in the restructuring
4. THE System SHALL ensure all existing functionality continues to work after restructuring
5. THE System SHALL update all internal documentation and comments to reflect new structure
