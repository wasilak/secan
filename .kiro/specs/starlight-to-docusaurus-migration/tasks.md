# Implementation Plan: Starlight to Docusaurus Migration

## Overview

This implementation plan converts the approved design for migrating Secan documentation from Starlight to Docusaurus into actionable coding tasks. The migration follows a 10-phase approach that ensures reliability, maintains all features, and provides a clean rollback strategy.

The implementation will be done incrementally, with each phase building on the previous one. Testing and verification are integrated throughout to catch issues early.

## Tasks

- [ ] 1. Project setup and dependency installation
  - [ ] 1.1 Update package.json with Docusaurus 3.x dependencies
    - Remove Astro and Starlight dependencies
    - Add @docusaurus/preset-classic, @docusaurus/theme-mermaid, mermaid
    - Update React to version 18
    - Add scripts with baseUrl flag: start (docusaurus start --base-url /secan/), build (docusaurus build), serve (docusaurus serve --base-url /secan/), clear (docusaurus clear)
    - _Requirements: 7.11, 7.12, 12.1, 12.3, 12.5, 12.7, 16.1, 16.2, 16.3, 16.4, 16.6, 16.7, 16.8_
  
  - [ ] 1.2 Install dependencies and verify setup
    - Run npm install to install all dependencies
    - Verify node_modules is populated correctly
    - _Requirements: 16.1-16.8_
  
  - [ ] 1.3 Create Docusaurus directory structure
    - Create docs/docs/ for documentation content
    - Create docs/src/components/ for custom React components
    - Create docs/src/css/ for custom styling
    - Create docs/src/pages/ for custom pages
    - Create docs/static/img/ for static assets
    - _Requirements: 14.1, 14.3, 14.4_

- [ ] 2. Configuration migration
  - [ ] 2.1 Create docusaurus.config.js with site metadata
    - Set title to "Secan"
    - Set tagline describing Secan
    - Set url to https://wasilak.github.io
    - Set baseUrl to /secan/
    - Set organizationName to wasilak
    - Set projectName to secan
    - Configure onBrokenLinks and onBrokenMarkdownLinks
    - _Requirements: 7.9, 7.10, 13.1, 13.2, 13.8, 13.9, 17.1, 17.2_
  
  - [ ] 2.2 Configure navbar in docusaurus.config.js
    - Add Secan title
    - Configure logo with sproutling.png
    - Add GitHub link to navbar
    - Add version dropdown to navbar
    - _Requirements: 13.4, 5.1_
  
  - [ ] 2.3 Configure footer in docusaurus.config.js
    - Add footer links
    - Add copyright notice
    - _Requirements: 13.5_
  
  - [ ] 2.4 Configure theme settings
    - Set default color mode to dark
    - Enable respectPrefersColorScheme
    - Configure primary colors for light and dark modes
    - _Requirements: 4.4, 4.5, 13.7, 15.2, 15.3, 15.4_
  
  - [ ] 2.5 Configure Mermaid plugin
    - Add @docusaurus/theme-mermaid to themes
    - Configure Mermaid theme for light and dark modes
    - Set theme variables for Secan branding colors
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 13.6, 15.7_
  
  - [ ] 2.6 Create sidebars.js with navigation structure
    - Define "Getting Started" category with about, installation, architecture
    - Define "Features" category with all feature pages
    - Define "Authentication & Authorization" category
    - Define "Configuration" category with auth, clusters, logging
    - Define "API Reference" link to /api/
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 11.3, 13.10_

- [ ] 3. Content migration script
  - [ ] 3.1 Create migration script to convert markdown files
    - Write Node.js script to read all files from docs/src/content/docs/
    - Parse frontmatter from each markdown file
    - Convert Starlight frontmatter to Docusaurus format (remove template field)
    - Write converted files to docs/docs/ preserving directory structure
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ] 3.2 Implement component conversion in migration script
    - Convert Starlight Card components to Docusaurus Admonitions
    - Convert Starlight CardGrid to CSS Grid div with className
    - Preserve Mermaid code blocks as-is
    - Preserve standard code blocks as-is
    - _Requirements: 1.5, 1.6, 1.7, 10.3_
  
  - [ ] 3.3 Implement link conversion in migration script
    - Remove /secan/ prefix from internal links
    - Remove trailing slashes from links
    - Update paths to match Docusaurus routing
    - _Requirements: 1.8, 17.5_
  
  - [ ] 3.4 Implement asset path conversion in migration script
    - Convert relative asset paths (../../assets/) to /img/ paths
    - Update all image references in markdown
    - _Requirements: 1.9, 14.5_
  
  - [ ] 3.5 Run migration script and verify output
    - Execute migration script
    - Verify all markdown files exist in docs/docs/
    - Verify directory structure is preserved
    - Manually review converted files for correctness
    - _Requirements: 1.1-1.9_

