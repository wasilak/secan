# Requirements Document: Cerebro Rewrite

## Introduction

This document specifies the requirements for rewriting Cerebro, an Elasticsearch web administration tool, from its legacy stack (Scala/Play Framework/AngularJS) to a modern architecture using Rust for the backend and TypeScript/React/Mantine UI for the frontend. The rewrite aims to deliver a single binary distribution with embedded frontend assets, database-less architecture, and improved authentication with role-based access control, while preserving all existing functionality and improving performance, maintainability, and user experience. The new version will support both Elasticsearch (versions 7, 8, 9) and OpenSearch.

## Glossary

- **Cerebro**: The Elasticsearch web administration tool being rewritten
- **Backend**: The Rust-based server component using Axum framework
- **Frontend**: The TypeScript/React/Mantine UI-based client application
- **Single_Binary**: A standalone executable containing both backend and embedded frontend assets
- **Elasticsearch_Cluster**: A connected Elasticsearch instance or cluster being managed
- **Auth_Provider**: Authentication mechanism (Local Users or OIDC)
- **Local_Users**: Users defined in configuration file with username and password
- **OIDC_Provider**: OpenID Connect identity provider for authentication
- **In_App_Role**: Role assignment mapping users to accessible Elasticsearch_Clusters
- **Theme**: Visual appearance mode (Light, Dark, or System)
- **OpenSearch**: Open-source fork of Elasticsearch with compatible API
- **Index**: An Elasticsearch index containing documents
- **Shard**: A partition of an Elasticsearch index
- **Snapshot**: A backup of Elasticsearch indices
- **Repository**: A storage location for Elasticsearch snapshots
- **Template**: An Elasticsearch index template defining default settings
- **Alias**: An alternate name for one or more Elasticsearch indices
- **Cat_API**: Elasticsearch's compact and aligned text APIs for human consumption
- **Cluster_Settings**: Configuration parameters for an Elasticsearch cluster
- **Node**: A single Elasticsearch server instance within a cluster

## Requirements

### Requirement 1: Single Binary Distribution

**User Story:** As a system administrator, I want to download and run a single executable file, so that I can deploy Cerebro without managing separate backend and frontend components.

#### Acceptance Criteria

1. THE Backend SHALL embed all Frontend assets using rust-embed
2. WHEN the Single_Binary is executed, THE Backend SHALL serve embedded Frontend assets
3. THE Single_Binary SHALL include all required dependencies without external runtime requirements
4. THE Build_System SHALL produce platform-specific binaries for Linux, macOS, and Windows
5. THE Single_Binary SHALL support configuration via environment variables and configuration files
6. WHEN no configuration file exists, THE Backend SHALL use secure default settings

### Requirement 2: Cluster Connection Management

**User Story:** As a user, I want to connect to multiple Elasticsearch and OpenSearch clusters, so that I can manage different environments from a single interface.

#### Acceptance Criteria

1. THE Backend SHALL maintain connections to multiple Elasticsearch_Clusters simultaneously
2. THE Backend SHALL support both Elasticsearch and OpenSearch clusters
3. THE Backend SHALL support Elasticsearch versions 7, 8, and 9
4. THE Backend SHALL support OpenSearch versions compatible with Elasticsearch 7, 8, and 9
5. THE Backend SHALL accept an array of node URLs for each cluster connection
6. THE Backend SHALL support HTTP and HTTPS connections to cluster nodes
7. THE Backend SHALL support accepting self-signed certificates per cluster connection
8. THE Backend SHALL support disabling TLS verification per cluster connection
9. THE Backend SHALL support custom CA certificates per cluster connection
10. THE Backend SHALL support authenticated connections with username and password per cluster
11. THE Backend SHALL support unauthenticated connections per cluster
12. THE Backend SHALL support API key authentication per cluster
13. THE Backend SHALL store cluster authentication credentials in configuration
14. THE Backend SHALL validate cluster connectivity on startup
15. THE Frontend SHALL allow switching between clusters without re-authentication
16. WHEN a user selects an Elasticsearch_Cluster, THE Frontend SHALL switch context to that cluster
17. THE Backend SHALL load cluster connection configurations from config file and environment variables
18. WHEN an Elasticsearch_Cluster becomes unreachable, THE Frontend SHALL display connection status

### Requirement 3: Multi-Cluster Dashboard

**User Story:** As a cluster administrator, I want to view an overview of all configured clusters on a dashboard, so that I can monitor multiple environments at a glance.

