# Requirements Document

## Introduction

This document specifies the requirements for migrating the Secan documentation from Starlight (Astro-based) to Docusaurus. The current Starlight implementation has proven unreliable with frequent build failures and versioning issues. Docusaurus provides a more stable, feature-rich platform with better versioning support and a larger ecosystem.

The migration will maintain all existing documentation content, structure, and features while improving build reliability and maintainability.

## Glossary

- **Starlight**: Astro-based documentation framework currently in use
- **Docusaurus**: React-based documentation framework (target platform)
- **Secan**: The Elasticsearch cluster management tool being documented
- **Mermaid.js**: JavaScript library for rendering diagrams from text definitions
- **MDX**: Markdown with JSX support for interactive components
- **GitHub_Pages**: Static site hosting service for the documentation
- **Sproutling**: The Secan logo/mascot image
- **Version_Selector**: UI component for switching between documentation versions
- **Sidebar**: Left navigation menu in the documentation
- **Base_URL**: The `/secan/` path prefix for GitHub Pages deployment

## Requirements

### Requirement 1: Complete Content Migration

**User Story:** As a documentation maintainer, I want all existing Starlight content migrated to Docusaurus format, so that no documentation is lost during the transition.

#### Acceptance Criteria

1. THE Migration_Tool SHALL convert all markdown files from `docs/src/content/docs/` to Docusaurus format
2. THE Migration_Tool SHALL preserve all frontmatter metadata (title, description)
3. THE Migration_Tool SHALL convert Starlight-specific components to Docusaurus equivalents
4. THE Migration_Tool SHALL maintain the existing directory structure under a `docs/` folder
5. WHEN a Starlight Card component is encountered, THE Migration_Tool SHALL convert it to Docusaurus Card syntax
6. WHEN a Starlight CardGrid is encountered, THE Migration_Tool SHALL convert it to appropriate Docusaurus layout
7. THE Migration_Tool SHALL preserve all code blocks with syntax highlighting
8. THE Migration_Tool SHALL preserve all internal links and update paths to match Docusaurus routing
9. THE Migration_Tool SHALL convert all asset references to Docusaurus static asset paths

### Requirement 2: Sidebar Navigation Structure

**User Story:** As a documentation user, I want the same navigation structure as the current Starlight site, so that I can find information in familiar locations.

#### Acceptance Criteria

1. THE Docusaurus_Config SHALL define a sidebar with "Getting Started" category
2. THE Docusaurus_Config SHALL define a sidebar with "Features" category
3. THE Docusaurus_Config SHALL define a sidebar with "Authentication & Authorization" category
4. THE Docusaurus_Config SHALL define a sidebar with "Configuration" category
5. THE Docusaurus_Config SHALL define a sidebar with "API Reference" category
6. WHEN a user views the sidebar, THE Sidebar SHALL display items in the same order as Starlight
7. THE Sidebar SHALL support collapsible categories
8. THE Sidebar SHALL highlight the current page
9. THE API_Reference_Link SHALL point to `/api/` for Rust API documentation

### Requirement 3: Mermaid.js Diagram Support

**User Story:** As a documentation author, I want to use Mermaid.js diagrams in my documentation, so that I can create visual representations of architecture and workflows.

#### Acceptance Criteria

1. THE Docusaurus_Config SHALL include the `@docusaurus/theme-mermaid` plugin
2. WHEN a markdown file contains a mermaid code block, THE Renderer SHALL render it as a diagram
3. THE Mermaid_Theme SHALL support both light and dark color schemes
4. THE Mermaid_Theme SHALL use colors consistent with Secan branding
5. WHEN a user switches themes, THE Mermaid_Diagrams SHALL update to match the selected theme
6. THE Mermaid_Config SHALL support all diagram types (flowchart, sequence, class, state, etc.)

### Requirement 4: Theme Support

**User Story:** As a documentation user, I want to switch between light and dark themes, so that I can read documentation comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Theme_Switcher SHALL provide light mode option
2. THE Theme_Switcher SHALL provide dark mode option
3. THE Theme_Switcher SHALL provide system preference option
4. THE Theme_Config SHALL default to dark mode
5. THE Theme_Config SHALL respect system color scheme preferences
6. WHEN a user selects a theme, THE Application SHALL persist the preference in localStorage
7. THE Dark_Theme SHALL use dark backgrounds with light text
8. THE Light_Theme SHALL use light backgrounds with dark text
9. THE Code_Blocks SHALL have appropriate syntax highlighting for both themes