- [ ] 4. Asset migration
  - [ ] 4.1 Copy logo and favicon to static directory
    - Copy frontend/public/sproutling.png to docs/static/img/sproutling.png
    - Create or copy favicon to docs/static/img/favicon.ico
    - _Requirements: 5.8, 14.2, 14.6_
  
  - [ ] 4.2 Copy additional assets if they exist
    - Check for social card image and copy if exists
    - Copy any other images from Starlight to docs/static/img/
    - _Requirements: 14.7_

- [ ] 5. Landing page implementation
  - [ ] 5.1 Create landing page component
    - Create docs/src/pages/index.tsx
    - Implement HomepageHeader component with logo and hero section
    - Add tagline display
    - Add "Get Started" CTA button linking to /getting-started/about
    - Add "View Features" CTA button linking to /features/dashboard
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 5.2 Implement feature cards section
    - Create HomepageFeatures component
    - Define feature cards array with 6 key features
    - Create FeatureCard component for individual cards
    - Display cards in responsive grid layout
    - _Requirements: 5.5, 5.6_
  
  - [ ] 5.3 Create landing page styles
    - Create docs/src/pages/index.module.css
    - Style hero banner section
    - Style logo display
    - Style CTA buttons
    - Style feature cards grid
    - Ensure responsive design for mobile
    - _Requirements: 5.7, 18.1, 18.2_

- [ ] 6. Custom styling implementation
  - [ ] 6.1 Create custom CSS file
    - Create docs/src/css/custom.css
    - Define CSS variables for primary brand colors
    - Define light mode color variables
    - Define dark mode color variables
    - Configure code block styling
    - Configure admonition styling
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.8_
  
  - [ ] 6.2 Implement Mermaid diagram theming
    - Add Mermaid-specific CSS for light mode
    - Add Mermaid-specific CSS for dark mode
    - Ensure colors match Secan branding
    - _Requirements: 3.3, 3.4, 15.7_
  
  - [ ] 6.3 Add custom component styles
    - Style card grid layout for landing page
    - Add mobile-responsive styles
    - Ensure touch targets are appropriately sized
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7_

- [ ] 7. Versioning setup
  - [ ] 7.1 Configure versioning in docusaurus.config.js
    - Enable versioning in preset-classic docs configuration
    - Configure version labels (1.2.x Next, 1.1.x)
    - Set lastVersion to current
    - Configure version paths
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7_
  
  - [ ] 7.2 Create version 1.1 snapshot
    - Run: npm run docusaurus docs:version 1.1
    - Verify versioned_docs/version-1.1/ is created
    - Verify versioned_sidebars/version-1.1-sidebars.json is created
    - Verify versions.json is created
    - _Requirements: 6.4, 6.5_

- [ ] 8. Build integration and CI/CD
  - [ ] 8.1 Update Justfile recipes
    - Update docs-dev recipe to run: cd docs && npm run start (which includes --base-url /secan/)
    - Update docs-build recipe to run: cd docs && npm run build
    - Update docs-preview recipe to run: cd docs && npm run serve (which includes --base-url /secan/)
    - Update docs-build-complete to build Docusaurus and copy Rust API docs
    - Verify local dev server serves at http://localhost:3000/secan/
    - _Requirements: 7.11, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  
  - [ ] 8.2 Create GitHub Actions workflow
    - Create .github/workflows/docs.yml
    - Configure triggers: push to main (docs changes), PRs, manual dispatch
    - Add build job: setup Node.js, install deps, build Rust API docs, build Docusaurus
    - Copy Rust API docs to docs/build/api/
    - Upload build artifact
    - Add deploy job: deploy to GitHub Pages (main branch only)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.11, 7.12, 11.1, 11.2, 11.4, 11.5, 11.6_