#### Acceptance Criteria

1. THE Frontend SHALL display a dashboard as the default starting page
2. THE Frontend SHALL display all configured clusters in a table format
3. THE Frontend SHALL display cluster name and health status (green, yellow, red) for each cluster
4. THE Frontend SHALL display node count for each cluster
5. THE Frontend SHALL display shard count for each cluster
6. THE Frontend SHALL display index count for each cluster
7. THE Frontend SHALL display document count for each cluster
8. THE Frontend SHALL refresh dashboard data at configurable intervals
9. WHEN a user clicks a cluster in the dashboard, THE Frontend SHALL navigate to that cluster's detail view
10. WHEN a cluster is unreachable, THE Frontend SHALL display connection error status
11. THE Frontend SHALL sort clusters by name, health, or other metrics

### Requirement 4: Cluster Overview and Health Monitoring

**User Story:** As a cluster administrator, I want to view cluster health, nodes, indices, and shards, so that I can monitor system status at a glance.

#### Acceptance Criteria

1. THE Frontend SHALL display cluster health status (green, yellow, red)
2. THE Frontend SHALL display the number of nodes, indices, shards, and documents
3. THE Frontend SHALL display cluster-level statistics including memory and disk usage
4. THE Frontend SHALL refresh cluster overview data at configurable intervals
5. WHEN cluster health changes, THE Frontend SHALL update the display within the refresh interval
6. THE Frontend SHALL display node information including name, role, heap usage, and disk usage
7. THE Frontend SHALL display index information including name, health, document count, and size
8. THE Frontend SHALL display shard allocation across nodes with visual representation

### Requirement 4: Shard Allocation Management

**User Story:** As a cluster administrator, I want to enable or disable shard allocation, so that I can control cluster rebalancing during maintenance.

#### Acceptance Criteria

1. THE Frontend SHALL provide controls to enable or disable shard allocation
2. WHEN a user disables shard allocation, THE Backend SHALL update cluster settings via Elasticsearch API
3. WHEN a user enables shard allocation, THE Backend SHALL restore normal allocation settings
4. THE Frontend SHALL display current shard allocation status
5. WHEN shard allocation settings change, THE Frontend SHALL reflect the change immediately
6. IF the Elasticsearch API returns an error, THEN THE Backend SHALL return a descriptive error message

### Requirement 5: Index Operations

**User Story:** As a cluster administrator, I want to perform operations on indices, so that I can manage index lifecycle and performance.

#### Acceptance Criteria

1. WHEN a user opens a closed index, THE Backend SHALL execute the open index API call
2. WHEN a user closes an open index, THE Backend SHALL execute the close index API call
3. WHEN a user deletes an index, THE Backend SHALL execute the delete index API call with confirmation
4. WHEN a user force merges an index, THE Backend SHALL execute the force merge API call
5. WHEN a user clears cache for an index, THE Backend SHALL execute the clear cache API call
6. WHEN a user refreshes an index, THE Backend SHALL execute the refresh API call
7. WHEN a user flushes an index, THE Backend SHALL execute the flush API call
8. THE Frontend SHALL display operation progress and completion status
9. IF an index operation fails, THEN THE Backend SHALL return the Elasticsearch error message

### Requirement 6: Index Creation and Configuration

**User Story:** As a developer, I want to create indices with custom settings and mappings, so that I can configure data storage according to my application needs.

#### Acceptance Criteria

1. THE Frontend SHALL provide a form to create new indices with name field and JSON editors for settings and mappings
2. WHEN a user creates an index, THE Backend SHALL validate the index name format
3. WHEN a user creates an index, THE Backend SHALL send the create index request to Elasticsearch
4. THE Frontend SHALL use a JSON text editor (Monaco Editor or similar) with syntax highlighting for settings and mappings
5. THE Frontend SHALL validate JSON syntax before submission
6. WHEN index creation succeeds, THE Frontend SHALL navigate to the new index view
7. IF index creation fails, THEN THE Frontend SHALL display the error message from Elasticsearch
8. THE Frontend SHALL use Mantine Tabs to organize the creation form (Basic, Settings, Mappings tabs)
9. THE Frontend SHALL provide a unique URL for the index creation page

### Requirement 7: Index Settings Management

**User Story:** As a cluster administrator, I want to view and update index settings, so that I can optimize index performance and behavior.

#### Acceptance Criteria