### Requirement 5: Landing Page with Logo

**User Story:** As a documentation user, I want to see the Secan logo and clear navigation options on the landing page, so that I understand what the tool is and where to start.

#### Acceptance Criteria

1. THE Landing_Page SHALL display the sproutling.png logo prominently
2. THE Landing_Page SHALL include a hero section with tagline
3. THE Landing_Page SHALL provide "Get Started" call-to-action button
4. THE Landing_Page SHALL provide "View Features" call-to-action button
5. THE Landing_Page SHALL display key features in a card grid layout
6. THE Feature_Cards SHALL include icons and descriptions
7. THE Landing_Page SHALL be visually appealing and professional
8. THE Logo SHALL be copied from `frontend/public/sproutling.png` to `docs/static/img/`

### Requirement 6: Documentation Versioning

**User Story:** As a documentation maintainer, I want to support version 1.2.x documentation, so that users can access documentation for the current release.

#### Acceptance Criteria

1. THE Docusaurus_Config SHALL enable versioning support
2. THE Version_Selector SHALL display "1.2.x" as the current version
3. THE Version_Selector SHALL be accessible from the navbar
4. WHEN a user selects a version, THE Application SHALL navigate to that version's documentation
5. THE Versioned_Docs SHALL maintain separate copies of documentation per version
6. THE Current_Version SHALL be labeled as "Next" or "Current" in the version selector
7. THE Versioning_System SHALL support adding new versions via `docusaurus docs:version` command

### Requirement 7: GitHub Pages Deployment

**User Story:** As a documentation maintainer, I want the documentation to deploy automatically to GitHub Pages, so that changes are published without manual intervention.

#### Acceptance Criteria

1. THE GitHub_Workflow SHALL trigger on pushes to main branch with docs changes
2. THE GitHub_Workflow SHALL trigger on pull requests with docs changes
3. THE GitHub_Workflow SHALL trigger on manual workflow dispatch
4. THE Build_Job SHALL install Node.js dependencies
5. THE Build_Job SHALL run `npm run build` in the docs directory
6. THE Build_Job SHALL upload the build artifact
7. THE Deploy_Job SHALL only run on main branch pushes (not PRs)
8. THE Deploy_Job SHALL use GitHub Pages deployment action
9. THE Docusaurus_Config SHALL set baseUrl to `/secan/`
10. THE Docusaurus_Config SHALL set url to `https://wasilak.github.io`
11. THE Development_Server SHALL serve content at `http://localhost:3000/secan/` to match production paths
12. THE Package_JSON SHALL include a `start` script that serves with baseUrl: `docusaurus start --base-url /secan/`
13. WHEN the build succeeds, THE Workflow SHALL deploy to GitHub Pages
14. WHEN the build fails, THE Workflow SHALL report the error and stop

### Requirement 8: Build Reliability

**User Story:** As a documentation maintainer, I want reliable documentation builds, so that I don't encounter frequent build failures.

#### Acceptance Criteria

1. THE Build_Process SHALL complete successfully with valid markdown
2. THE Build_Process SHALL provide clear error messages for invalid content
3. THE Build_Process SHALL validate all internal links
4. THE Build_Process SHALL validate all asset references
5. WHEN a broken link is detected, THE Build_Process SHALL report a warning
6. WHEN a missing asset is detected, THE Build_Process SHALL report an error
7. THE Build_Process SHALL complete in under 5 minutes for typical documentation changes
8. THE Build_Process SHALL use locked dependency versions for reproducibility

### Requirement 9: Search Functionality

**User Story:** As a documentation user, I want to search the documentation, so that I can quickly find specific information.

#### Acceptance Criteria

1. THE Docusaurus_Config SHALL enable Algolia DocSearch or local search
2. THE Search_Bar SHALL be accessible from the navbar
3. WHEN a user types a query, THE Search SHALL provide real-time suggestions
4. THE Search_Results SHALL highlight matching text
5. THE Search_Results SHALL include page titles and context
6. THE Search SHALL index all documentation pages
7. THE Search SHALL support keyboard navigation (arrow keys, enter)