- [ ] 9. Testing and verification
  - [ ]* 9.1 Write unit tests for migration script
    - Test frontmatter conversion function
    - Test component conversion function
    - Test link conversion function
    - Test asset path conversion function
    - Test edge cases (empty files, no frontmatter, special characters)
    - _Requirements: 1.1-1.9_
  
  - [ ]* 9.2 Write property-based tests for migration
    - **Property 1: Content File Migration Completeness**
    - **Validates: Requirements 1.1**
    - Test that all source files have destination files
  
  - [ ]* 9.3 Write property test for frontmatter preservation
    - **Property 2: Frontmatter Preservation**
    - **Validates: Requirements 1.2**
    - Test that title and description are preserved
  
  - [ ]* 9.4 Write property test for code block preservation
    - **Property 5: Code Block Preservation**
    - **Validates: Requirements 1.7**
    - Test that code blocks maintain language and content
  
  - [ ] 9.5 Manual testing checklist
    - Verify all markdown files migrated
    - Test landing page displays correctly at http://localhost:3000/secan/
    - Test logo appears in navbar and landing page
    - Test theme switcher (light/dark/system)
    - Test sidebar navigation matches Starlight structure
    - Test all internal links work with /secan/ prefix locally
    - Test all assets load correctly with /secan/ prefix locally
    - Test Mermaid diagrams render correctly
    - Test code blocks have syntax highlighting
    - Test search functionality works
    - Test version selector shows 1.1.x
    - Test mobile responsiveness
    - Run: npm run build (verify no errors)
    - Run: npm run start (verify dev server works at http://localhost:3000/secan/)
    - Run: npm run serve (verify preview server works at http://localhost:3000/secan/)
    - _Requirements: 1.1-20.8, 7.11, 7.12_

- [ ] 10. Checkpoint - Verify build and deployment
  - Ensure all tests pass, verify build succeeds locally, test GitHub Actions workflow, ask the user if questions arise.

- [ ] 11. Documentation and cleanup
  - [ ] 11.1 Create docs/README.md
    - Document how to run development server
    - Document how to build documentation
    - Document how to add new pages
    - Document how to create new versions
    - Document how to deploy
    - _Requirements: 20.1-20.8_
  
  - [ ] 11.2 Create docs/MIGRATION.md
    - Document what changed from Starlight to Docusaurus
    - Document how to update content
    - Document how to add new features
    - Create troubleshooting guide for common issues
    - _Requirements: 20.1-20.8_
  
  - [ ] 11.3 Update root README.md
    - Update documentation links to point to new Docusaurus site
    - Update build instructions
    - Update contribution guidelines
    - _Requirements: 20.1-20.8_
  
  - [ ] 11.4 Update .gitignore
    - Add docs/.docusaurus/ to .gitignore
    - Add docs/build/ to .gitignore
    - Keep docs/dist/ for legacy reference
    - _Requirements: 20.5, 20.6, 20.7, 20.8_
  
  - [ ] 11.5 Remove Starlight files after successful verification
    - Remove docs/astro.config.mjs
    - Remove docs/.astro/ directory
    - Remove docs/src/content.config.ts
    - Remove Starlight content structure (docs/src/content/docs/)
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  
  - [ ] 11.6 Clean up package.json dependencies
    - Remove astro dependency
    - Remove @astrojs/starlight dependency
    - Remove starlight-versions dependency
    - Remove astro-mermaid dependency
    - Remove any other Astro-specific dependencies
    - Run npm install to update package-lock.json
    - _Requirements: 16.6, 16.7, 20.3, 20.4_

- [ ] 12. Final checkpoint and handoff
  - Ensure all tests pass, verify GitHub Pages deployment succeeds, verify all features work correctly, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at critical milestones
- The migration script (task 3) is the core of the content migration
- Manual testing (task 9.5) is critical to verify the migration succeeded
- Cleanup (task 11) should only happen after successful deployment verification
- Keep Starlight files intact until Docusaurus is fully verified and deployed
- The design document provides detailed implementation examples for each component