1. WHEN a user navigates to an index settings URL, THE Frontend SHALL display current index settings as JSON
2. THE Frontend SHALL provide a JSON text editor (Monaco Editor or similar) for modifying settings
3. WHEN a user updates index settings, THE Backend SHALL validate the JSON format
4. WHEN a user updates index settings, THE Backend SHALL send the update request to Elasticsearch
5. THE Frontend SHALL display an informational note about static vs dynamic settings
6. THE Frontend SHALL display an informational note that static settings require closing the index
7. WHEN settings update succeeds, THE Frontend SHALL display a success notification
8. THE Frontend SHALL provide a unique URL for each index settings page (/cluster/:id/indices/:name/settings)

### Requirement 8: Index Mappings Management

**User Story:** As a developer, I want to view and update index mappings, so that I can define field types and analyzers for my data.

#### Acceptance Criteria

1. WHEN a user navigates to an index mappings URL, THE Frontend SHALL display current index mappings as JSON
2. THE Frontend SHALL provide a JSON text editor (Monaco Editor or similar) for adding/modifying field mappings
3. WHEN a user updates mappings, THE Backend SHALL validate the JSON format
4. WHEN a user updates mappings, THE Backend SHALL send the update request to Elasticsearch
5. THE Frontend SHALL display an informational note about mapping restrictions (fields cannot be deleted, types cannot be changed)
6. IF mapping update fails, THEN THE Frontend SHALL display the Elasticsearch error message
7. THE Frontend SHALL provide a unique URL for each index mappings page (/cluster/:id/indices/:name/mappings)
8. THE Frontend SHALL use Mantine Tabs to organize settings and mappings views

### Requirement 9: Index Statistics

**User Story:** As a cluster administrator, I want to view detailed index statistics, so that I can analyze index performance and resource usage.

#### Acceptance Criteria

1. WHEN a user requests index statistics, THE Backend SHALL fetch stats from Elasticsearch
2. THE Frontend SHALL display document count, storage size, and indexing statistics
3. THE Frontend SHALL display search statistics including query count and latency
4. THE Frontend SHALL display merge, refresh, and flush statistics
5. THE Frontend SHALL display segment information and count
6. THE Frontend SHALL support filtering statistics by time range where applicable
7. THE Frontend SHALL present statistics in a clear, organized layout

### Requirement 10: Shard Management

**User Story:** As a cluster administrator, I want to relocate shards between nodes, so that I can balance cluster load manually.

#### Acceptance Criteria

1. THE Frontend SHALL display shard allocation with source and target nodes
2. WHEN a user selects a shard, THE Frontend SHALL provide options to relocate it
3. THE Frontend SHALL display available target nodes for shard relocation
4. WHEN a user relocates a shard, THE Backend SHALL execute the reroute API call
5. THE Frontend SHALL display shard relocation progress
6. IF shard relocation fails, THEN THE Frontend SHALL display the error reason
7. THE Frontend SHALL update shard allocation display after successful relocation

### Requirement 11: Index Aliases Management

**User Story:** As a developer, I want to create and manage index aliases, so that I can implement zero-downtime index migrations and logical groupings.

#### Acceptance Criteria

1. THE Frontend SHALL display all existing aliases and their associated indices
2. THE Frontend SHALL provide a form to create new aliases
3. WHEN a user creates an alias, THE Backend SHALL validate the alias name format
4. WHEN a user creates an alias, THE Backend SHALL support adding multiple indices to the alias
5. WHEN a user creates an alias, THE Backend SHALL support routing and filter parameters
6. WHEN a user updates an alias, THE Backend SHALL execute atomic alias operations
7. WHEN a user deletes an alias, THE Backend SHALL remove the alias without affecting indices
8. THE Frontend SHALL support bulk alias operations (add/remove multiple aliases atomically)

### Requirement 12: Index Templates Management

**User Story:** As a cluster administrator, I want to manage index templates, so that I can apply consistent settings to new indices matching patterns.

#### Acceptance Criteria

1. THE Frontend SHALL display all existing index templates
2. THE Frontend SHALL provide a form to create new index templates
3. WHEN a user creates a template, THE Backend SHALL validate the template structure
4. THE Template SHALL include index patterns, settings, mappings, and aliases
5. WHEN a user creates a template, THE Backend SHALL send the template to Elasticsearch
6. WHEN a user deletes a template, THE Backend SHALL remove it from Elasticsearch
7. THE Frontend SHALL display template priority and index patterns clearly
8. THE Frontend SHALL support both legacy and composable index templates

