# Implementation Plan: Project Restructure and CI/CD

## Overview

This implementation plan restructures the Secan project to follow Rust conventions, consolidates documentation, changes the license to GPL v3, and implements comprehensive CI/CD automation with GitHub Actions. The plan is organized into logical phases that can be executed sequentially.

## Tasks

- [x] 1. Prepare for restructuring
  - Create backup branch for safety
  - Document current state
  - Verify all tests pass in current structure
  - _Requirements: 14.1, 14.2_

- [x] 2. Update .gitignore for new structure
  - [x] 2.1 Add config.yaml to .gitignore
    - Ensure config.yaml is ignored to prevent committing sensitive data
    - _Requirements: 4.2, 6.2_
  
  - [x] 2.2 Ensure .kiro/ is in .gitignore
    - Verify .kiro/ folder is properly ignored
    - _Requirements: 6.1_
  
  - [x] 2.3 Update ignore patterns for new structure
    - Update paths to reflect root-level Rust code
    - Ensure target/, Cargo.lock at root are ignored
    - Keep config.example.yaml tracked
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_

- [-] 3. Move configuration files
  - [x] 3.1 Move backend/config.yaml to config.example.yaml at root
    - Use git mv to preserve history
    - Update all references in documentation
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 3.2 Update application config loading logic
    - Update config file search paths to look at root first
    - Ensure backward compatibility with old paths during transition
    - Test config loading with new paths
    - _Requirements: 4.5_

- [ ] 4. Restructure project directories
  - [ ] 4.1 Move Rust source code to root
    - Move backend/src/ to src/ using git mv
    - Move backend/Cargo.toml to root using git mv
    - Move backend/Cargo.lock to root using git mv
    - Move backend/.clippy.toml to root using git mv
    - Move backend/rustfmt.toml to root using git mv
    - _Requirements: 3.1, 3.2_
  
  - [ ] 4.2 Remove obsolete backend directories
    - Remove backend/examples/ directory
    - Remove backend/docs/ directory
    - Remove backend/README.md (content moved to main README)
    - Remove now-empty backend/ directory
    - _Requirements: 3.5, 3.6_
  
  - [ ] 4.3 Update rust-embed asset paths
    - Update asset paths in src code to reference frontend/dist
    - Verify embedded assets configuration is correct
    - _Requirements: 3.7_
  
  - [ ] 4.4 Update all path references in code
    - Search for hardcoded "backend/" paths in source code
    - Update import paths and file references
    - Update any scripts or build tools
    - _Requirements: 3.4, 3.8_
  
  - [ ] 4.5 Verify build works from root
    - Run cargo build from repository root
    - Run cargo test from repository root
    - Verify no path-related errors
    - _Requirements: 3.9_

- [ ] 5. Update Dockerfile for new structure
  - [ ] 5.1 Update Dockerfile paths
    - Change COPY backend/ paths to root paths
    - Update WORKDIR paths
    - Update build commands to work from root
    - _Requirements: 7.1_
  
  - [ ] 5.2 Optimize Dockerfile layer caching
    - Ensure dependency caching works efficiently
    - Verify multi-stage build is optimal
    - _Requirements: 7.5_
  
  - [ ] 5.3 Test Docker build locally
    - Build Docker image with new structure
    - Run container and verify application works
    - Test frontend assets are served correctly
    - _Requirements: 7.2, 7.8_