### Requirement 10: Markdown Feature Parity

**User Story:** As a documentation author, I want all markdown features to work correctly, so that I can write rich documentation.

#### Acceptance Criteria

1. THE Markdown_Renderer SHALL support standard markdown syntax
2. THE Markdown_Renderer SHALL support GitHub Flavored Markdown (GFM)
3. THE Markdown_Renderer SHALL support code blocks with syntax highlighting
4. THE Markdown_Renderer SHALL support tables
5. THE Markdown_Renderer SHALL support task lists
6. THE Markdown_Renderer SHALL support admonitions (notes, warnings, tips)
7. THE Markdown_Renderer SHALL support MDX components
8. THE Markdown_Renderer SHALL support inline HTML when necessary
9. THE Code_Blocks SHALL support language-specific syntax highlighting for Rust, YAML, JSON, JavaScript, TypeScript, Bash

### Requirement 11: Rust API Documentation Integration

**User Story:** As a developer, I want to access Rust API documentation from the main documentation site, so that I have a single entry point for all documentation.

#### Acceptance Criteria

1. THE Build_Process SHALL generate Rust API docs using `cargo doc`
2. THE Build_Process SHALL copy Rust API docs to `docs/static/api/`
3. THE Sidebar SHALL include a link to "/api/" for Rust API documentation
4. WHEN a user clicks the API Reference link, THE Browser SHALL navigate to the Rust API docs
5. THE Rust_API_Docs SHALL be accessible at `https://wasilak.github.io/secan/api/`
6. THE Justfile SHALL include a `docs-build-complete` recipe that builds both Docusaurus and Rust API docs

### Requirement 12: Justfile Integration

**User Story:** As a developer, I want to use Just commands to build and preview documentation, so that I have a consistent development workflow.

#### Acceptance Criteria

1. THE Justfile SHALL include a `docs-dev` recipe that runs `docusaurus start --base-url /secan/`
2. THE Justfile SHALL include a `docs-build` recipe that runs `docusaurus build`
3. THE Justfile SHALL include a `docs-preview` recipe that runs `docusaurus serve --base-url /secan/`
4. THE Justfile SHALL update `docs-build-complete` to build Docusaurus instead of Starlight
5. WHEN a developer runs `just docs-dev`, THE Development_Server SHALL start at `http://localhost:3000/secan/`
6. WHEN a developer runs `just docs-build`, THE Build SHALL produce static files in `docs/build/`
7. WHEN a developer runs `just docs-preview`, THE Preview_Server SHALL serve the built documentation at `http://localhost:3000/secan/`

### Requirement 13: Configuration Migration

**User Story:** As a documentation maintainer, I want a proper Docusaurus configuration file, so that the site is configured correctly.

#### Acceptance Criteria

1. THE Migration SHALL create `docs/docusaurus.config.js` at the root of docs directory
2. THE Docusaurus_Config SHALL set title to "Secan"
3. THE Docusaurus_Config SHALL set tagline to describe Secan
4. THE Docusaurus_Config SHALL configure the navbar with logo and GitHub link
5. THE Docusaurus_Config SHALL configure the footer with links and copyright
6. THE Docusaurus_Config SHALL enable Mermaid support
7. THE Docusaurus_Config SHALL configure theme colors
8. THE Docusaurus_Config SHALL set organizationName to "wasilak"
9. THE Docusaurus_Config SHALL set projectName to "secan"
10. THE Migration SHALL create `docs/sidebars.js` with the sidebar structure
11. THE Migration SHALL remove `docs/astro.config.mjs` after successful migration
12. THE Migration SHALL remove Astro-related dependencies from `docs/package.json`

### Requirement 14: Asset Management

**User Story:** As a documentation maintainer, I want all assets properly organized, so that they are easy to manage and reference.

#### Acceptance Criteria

1. THE Migration SHALL create `docs/static/` directory for static assets
2. THE Migration SHALL copy sproutling.png to `docs/static/img/sproutling.png`
3. THE Migration SHALL create `docs/static/js/` for custom JavaScript if needed
4. THE Migration SHALL create `docs/static/css/` for custom CSS if needed
5. THE Migration SHALL update all asset references in markdown to use `/img/` paths
6. THE Favicon SHALL be placed in `docs/static/img/favicon.ico`
7. THE Social_Card_Image SHALL be placed in `docs/static/img/secan-social-card.jpg` if it exists