### Requirement 13: Cluster Settings Management

**User Story:** As a cluster administrator, I want to view and update cluster settings, so that I can configure cluster behavior and performance.

#### Acceptance Criteria

1. THE Frontend SHALL display persistent and transient cluster settings
2. THE Frontend SHALL distinguish between persistent and transient settings visually
3. THE Frontend SHALL provide an editor to modify cluster settings as JSON
4. WHEN a user updates cluster settings, THE Backend SHALL validate the JSON format
5. WHEN a user updates cluster settings, THE Backend SHALL send the update to Elasticsearch
6. THE Frontend SHALL display default cluster settings alongside custom settings
7. IF cluster settings update fails, THEN THE Frontend SHALL display the error message

### Requirement 14: Node Information and Statistics

**User Story:** As a cluster administrator, I want to view detailed node information and statistics, so that I can monitor individual node health and performance.

#### Acceptance Criteria

1. THE Frontend SHALL display a list of all nodes in the cluster
2. THE Frontend SHALL display node roles (master, data, ingest, coordinating)
3. THE Frontend SHALL display node heap memory usage and limits
4. THE Frontend SHALL display node disk usage and available space
5. THE Frontend SHALL display node CPU usage and load average
6. THE Frontend SHALL display node JVM version and Elasticsearch version
7. WHEN a user selects a node, THE Frontend SHALL display detailed node statistics
8. THE Frontend SHALL display node thread pool statistics and queue sizes

### Requirement 15: Text Analysis Tools

**User Story:** As a developer, I want to analyze text with different analyzers, so that I can test and debug search analysis chains.

#### Acceptance Criteria

1. THE Frontend SHALL provide a text input for analysis
2. THE Frontend SHALL provide a dropdown to select built-in analyzers
3. WHEN a user analyzes text, THE Backend SHALL call the Elasticsearch analyze API
4. THE Frontend SHALL display analysis results showing tokens, positions, and attributes
5. THE Frontend SHALL support analyzing text by field from a specific index
6. WHEN analyzing by field, THE Backend SHALL use the field's configured analyzer
7. THE Frontend SHALL display the analyzer chain (tokenizer and filters) used
8. THE Frontend SHALL support custom analyzer definitions for ad-hoc analysis

### Requirement 16: Index Analyzers and Fields Inspection

**User Story:** As a developer, I want to view analyzers and fields configured for an index, so that I can understand how text is processed.

#### Acceptance Criteria

1. WHEN a user selects an index, THE Frontend SHALL display configured analyzers
2. THE Frontend SHALL display analyzer components (tokenizer, char filters, token filters)
3. THE Frontend SHALL display all fields in the index with their types
4. THE Frontend SHALL display which analyzer is used for each text field
5. THE Frontend SHALL support filtering fields by name or type
6. THE Frontend SHALL display field mapping properties (searchable, aggregatable, stored)

### Requirement 17: Snapshot Repository Management

**User Story:** As a cluster administrator, I want to create and manage snapshot repositories, so that I can configure backup storage locations.

#### Acceptance Criteria

1. THE Frontend SHALL display all configured snapshot repositories
2. THE Frontend SHALL provide a form to create new repositories
3. THE Backend SHALL support filesystem repository type with path configuration
4. THE Backend SHALL support S3 repository type with bucket and credentials
5. THE Backend SHALL support Azure repository type with container and credentials
6. THE Backend SHALL support GCS repository type with bucket and credentials
7. THE Backend SHALL support HDFS repository type with path configuration
8. THE Backend SHALL support read-only URL repository type
9. WHEN a user creates a repository, THE Backend SHALL validate the repository configuration
10. WHEN a user deletes a repository, THE Backend SHALL remove it from Elasticsearch
11. THE Frontend SHALL display repository type and configuration details

### Requirement 18: Snapshot Management

**User Story:** As a cluster administrator, I want to create, delete, and restore snapshots, so that I can backup and recover index data.

#### Acceptance Criteria