- [ ] 6. Consolidate documentation
  - [ ] 6.1 Create enhanced README.md structure
    - Add table of contents
    - Create sections for all consolidated content
    - Maintain clear organization
    - _Requirements: 2.9_
  
  - [ ] 6.2 Extract and merge API.md content
    - Extract essential API information
    - Add brief API overview to README
    - Consider keeping full API docs or linking to generated docs
    - Remove API.md
    - _Requirements: 2.2_
  
  - [ ] 6.3 Extract and merge CONFIGURATION.md content
    - Extract key configuration examples
    - Add quick start configuration to README
    - Remove CONFIGURATION.md
    - _Requirements: 2.3_
  
  - [ ] 6.4 Extract and merge CONTRIBUTING.md content
    - Extract essential contribution guidelines
    - Add brief contributing section to README
    - Remove CONTRIBUTING.md
    - _Requirements: 2.4_
  
  - [ ] 6.5 Extract and merge DOCKER.md content
    - Extract Docker quick start
    - Add Docker deployment section to README
    - Remove DOCKER.md
    - _Requirements: 2.5_
  
  - [ ] 6.6 Extract and merge SHARD_RELOCATION.md content
    - Extract shard relocation overview
    - Add feature description to README
    - Remove SHARD_RELOCATION.md
    - _Requirements: 2.6_
  
  - [ ] 6.7 Update acknowledgments and links
    - Ensure Cerebro acknowledgment is prominent
    - Update repository URLs
    - Add/update status badges
    - _Requirements: 2.7, 2.8_

- [ ] 7. Change license to GPL v3
  - [ ] 7.1 Replace LICENSE file
    - Replace MIT license text with full GPL v3 text
    - Update copyright year and holder
    - _Requirements: 5.1_
  
  - [ ] 7.2 Update Cargo.toml license field
    - Change license = "MIT" to license = "GPL-3.0"
    - _Requirements: 5.2_
  
  - [ ] 7.3 Update frontend/package.json license field
    - Change license field to "GPL-3.0"
    - _Requirements: 5.3_
  
  - [ ] 7.4 Update README.md license section
    - Update license section to indicate GPL v3
    - Add link to LICENSE file
    - _Requirements: 5.4_
  
  - [ ] 7.5 Document attribution requirements
    - Add section explaining GPL v3 requirements
    - Document how to comply with license
    - _Requirements: 5.5_

- [ ] 8. Implement CI workflow
  - [ ] 8.1 Create .github/workflows/ci.yml
    - Set up workflow triggers (push, pull_request)
    - Configure job matrix if needed
    - _Requirements: 10.8_
  
  - [ ] 8.2 Add backend test job
    - Set up Rust toolchain
    - Configure cargo cache
    - Add cargo test step
    - Add cargo clippy step
    - Add cargo fmt --check step
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ] 8.3 Add frontend test job
    - Set up Node.js
    - Configure npm cache
    - Add npm test step
    - Add npm run lint step
    - _Requirements: 10.4, 10.5_
  
  - [ ] 8.4 Configure dependency caching
    - Add Rust cache action
    - Add npm cache configuration
    - _Requirements: 10.8_
  
  - [ ] 8.5 Test CI workflow
    - Push to test branch
    - Verify workflow runs
    - Verify all jobs pass
    - Fix any issues
    - _Requirements: 10.6, 10.7_

- [ ] 9. Implement Docker build workflow
  - [ ] 9.1 Create .github/workflows/docker.yml
    - Set up workflow triggers (push to main, tags)
    - Configure permissions for GHCR
    - _Requirements: 9.5_
  
  - [ ] 9.2 Set up Docker Buildx for multi-arch
    - Add Docker Buildx setup step
    - Configure for amd64 and arm64
    - _Requirements: 7.4, 9.4_
  
  - [ ] 9.3 Add GHCR login step
    - Configure authentication with GITHUB_TOKEN
    - _Requirements: 12.1, 12.2_
  
  - [ ] 9.4 Add metadata extraction step
    - Extract version from git tag
    - Generate image tags (version, latest, sha)
    - _Requirements: 9.2, 9.3_
  
  - [ ] 9.5 Add Docker build and push step
    - Configure multi-platform build
    - Enable layer caching
    - Push to GHCR
    - _Requirements: 1.2, 1.4, 9.1, 9.7_
  
  - [ ] 9.6 Test Docker workflow
    - Push to main branch
    - Verify images are built and pushed
    - Pull images and test on both architectures
    - _Requirements: 9.6_