### Requirement 15: Custom Styling

**User Story:** As a documentation maintainer, I want custom styling to match Secan branding, so that the documentation feels cohesive with the application.

#### Acceptance Criteria

1. THE Migration SHALL create `docs/src/css/custom.css` for custom styles
2. THE Custom_CSS SHALL define primary brand colors
3. THE Custom_CSS SHALL define dark mode colors
4. THE Custom_CSS SHALL define light mode colors
5. THE Custom_CSS SHALL style code blocks appropriately
6. THE Custom_CSS SHALL style admonitions (notes, warnings, tips)
7. THE Mermaid_Theme SHALL use colors consistent with Secan branding
8. THE Custom_CSS SHALL be imported in docusaurus.config.js

### Requirement 16: Dependency Management

**User Story:** As a documentation maintainer, I want minimal, well-maintained dependencies, so that the documentation remains stable and secure.

#### Acceptance Criteria

1. THE Package_JSON SHALL use Docusaurus 3.x (latest stable)
2. THE Package_JSON SHALL include `@docusaurus/preset-classic`
3. THE Package_JSON SHALL include `@docusaurus/theme-mermaid`
4. THE Package_JSON SHALL include `mermaid` library
5. THE Package_JSON SHALL lock dependency versions
6. THE Package_JSON SHALL remove all Astro-related dependencies
7. THE Package_JSON SHALL remove all Starlight-related dependencies
8. THE Package_JSON SHALL include scripts for `start`, `build`, `serve`, `clear`

### Requirement 17: Link Validation

**User Story:** As a documentation maintainer, I want broken links detected during build, so that I can fix them before deployment.

#### Acceptance Criteria

1. THE Docusaurus_Config SHALL set `onBrokenLinks` to "warn" or "throw"
2. THE Docusaurus_Config SHALL set `onBrokenMarkdownLinks` to "warn"
3. WHEN a broken internal link is detected, THE Build_Process SHALL report it
4. WHEN a broken markdown link is detected, THE Build_Process SHALL report it
5. THE Build_Process SHALL validate all relative links
6. THE Build_Process SHALL validate all anchor links

### Requirement 18: Mobile Responsiveness

**User Story:** As a mobile user, I want the documentation to be readable on my device, so that I can access information on the go.

#### Acceptance Criteria

1. THE Documentation SHALL be responsive on mobile devices
2. THE Sidebar SHALL collapse into a hamburger menu on mobile
3. THE Navigation SHALL be accessible via touch gestures
4. THE Code_Blocks SHALL be horizontally scrollable on mobile
5. THE Tables SHALL be horizontally scrollable on mobile
6. THE Font_Sizes SHALL be readable on mobile screens
7. THE Touch_Targets SHALL be appropriately sized for touch interaction

### Requirement 19: Performance Optimization

**User Story:** As a documentation user, I want fast page loads, so that I can access information quickly.

#### Acceptance Criteria

1. THE Build_Process SHALL generate optimized static HTML
2. THE Build_Process SHALL minify CSS and JavaScript
3. THE Build_Process SHALL optimize images
4. THE Application SHALL use code splitting for faster initial loads
5. THE Application SHALL prefetch linked pages on hover
6. THE Application SHALL lazy load images below the fold
7. THE Initial_Page_Load SHALL complete in under 3 seconds on 3G connection

### Requirement 20: Documentation Cleanup

**User Story:** As a documentation maintainer, I want old Starlight files removed after migration, so that the repository is clean and maintainable.

#### Acceptance Criteria

1. THE Migration SHALL remove `docs/astro.config.mjs` after successful build
2. THE Migration SHALL remove `docs/.astro/` directory after successful build
3. THE Migration SHALL remove Astro dependencies from `docs/package.json`
4. THE Migration SHALL remove Starlight dependencies from `docs/package.json`
5. THE Migration SHALL update `.gitignore` to exclude Docusaurus build artifacts
6. THE Migration SHALL preserve `docs/dist/` in `.gitignore` (legacy)
7. THE Migration SHALL add `docs/build/` to `.gitignore` (Docusaurus output)
8. THE Migration SHALL add `docs/.docusaurus/` to `.gitignore`