1. WHEN a user selects a repository, THE Frontend SHALL display all snapshots in that repository
2. THE Frontend SHALL provide a form to create new snapshots
3. WHEN creating a snapshot, THE Backend SHALL support selecting specific indices or all indices
4. WHEN creating a snapshot, THE Backend SHALL support partial snapshot option
5. WHEN a user creates a snapshot, THE Backend SHALL initiate the snapshot via Elasticsearch API
6. THE Frontend SHALL display snapshot progress and status
7. WHEN a user deletes a snapshot, THE Backend SHALL remove it from the repository
8. WHEN a user restores a snapshot, THE Frontend SHALL provide options for index renaming
9. WHEN a user restores a snapshot, THE Backend SHALL support partial restore
10. THE Frontend SHALL display snapshot metadata including size, duration, and included indices
11. IF snapshot operation fails, THEN THE Frontend SHALL display the error message

### Requirement 19: REST Client with History

**User Story:** As a developer, I want to execute arbitrary REST requests against Elasticsearch with request history, so that I can test queries and debug issues.

#### Acceptance Criteria

1. THE Frontend SHALL provide a REST client interface similar to Kibana Console
2. THE Frontend SHALL accept requests in format "METHOD endpoint" (e.g., "GET _cat/nodes")
3. THE Frontend SHALL provide a code editor with syntax highlighting for request bodies
4. THE Frontend SHALL support GET, POST, PUT, DELETE, and HEAD HTTP methods
5. WHEN a user executes a request, THE Backend SHALL proxy the request to Elasticsearch
6. THE Frontend SHALL display the response with syntax highlighting
7. THE Frontend SHALL display response status code and headers
8. THE Backend SHALL store executed requests in browser local storage
9. THE Frontend SHALL display request history in a sidebar or panel
10. WHEN a user selects a history item, THE Frontend SHALL populate the request fields
11. THE Frontend SHALL support clearing request history
12. THE Frontend SHALL support exporting and importing request collections
13. THE Frontend SHALL limit history storage to a configurable maximum number of entries

### Requirement 20: Cat API Access

**User Story:** As a cluster administrator, I want to access Elasticsearch Cat APIs, so that I can view compact, human-readable cluster information.

#### Acceptance Criteria

1. THE Frontend SHALL provide a list of available Cat API endpoints
2. WHEN a user selects a Cat API endpoint, THE Backend SHALL fetch data from Elasticsearch
3. THE Frontend SHALL display Cat API responses in a formatted table
4. THE Frontend SHALL support sorting Cat API results by column
5. THE Frontend SHALL support filtering Cat API results
6. THE Backend SHALL request Cat API responses in JSON format for parsing
7. THE Frontend SHALL display Cat API help text for each endpoint

### Requirement 21: Authentication - Local Users

**User Story:** As a system administrator, I want to authenticate users with username and password defined in configuration, so that I can control access without external dependencies.

#### Acceptance Criteria

1. WHEN Local Users authentication is configured, THE Backend SHALL validate credentials against configured users
2. THE Backend SHALL store user credentials securely using bcrypt or argon2
3. THE Backend SHALL support configuring users via configuration file
4. THE Backend SHALL support overriding user configuration via environment variables
5. WHEN authentication succeeds, THE Backend SHALL create a session for the user
6. WHEN authentication fails, THE Backend SHALL return an authentication error
7. THE Backend SHALL support configurable session timeout
8. THE Backend SHALL rate-limit authentication attempts to prevent brute force attacks
9. THE Backend SHALL maintain session state across page refreshes using secure cookies

### Requirement 22: Authentication - OIDC Support

**User Story:** As a system administrator, I want to authenticate users via OpenID Connect, so that I can integrate with modern identity providers.

#### Acceptance Criteria

1. WHEN OIDC authentication is configured, THE Backend SHALL redirect users to OIDC_Provider for login
2. THE Backend SHALL support configurable OIDC discovery URL
3. THE Backend SHALL support configurable OIDC client ID and client secret
4. THE Backend SHALL validate OIDC tokens using provider's public keys
5. WHEN OIDC authentication succeeds, THE Backend SHALL create a session for the user
6. WHEN OIDC authentication fails, THE Backend SHALL return an authentication error
7. THE Backend SHALL support configurable session timeout for OIDC users
8. THE Backend SHALL refresh OIDC tokens before expiration
9. THE Backend SHALL maintain session state across page refreshes using secure cookies

### Requirement 23: In-App Role-Based Access Control

**User Story:** As a system administrator, I want to assign users to specific clusters via roles, so that I can control which users can access which environments.

#### Acceptance Criteria