- [ ] 10. Implement release workflow
  - [ ] 10.1 Create .github/workflows/release.yml
    - Set up workflow trigger (tags matching v*.*.*)
    - Configure permissions for releases
    - _Requirements: 11.1, 12.6_
  
  - [ ] 10.2 Set up build matrix for cross-compilation
    - Define matrix for all target platforms
    - Configure OS and target triples
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 10.3 Add frontend build step
    - Build frontend assets once
    - Share artifacts between jobs
    - _Requirements: 1.6, 8.6_
  
  - [ ] 10.4 Add cross-compilation build steps
    - Install Rust with target support
    - Build binary for each platform
    - Strip and optimize binaries
    - _Requirements: 8.7_
  
  - [ ] 10.5 Add binary packaging steps
    - Create tar.gz archives for each platform
    - Generate SHA256 checksums
    - _Requirements: 8.8, 11.6_
  
  - [ ] 10.6 Add release creation step
    - Create GitHub release
    - Generate release notes from commits
    - Attach all binaries and checksums
    - Handle pre-release versions
    - _Requirements: 1.3, 11.2, 11.3, 11.4, 11.5, 11.7_
  
  - [ ] 10.7 Test release workflow
    - Push test tag (v0.0.1-test)
    - Verify release is created
    - Verify all binaries are attached
    - Download and test binaries on each platform
    - _Requirements: 11.8_

- [ ] 11. Update documentation for CI/CD
  - [ ] 11.1 Add CI/CD section to README
    - Explain how to trigger releases
    - Document semantic versioning
    - List supported platforms
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [ ] 11.2 Add Docker image documentation
    - Document GHCR image location
    - Provide pull and run examples
    - _Requirements: 13.4_
  
  - [ ] 11.3 Add binary release documentation
    - Document GitHub Releases location
    - Provide download and installation instructions
    - _Requirements: 13.5_
  
  - [ ] 11.4 Add development build documentation
    - Document local build process
    - Update build commands for new structure
    - _Requirements: 13.6_
  
  - [ ] 11.5 Add status badges
    - Add CI workflow badge
    - Add latest release badge
    - Add license badge
    - _Requirements: 13.7_

- [ ] 12. Final verification and testing
  - [ ] 12.1 Verify all builds work
    - Test cargo build from root
    - Test frontend build
    - Test Docker build
    - _Requirements: 3.9, 7.2_
  
  - [ ] 12.2 Verify all tests pass
    - Run cargo test
    - Run npm test
    - Verify CI passes
    - _Requirements: 10.6_
  
  - [ ] 12.3 Test configuration management
    - Clone fresh repository
    - Verify config.yaml not present
    - Copy config.example.yaml to config.yaml
    - Run application with config
    - _Requirements: 4.6_
  
  - [ ] 12.4 Test full release process
    - Push version tag
    - Verify release workflow completes
    - Verify Docker images published
    - Download and test all binaries
    - _Requirements: 1.3, 1.4, 1.5_
  
  - [ ] 12.5 Verify documentation accuracy
    - Read through README
    - Test all code examples
    - Verify all links work
    - _Requirements: 2.9_
  
  - [ ] 12.6 Create migration guide
    - Document changes for existing developers
    - Provide instructions for updating local clones
    - Document any breaking changes
    - _Requirements: 14.3, 14.4, 14.5_

- [ ] 13. Checkpoint - Final review
  - Ensure all tasks complete
  - Verify all requirements met
  - Test end-to-end workflows
  - Ask user if any questions or issues

## Notes

- Tasks should be executed in order as they have dependencies
- Each major phase (restructuring, documentation, license, CI/CD) can be committed separately
- Test thoroughly after each phase before proceeding
- The restructuring (tasks 1-5) should be completed before CI/CD implementation
- CI/CD workflows (tasks 8-10) can be developed in parallel once restructuring is complete
- All changes should be tested locally before pushing to trigger CI/CD
- Consider creating a test tag (v0.0.1-test) to verify release workflow before official release