1. THE Backend SHALL support defining In_App_Roles in configuration
2. THE In_App_Role SHALL map user identifiers to accessible Elasticsearch_Clusters
3. THE Backend SHALL enforce role-based access when users switch clusters
4. WHEN a user attempts to access an unauthorized cluster, THE Backend SHALL return an authorization error
5. THE Frontend SHALL only display clusters the user is authorized to access
6. THE Backend SHALL support wildcard patterns in role definitions for cluster access
7. THE Backend SHALL support overriding role configuration via environment variables

### Requirement 24: Authentication - Open Mode

**User Story:** As a developer, I want to run Cerebro without authentication in development environments, so that I can quickly access the tool without login overhead.

#### Acceptance Criteria

1. WHEN Open mode is configured, THE Backend SHALL allow all requests without authentication
2. WHEN Open mode is configured, THE Backend SHALL grant access to all configured clusters
3. THE Backend SHALL log a warning when starting in Open mode
4. THE Frontend SHALL not display login forms when Open mode is active
5. THE Backend SHALL support switching authentication modes via configuration without code changes

### Requirement 25: Session Management

**User Story:** As a user, I want my session to persist across page refreshes, so that I don't have to re-authenticate frequently.

#### Acceptance Criteria

1. WHEN a user authenticates, THE Backend SHALL create a secure session token
2. THE Backend SHALL store session tokens using HTTP-only cookies with SameSite attribute
3. THE Backend SHALL validate session tokens on each authenticated request
4. WHEN a session expires, THE Backend SHALL return an authentication error
5. WHEN a user logs out, THE Backend SHALL invalidate the session token
6. THE Backend SHALL support configurable session duration
7. THE Backend SHALL use secure session token generation (cryptographically random)
8. THE Backend SHALL persist session state to prevent re-authentication on page refresh
9. THE Backend SHALL support session renewal to extend expiration on activity

### Requirement 26: Configuration Management

**User Story:** As a system administrator, I want to configure Cerebro via files and environment variables, so that I can deploy it in different environments easily.

#### Acceptance Criteria

1. THE Backend SHALL support configuration via YAML or TOML files
2. THE Backend SHALL support configuration via environment variables using clap or similar
3. WHEN both file and environment configuration exist, THE Backend SHALL prioritize environment variables
4. THE Backend SHALL validate configuration on startup
5. IF configuration is invalid, THEN THE Backend SHALL log errors and exit with non-zero status
6. THE Backend SHALL support configuring server port and bind address
7. THE Backend SHALL support configuring authentication mode and parameters
8. THE Backend SHALL support configuring Elasticsearch cluster connections with node arrays
9. THE Backend SHALL support configuring In_App_Roles and user-to-cluster mappings
10. THE Backend SHALL document all configuration options
11. THE Backend SHALL support overriding any configuration value via environment variables

### Requirement 27: Docker Deployment Support

**User Story:** As a system administrator, I want to deploy Cerebro using Docker, so that I can run it in containerized environments.

#### Acceptance Criteria

1. THE Build_System SHALL produce a Docker image containing the Single_Binary
2. THE Docker image SHALL support configuration via environment variables
3. THE Docker image SHALL support mounting configuration files as volumes
4. THE Docker image SHALL expose the web server port
5. THE Docker image SHALL run as a non-root user for security
6. THE Docker image SHALL be based on a minimal base image (Alpine or distroless)
7. THE Docker image SHALL include health check endpoint

### Requirement 28: Development Experience

**User Story:** As a developer, I want hot reload during development, so that I can iterate quickly on code changes.

#### Acceptance Criteria

1. THE Frontend build system SHALL support hot module replacement (HMR)
2. WHEN Frontend code changes, THE Frontend SHALL reload automatically without full page refresh
3. THE Backend SHALL support development mode with auto-restart on code changes
4. THE Development setup SHALL document how to run Backend and Frontend concurrently
5. THE Development setup SHALL support proxy configuration for API requests
6. THE Development setup SHALL require minimal manual steps to start

### Requirement 29: Cross-Platform Binary Builds

**User Story:** As a user, I want to download Cerebro for my operating system, so that I can run it natively without compatibility issues.

#### Acceptance Criteria

1. THE Build_System SHALL produce binaries for Linux x86_64
2. THE Build_System SHALL produce binaries for Linux ARM64
3. THE Build_System SHALL produce binaries for macOS x86_64
4. THE Build_System SHALL produce binaries for macOS ARM64 (Apple Silicon)
5. THE Build_System SHALL produce binaries for Windows x86_64
6. THE Build_System SHALL use GitHub Actions or similar CI for automated builds
7. THE Build_System SHALL produce release artifacts with version numbers
8. THE Build_System SHALL verify binary functionality via automated tests

### Requirement 29: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error messages and logs, so that I can troubleshoot issues effectively.

#### Acceptance Criteria

1. THE Backend SHALL log all HTTP requests with method, path, and status code
2. THE Backend SHALL log authentication attempts and failures
3. THE Backend SHALL log Elasticsearch API errors with full error details
4. THE Backend SHALL support configurable log levels (debug, info, warn, error)
5. THE Backend SHALL log to stdout in structured format (JSON or logfmt)
6. WHEN an error occurs, THE Frontend SHALL display user-friendly error messages
7. THE Frontend SHALL display technical error details in a collapsible section
8. THE Backend SHALL include request IDs in logs for request tracing
9. THE Backend SHALL log startup configuration (excluding sensitive values)

### Requirement 30: Security Best Practices

**User Story:** As a security engineer, I want Cerebro to follow security best practices, so that it doesn't introduce vulnerabilities.

#### Acceptance Criteria

1. THE Backend SHALL use HTTPS by default with configurable TLS certificates
2. THE Backend SHALL set secure HTTP headers (CSP, HSTS, X-Frame-Options)
3. THE Backend SHALL validate and sanitize all user inputs
4. THE Backend SHALL not log sensitive information (passwords, tokens)
5. THE Backend SHALL implement rate limiting on authentication endpoints
6. THE Frontend SHALL sanitize user input before rendering to prevent XSS
7. THE Backend SHALL support CORS configuration for cross-origin requests
8. THE Backend SHALL use secure defaults (authentication required, HTTPS enabled)

### Requirement 31: Performance Optimization

**User Story:** As a user, I want Cerebro to respond quickly, so that I can manage clusters efficiently without delays.

#### Acceptance Criteria

1. THE Backend SHALL respond to health check requests within 100ms
2. THE Backend SHALL cache Elasticsearch cluster metadata for configurable duration
3. THE Frontend SHALL implement virtual scrolling for large lists (indices, nodes)
4. THE Frontend SHALL lazy-load components to reduce initial bundle size
5. THE Backend SHALL use connection pooling for Elasticsearch requests
6. THE Backend SHALL support concurrent requests to Elasticsearch
7. THE Frontend SHALL debounce user input in search and filter fields
8. THE Backend SHALL compress HTTP responses using gzip or brotli

### Requirement 32: Accessibility Compliance

**User Story:** As a user with disabilities, I want Cerebro to be accessible, so that I can use it with assistive technologies.

#### Acceptance Criteria

1. THE Frontend SHALL use semantic HTML elements
2. THE Frontend SHALL provide ARIA labels for interactive elements
3. THE Frontend SHALL support keyboard navigation for all functionality
4. THE Frontend SHALL maintain focus management for modals and dialogs
5. THE Frontend SHALL provide sufficient color contrast ratios (WCAG AA)
6. THE Frontend SHALL support screen reader announcements for dynamic content
7. THE Frontend SHALL not rely solely on color to convey information

### Requirement 33: Responsive Design

**User Story:** As a user, I want to use Cerebro on different screen sizes, so that I can manage clusters from various devices.

#### Acceptance Criteria

1. THE Frontend SHALL adapt layout for desktop screens (1920x1080 and above)
2. THE Frontend SHALL adapt layout for laptop screens (1366x768 and above)
3. THE Frontend SHALL adapt layout for tablet screens (768x1024 and above)
4. THE Frontend SHALL provide mobile-friendly navigation on small screens
5. THE Frontend SHALL use responsive typography that scales appropriately
6. THE Frontend SHALL ensure touch targets are at least 44x44 pixels on mobile

### Requirement 34: Backward Compatibility

**User Story:** As an existing Cerebro user, I want to migrate to the new version easily, so that I can upgrade without extensive reconfiguration.

#### Acceptance Criteria

1. THE Backend SHALL support reading legacy configuration file format where possible
2. THE Backend SHALL provide migration guide for configuration changes
3. THE Backend SHALL maintain REST API compatibility for cluster connections
4. THE Documentation SHALL document breaking changes and migration paths
5. THE Backend SHALL provide configuration conversion tool for legacy configs

### Requirement 36: Theme Support

**User Story:** As a user, I want to choose between light, dark, and system themes, so that I can use Cerebro comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Frontend SHALL support Light theme mode
2. THE Frontend SHALL support Dark theme mode
3. THE Frontend SHALL support System theme mode that follows OS preference
4. THE Frontend SHALL default to System theme mode
5. THE Frontend SHALL provide a theme selector in the user interface
6. WHEN a user changes theme, THE Frontend SHALL persist the preference in browser local storage
7. WHEN a user returns to the application, THE Frontend SHALL restore the saved theme preference
8. THE Frontend SHALL apply theme changes immediately without page refresh
9. THE Frontend SHALL use Mantine UI's theme system for consistent styling

### Requirement 37: User Preferences Persistence

**User Story:** As a user, I want my UI preferences to persist across sessions, so that I don't have to reconfigure settings each time.

#### Acceptance Criteria

1. THE Frontend SHALL store refresh interval setting in browser local storage
2. THE Frontend SHALL store theme preference in browser local storage
3. THE Frontend SHALL store last selected cluster in browser local storage
4. THE Frontend SHALL restore all preferences on application load
5. THE Frontend SHALL provide a way to reset preferences to defaults
6. THE Frontend SHALL handle missing or corrupted preference data gracefully

### Requirement 38: Elasticsearch Client Flexibility

**User Story:** As a system administrator, I want to choose between using the Elasticsearch Rust SDK or direct HTTP requests, so that I can support different Elasticsearch versions flexibly.

#### Acceptance Criteria

1. THE Backend SHALL support using elasticsearch-rs SDK for API requests
2. THE Backend SHALL support using direct HTTP requests as an alternative
3. THE Backend SHALL allow configuring client type per cluster connection
4. WHEN using elasticsearch-rs SDK, THE Backend SHALL support version-specific client instances
5. WHEN using direct HTTP requests, THE Backend SHALL construct requests compatible with target version
6. THE Backend SHALL document which approach is recommended for each Elasticsearch version
7. THE Backend SHALL handle API differences between Elasticsearch versions gracefully
8. THE Backend SHALL handle API differences between Elasticsearch and OpenSearch gracefully

### Requirement 39: Health Check and Monitoring

**User Story:** As a system administrator, I want health check endpoints, so that I can monitor Cerebro in production environments.

#### Acceptance Criteria

1. THE Backend SHALL provide a health check endpoint at /health
2. WHEN the Backend is healthy, THE health endpoint SHALL return HTTP 200
3. WHEN the Backend is unhealthy, THE health endpoint SHALL return HTTP 503
4. THE health endpoint SHALL check SQLite database connectivity
5. THE health endpoint SHALL not require authentication
6. THE Backend SHALL provide a readiness endpoint at /ready
7. THE Backend SHALL provide metrics endpoint for Prometheus integration (optional)

### Requirement 40: Database-Less Architecture

**User Story:** As a system administrator, I want Cerebro to operate without a database, so that I can deploy it with minimal dependencies.

#### Acceptance Criteria

1. THE Backend SHALL not require SQLite or any database for operation
2. THE Backend SHALL store all persistent data in configuration files
3. THE Frontend SHALL store user preferences in browser local storage
4. THE Frontend SHALL store REST client history in browser local storage
5. THE Backend SHALL load all configuration from files and environment variables on startup
6. THE Backend SHALL not maintain any persistent state beyond configuration files

### Requirement 41: TLS/SSL Configuration for Cluster Connections

**User Story:** As a system administrator, I want flexible TLS/SSL configuration for cluster connections, so that I can connect to clusters with various certificate setups including development environments.

#### Acceptance Criteria

1. THE Backend SHALL support HTTPS connections with valid certificates
2. THE Backend SHALL support HTTPS connections with self-signed certificates
3. THE Backend SHALL support HTTP connections without TLS
4. THE Backend SHALL allow disabling TLS certificate verification per cluster
5. THE Backend SHALL allow specifying custom CA certificate file per cluster
6. THE Backend SHALL allow specifying custom CA certificate directory per cluster
7. THE Backend SHALL validate custom CA certificates on startup
8. THE Backend SHALL log warnings when TLS verification is disabled
9. THE Backend SHALL support PEM format for CA certificates
10. THE Backend SHALL document security implications of disabling TLS verification
11. THE Backend SHALL support configuring TLS settings via configuration file
12. THE Backend SHALL support configuring TLS settings via environment variables
