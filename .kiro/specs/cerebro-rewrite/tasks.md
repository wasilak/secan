# Implementation Plan: Cerebro Rewrite

## Overview

This implementation plan breaks down the Cerebro rewrite into incremental, testable tasks. The approach follows a bottom-up strategy, building core infrastructure first, then adding features layer by layer. Each task is designed to produce working, tested code that integrates with previous tasks.

The implementation is organized into phases:
1. Project setup and core infrastructure
2. Backend authentication and session management
3. Backend cluster management and Elasticsearch client
4. Frontend core (routing, theme, preferences)
5. Frontend dashboard and cluster views
6. REST console and advanced features
7. Testing, documentation, and deployment

## Tasks

- [x] 1. Initialize project structure and dependencies
  - Create Rust workspace with backend crate
  - Create frontend directory with Vite + React + TypeScript
  - Configure Cargo.toml with core dependencies (axum, tokio, serde, etc.)
  - Configure package.json with core dependencies (react, mantine, etc.)
  - Set up development tooling (rustfmt, clippy, eslint, prettier)
  - Create basic README with setup instructions
  - _Requirements: 28.1, 28.5, 28.6_

- [x] 2. Implement configuration management
  - [x] 2.1 Create configuration data structures
    - Define Config, ServerConfig, AuthConfig, ClusterConfig structs
    - Implement serde serialization/deserialization
    - Add validation methods for each config type
    - _Requirements: 26.1, 26.6, 26.7, 26.8, 26.9_
  
  - [ ]* 2.2 Write property test for configuration override precedence
    - **Property 2: Configuration Override Precedence**
    - **Validates: Requirements 26.3**
  
  - [x] 2.3 Implement configuration loading
    - Load from YAML/TOML files using config crate
    - Override with environment variables using clap
    - Validate configuration on load
    - Return errors for invalid configuration
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.11_
  
  - [ ]* 2.4 Write unit tests for configuration loading
    - Test loading from file
    - Test environment variable overrides
    - Test validation errors
    - Test default values
    - _Requirements: 26.1, 26.2, 26.3, 26.4_


- [x] 3. Checkpoint - Configuration system working
  - Ensure configuration loads from file and environment variables
  - Verify validation catches invalid configurations
  - Ask the user if questions arise

- [x] 4. Implement TLS management for cluster connections
  - [x] 4.1 Create TLS configuration structures
    - Define TlsConfig struct with verify, ca_cert_file, ca_cert_dir fields
    - Implement certificate loading from PEM files
    - Add validation for TLS configuration
    - _Requirements: 41.1, 41.2, 41.3, 41.4, 41.5, 41.6, 41.9_
  
  - [ ]* 4.2 Write unit tests for TLS configuration
    - Test loading valid certificates
    - Test self-signed certificate handling
    - Test certificate verification disable
    - Test invalid certificate handling
    - _Requirements: 41.1, 41.2, 41.4, 41.7_
  
  - [x] 4.3 Implement TLS client builder
    - Build reqwest::Client with TLS configuration
    - Support certificate verification toggle
    - Support custom CA certificates
    - Log warnings when verification is disabled
    - _Requirements: 41.4, 41.5, 41.6, 41.7, 41.8_
  
  - [ ]* 4.4 Write property test for TLS certificate validation
    - **Property 28: TLS Certificate Validation**
    - **Validates: Requirements 41.1, 41.5, 41.6, 41.7**

- [x] 5. Implement Elasticsearch client abstraction
  - [x] 5.1 Create Elasticsearch client enum and interface
    - Define ElasticsearchClient enum (Sdk, Http)
    - Implement request method for both variants
    - Support version hints for API compatibility
    - Handle Elasticsearch and OpenSearch differences
    - _Requirements: 2.2, 2.3, 2.4, 38.1, 38.2, 38.3, 38.7, 38.8_
  
  - [ ]* 5.2 Write unit tests for client abstraction
    - Test SDK client creation
    - Test HTTP client creation
    - Test request execution for both types
    - Test version-specific behavior
    - _Requirements: 38.1, 38.2, 38.4, 38.5_


- [x] 6. Implement cluster manager
  - [x] 6.1 Create cluster connection structures
    - Define ClusterConnection struct with nodes, auth, TLS config
    - Implement ClusterAuth enum (Basic, ApiKey, None)
    - Create cluster health check functionality
    - _Requirements: 2.5, 2.6, 2.10, 2.11, 2.12, 2.13_
  
  - [ ]* 6.2 Write property test for multi-cluster connection management
    - **Property 1: Multi-Cluster Connection Management**
    - **Validates: Requirements 2.1, 2.15, 2.16**
  
  - [x] 6.3 Implement ClusterManager
    - Load cluster configurations
    - Create and maintain client connections
    - Implement proxy_request method
    - Handle cluster health checks
    - Support cluster switching
    - _Requirements: 2.1, 2.14, 2.15, 2.16, 2.17, 2.18_
  
  - [ ]* 6.4 Write property test for node array failover
    - **Property 22: Node Array Failover**
    - **Validates: Requirements 2.5**
  
  - [ ]* 6.5 Write unit tests for cluster manager
    - Test cluster loading from config
    - Test authentication types
    - Test health checks
    - Test proxy requests
    - _Requirements: 2.1, 2.10, 2.11, 2.12, 2.14_

- [x] 7. Implement session management
  - [x] 7.1 Create session structures
    - Define Session struct with token, user info, timestamps
    - Implement secure token generation
    - Create session storage (in-memory HashMap)
    - _Requirements: 25.1, 25.7_
  
  - [ ]* 7.2 Write property test for session token security
    - **Property 4: Session Token Security**
    - **Validates: Requirements 25.1, 25.7**
  
  - [x] 7.3 Implement SessionManager
    - Create session creation method
    - Implement session validation
    - Add session invalidation
    - Implement session cleanup for expired sessions
    - Support session renewal on activity
    - _Requirements: 25.1, 25.3, 25.4, 25.5, 25.6, 25.9_
  
  - [ ]* 7.4 Write property test for session lifecycle management
    - **Property 5: Session Lifecycle Management**
    - **Validates: Requirements 25.3, 25.4, 25.5**
  
  - [ ]* 7.5 Write property test for session renewal
    - **Property 30: Session Renewal on Activity**
    - **Validates: Requirements 25.9**


- [x] 8. Implement authentication - Local Users
  - [x] 8.1 Create local user authentication structures
    - Define LocalUser struct with username, password_hash, roles
    - Implement password hashing with bcrypt or argon2
    - Create authentication validation logic
    - _Requirements: 21.1, 21.2, 21.3_
  
  - [ ]* 8.2 Write property test for authentication credential validation
    - **Property 20: Authentication Credential Validation**
    - **Validates: Requirements 21.1, 21.5, 21.6**
  
  - [x] 8.3 Implement rate limiting for authentication
    - Create rate limiter for auth endpoints
    - Track failed attempts per IP/user
    - Return 429 when limit exceeded
    - _Requirements: 21.8, 30.5_
  
  - [ ]* 8.4 Write property test for authentication rate limiting
    - **Property 29: Authentication Rate Limiting**
    - **Validates: Requirements 21.8**
  
  - [ ]* 8.5 Write unit tests for local user authentication
    - Test valid credentials
    - Test invalid credentials
    - Test password hashing
    - Test rate limiting
    - _Requirements: 21.1, 21.2, 21.5, 21.6, 21.8_

- [x] 9. Implement authentication - OIDC
  - [x] 9.1 Create OIDC authentication structures
    - Define OidcConfig with discovery_url, client_id, client_secret
    - Implement OIDC discovery
    - Create token validation logic
    - _Requirements: 22.1, 22.2, 22.3, 22.4_
  
  - [x] 9.2 Implement OIDC authentication flow
    - Implement redirect to OIDC provider
    - Handle OIDC callback
    - Validate and parse tokens
    - Extract user information from claims
    - Support token refresh
    - _Requirements: 22.1, 22.4, 22.5, 22.6, 22.8_
  
  - [ ]* 9.3 Write unit tests for OIDC authentication
    - Test discovery
    - Test token validation
    - Test callback handling
    - Test token refresh
    - _Requirements: 22.2, 22.4, 22.8_


- [x] 10. Implement role-based access control
  - [x] 10.1 Create RBAC structures
    - Define Role struct with name and cluster_patterns
    - Implement pattern matching for cluster access
    - Create RbacManager for access control
    - _Requirements: 23.1, 23.2, 23.6_
  
  - [ ]* 10.2 Write property test for cluster access authorization
    - **Property 3: Cluster Access Authorization**
    - **Validates: Requirements 23.2, 23.3, 23.5, 23.6**
  
  - [x] 10.3 Implement RBAC enforcement
    - Check user access to clusters
    - Filter cluster list by user roles
    - Return 403 for unauthorized access
    - _Requirements: 23.3, 23.4, 23.5_
  
  - [ ]* 10.4 Write unit tests for RBAC
    - Test pattern matching
    - Test access control
    - Test cluster filtering
    - Test wildcard patterns
    - _Requirements: 23.2, 23.3, 23.4, 23.5, 23.6_

- [x] 11. Implement authentication middleware
  - [x] 11.1 Create authentication middleware
    - Extract and validate session tokens from cookies
    - Support Open mode (no authentication)
    - Attach user information to request context
    - Return 401 for invalid/expired sessions
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 25.2, 25.3_
  
  - [ ]* 11.2 Write property test for session persistence
    - **Property 6: Session Persistence Across Refreshes**
    - **Validates: Requirements 21.9, 25.8**
  
  - [ ]* 11.3 Write unit tests for authentication middleware
    - Test session validation
    - Test Open mode
    - Test cookie handling
    - Test 401 responses
    - _Requirements: 24.1, 24.3, 25.2, 25.3_

- [x] 12. Checkpoint - Authentication and authorization working
  - Ensure local user authentication works
  - Verify OIDC authentication flow works
  - Test RBAC enforcement
  - Verify session management works
  - Ask the user if questions arise


- [x] 13. Implement Axum server and routing
  - [x] 13.1 Create Axum server structure
    - Define Server struct with config, cluster_manager, session_manager
    - Implement server initialization
    - Create router with all API routes
    - Add CORS middleware
    - Add compression middleware
    - _Requirements: 1.2, 30.7, 31.8_
  
  - [x] 13.2 Implement API routes
    - POST /api/auth/login - Local user login
    - POST /api/auth/logout - Logout
    - GET /api/auth/oidc/redirect - OIDC callback
    - GET /api/clusters - List accessible clusters
    - ALL /api/clusters/:id/*path - Proxy to Elasticsearch
    - _Requirements: 2.15, 2.16_
  
  - [x] 13.3 Implement health and readiness endpoints
    - GET /health - Health check (no auth required)
    - GET /ready - Readiness check
    - Return appropriate status codes
    - _Requirements: 39.1, 39.2, 39.3, 39.5, 39.6_
  
  - [ ]* 13.4 Write unit tests for server routes
    - Test health endpoint
    - Test authentication endpoints
    - Test cluster listing
    - Test proxy routing
    - _Requirements: 39.1, 39.2_

- [x] 14. Implement frontend assets embedding
  - [x] 14.1 Set up rust-embed for frontend assets
    - Add rust-embed dependency
    - Create Assets struct with #[derive(RustEmbed)]
    - Point to frontend build directory
    - _Requirements: 1.1, 1.2_
  
  - [x] 14.2 Implement frontend asset serving
    - Serve embedded assets at root path
    - Handle SPA routing (serve index.html for unknown paths)
    - Set correct MIME types
    - _Requirements: 1.2_
  
  - [ ]* 14.3 Write unit test for asset serving
    - Test serving index.html
    - Test serving static assets
    - Test SPA fallback
    - _Requirements: 1.2_


- [x] 15. Initialize frontend project
  - [x] 15.1 Set up Vite + React + TypeScript
    - Initialize Vite project with React template
    - Configure TypeScript with strict mode
    - Set up build output to backend/assets/
    - Configure Vite proxy for API requests in development
    - _Requirements: 28.1, 28.5_
  
  - [x] 15.2 Install and configure Mantine UI
    - Install @mantine/core, @mantine/hooks, @mantine/notifications
    - Set up MantineProvider with theme configuration
    - Configure color scheme (light/dark/system)
    - _Requirements: 36.1, 36.2, 36.3, 36.9_
  
  - [x] 15.3 Set up routing and state management
    - Install react-router-dom
    - Install zustand for state management
    - Install @tanstack/react-query for API calls
    - Configure basic routing structure
    - _Requirements: None (infrastructure)_

- [x] 16. Implement frontend theme management
  - [x] 16.1 Create theme context and provider
    - Implement ThemeProvider component
    - Support light, dark, and system modes
    - Detect system theme preference
    - Default to system mode
    - _Requirements: 36.1, 36.2, 36.3, 36.4_
  
  - [ ]* 16.2 Write property test for theme persistence
    - **Property 14: Theme Persistence**
    - **Validates: Requirements 36.6, 36.7**
  
  - [x] 16.3 Implement theme selector UI
    - Create theme toggle component
    - Persist theme preference to local storage
    - Restore theme on app load
    - Apply theme changes immediately
    - _Requirements: 36.5, 36.6, 36.7, 36.8_
  
  - [ ]* 16.4 Write unit tests for theme management
    - Test theme switching
    - Test local storage persistence
    - Test system theme detection
    - _Requirements: 36.1, 36.2, 36.3, 36.6, 36.7_


- [x] 17. Implement frontend preferences management
  - [x] 17.1 Create preferences hook
    - Define UserPreferences interface
    - Implement usePreferences hook with local storage
    - Support refresh interval, theme, last cluster, REST history
    - Handle corrupted data gracefully
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.6_
  
  - [ ]* 17.2 Write property test for preferences round-trip
    - **Property 15: User Preferences Round-Trip**
    - **Validates: Requirements 37.1, 37.2, 37.3, 37.4**
  
  - [x] 17.3 Implement preferences reset functionality
    - Add reset preferences method
    - Restore default values
    - _Requirements: 37.5_
  
  - [ ]* 17.4 Write unit tests for preferences management
    - Test storing preferences
    - Test retrieving preferences
    - Test reset functionality
    - Test corrupted data handling
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6_

- [x] 18. Implement API client
  - [x] 18.1 Create API client class
    - Implement login method
    - Implement logout method
    - Implement getClusters method
    - Implement getClusterHealth method
    - Implement proxyRequest method
    - Handle authentication errors (401)
    - Handle authorization errors (403)
    - _Requirements: 21.5, 21.6, 23.4_
  
  - [x] 18.2 Add error handling and retry logic
    - Handle network errors
    - Implement retry with exponential backoff
    - Handle session expiration
    - Redirect to login on 401
    - _Requirements: 25.4_
  
  - [ ]* 18.3 Write unit tests for API client
    - Test successful requests
    - Test error handling
    - Test retry logic
    - Test authentication errors
    - Mock API responses with MSW
    - _Requirements: 21.5, 21.6, 25.4_


- [x] 19. Implement app shell and navigation
  - [x] 19.1 Create AppShell component
    - Implement main layout with header, sidebar, content
    - Add navigation menu
    - Display user information
    - Add logout button
    - Integrate theme selector
    - _Requirements: None (UI structure)_
  
  - [x] 19.2 Implement routing structure
    - Route: / - Dashboard
    - Route: /login - Login page
    - Route: /cluster/:id - Cluster view (redirects to /cluster/:id/overview)
    - Route: /cluster/:id/overview - Cluster overview
    - Route: /cluster/:id/nodes - Nodes list
    - Route: /cluster/:id/indices - Indices list
    - Route: /cluster/:id/indices/create - Create new index
    - Route: /cluster/:id/indices/:name - View index (redirects to settings)
    - Route: /cluster/:id/indices/:name/settings - Index settings editor
    - Route: /cluster/:id/indices/:name/mappings - Index mappings editor
    - Route: /cluster/:id/shards - Shards visualization
    - Route: /cluster/:id/rest - REST console
    - Handle authentication redirects
    - Support browser history and deep linking
    - _Requirements: 3.1, 3.9_
  
  - [ ]* 19.3 Write unit tests for AppShell
    - Test rendering
    - Test navigation
    - Test logout
    - _Requirements: None_

- [x] 20. Implement dashboard component
  - [x] 20.1 Create Dashboard component
    - Fetch cluster health for all clusters
    - Display clusters in table format
    - Show cluster name, health, nodes, shards, indices, documents
    - Handle unreachable clusters
    - Auto-refresh at configurable interval
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.10_
  
  - [ ]* 20.2 Write property test for dashboard cluster display
    - **Property 16: Dashboard Cluster Display**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
  
  - [x] 20.3 Implement dashboard sorting
    - Add sortable table columns
    - Support sorting by name, health, nodes, shards, etc.
    - _Requirements: 3.11_
  
  - [ ]* 20.4 Write property test for dashboard sorting
    - **Property 18: Dashboard Sorting**
    - **Validates: Requirements 3.11**
  
  - [x] 20.5 Implement cluster navigation
    - Handle cluster row clicks
    - Navigate to cluster detail view
    - _Requirements: 3.9_
  
  - [ ]* 20.6 Write property test for dashboard navigation
    - **Property 17: Dashboard Cluster Navigation**
    - **Validates: Requirements 3.9**
  
  - [ ]* 20.7 Write unit tests for dashboard
    - Test cluster display
    - Test sorting
    - Test navigation
    - Test auto-refresh
    - Test error handling
    - _Requirements: 3.2, 3.8, 3.9, 3.10, 3.11_


- [x] 21. Checkpoint - Frontend core working
  - Ensure frontend builds successfully
  - Verify theme switching works
  - Test dashboard displays clusters
  - Verify navigation works
  - Ask the user if questions arise

- [x] 22. Implement cluster overview component
  - [x] 22.1 Create ClusterView component with URL-based navigation
    - Display cluster health and statistics at /cluster/:id/overview
    - Show node count, shard count, index count, document count
    - Display memory and disk usage
    - Auto-refresh at configurable interval
    - Use React Router for navigation between views
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 22.2 Implement node list display at /cluster/:id/nodes
    - Show all nodes in cluster
    - Display node roles, heap usage, disk usage, CPU
    - Support node detail view
    - _Requirements: 4.6, 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [x] 22.3 Implement index list display at /cluster/:id/indices
    - Show all indices in cluster
    - Display index name, health, document count, size
    - Support virtual scrolling for large lists
    - Link to index detail pages
    - _Requirements: 4.7, 31.3_
  
  - [x] 22.4 Implement shard allocation visualization at /cluster/:id/shards
    - Display shard allocation across nodes
    - Visual representation of shard distribution
    - _Requirements: 4.8_
  
  - [ ]* 22.5 Write unit tests for cluster overview
    - Test cluster stats display
    - Test node list
    - Test index list
    - Test auto-refresh
    - Test URL navigation
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 23. Implement index operations
  - [x] 23.1 Create index operations UI
    - Add buttons for open, close, delete, force merge, etc.
    - Show confirmation dialogs for destructive operations
    - Display operation progress
    - Show success/error notifications
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [ ]* 23.2 Write property test for index operations
    - **Property 7: Index Operation Execution**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
  
  - [ ]* 23.3 Write unit tests for index operations
    - Test operation execution
    - Test confirmation dialogs
    - Test progress display
    - Test error handling
    - _Requirements: 5.8, 5.9_


- [x] 24. Implement index management
  - [x] 24.1 Create index creation form
    - Form with name field
    - JSON text editor with syntax highlighting for settings
    - JSON text editor with syntax highlighting for mappings
    - Validate JSON before submission
    - Validate index name format
    - _Requirements: 6.1, 6.2, 6.4, 6.5_
  
  - [ ]* 24.2 Write property test for index name validation
    - **Property 8: Index Name Validation**
    - **Validates: Requirements 6.2**
  
  - [ ]* 24.3 Write property test for JSON validation
    - **Property 9: JSON Validation Before Submission**
    - **Validates: Requirements 6.5, 7.3, 8.3, 13.4**
  
  - [x] 24.4 Implement index settings viewer/editor
    - Fetch and display current settings as JSON
    - JSON text editor for modifications
    - Validate JSON before submission
    - Show informational note about static vs dynamic settings
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  
  - [x] 24.5 Implement index mappings viewer/editor
    - Fetch and display current mappings as JSON
    - JSON text editor for adding/modifying fields
    - Validate JSON before submission
    - Show informational note about mapping restrictions
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.7_
  
  - [ ]* 24.6 Write unit tests for index management
    - Test index creation
    - Test settings editor
    - Test mappings editor
    - Test JSON validation
    - _Requirements: 6.2, 6.5, 7.3, 8.3_

- [x] 25. Implement REST console
  - [x] 25.1 Create REST console component
    - Monaco editor for request input
    - Parse "METHOD endpoint" format
    - Support request body editing
    - Syntax highlighting for JSON
    - _Requirements: 19.1, 19.2, 19.3_
  
  - [ ]* 25.2 Write property test for REST console parsing
    - **Property 10: REST Console Request Parsing**
    - **Validates: Requirements 19.2, 19.4, 19.5**
  
  - [x] 25.3 Implement request execution
    - Execute requests against selected cluster
    - Display response with syntax highlighting
    - Show status code and headers
    - _Requirements: 19.5, 19.6, 19.7_
  
  - [x] 25.4 Implement request history
    - Store requests in local storage
    - Display history in sidebar
    - Populate request from history selection
    - Limit history to configurable max entries
    - Support clearing history
    - _Requirements: 19.8, 19.9, 19.10, 19.11, 19.13_
  
  - [ ]* 25.5 Write property test for history management
    - **Property 11: REST Console History Management**
    - **Validates: Requirements 19.8, 19.10**
  
  - [ ]* 25.6 Write property test for history limit
    - **Property 12: REST Console History Limit**
    - **Validates: Requirements 19.13**
  
  - [x] 25.7 Implement export/import functionality
    - Export request collections to JSON
    - Import request collections from JSON
    - _Requirements: 19.12_
  
  - [ ]* 25.8 Write property test for export/import round-trip
    - **Property 13: REST Console Export/Import Round-Trip**
    - **Validates: Requirements 19.12**
  
  - [ ]* 25.9 Write unit tests for REST console
    - Test request parsing
    - Test execution
    - Test history
    - Test export/import
    - _Requirements: 19.2, 19.4, 19.5, 19.8, 19.10, 19.12, 19.13_


- [x] 26. Checkpoint - Core features working
  - Ensure cluster overview displays correctly
  - Verify index operations work
  - Test index management (create, settings, mappings)
  - Verify REST console works
  - Ask the user if questions arise

- [x] 27. Implement advanced cluster features
  - [x] 27.1 Implement aliases management
    - Display existing aliases
    - Create alias form
    - Support multiple indices per alias
    - Support routing and filter parameters
    - Atomic alias operations
    - Delete aliases
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
  
  - [x] 27.2 Implement templates management
    - Display existing templates
    - Create template form
    - Support legacy and composable templates
    - Delete templates
    - Show template priority and patterns
    - _Requirements: 12.1, 12.2, 12.5, 12.6, 12.7, 12.8_
  
  - [x] 27.3 Implement cluster settings
    - Display persistent and transient settings
    - Distinguish visually between setting types
    - JSON editor for modifications
    - Show default settings
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6_
  
  - [x] 27.4 Implement shard management
    - Display shard allocation
    - Shard relocation UI
    - Show available target nodes
    - Display relocation progress
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_
  
  - [ ]* 27.5 Write unit tests for advanced features
    - Test aliases management
    - Test templates management
    - Test cluster settings
    - Test shard management
    - _Requirements: 11.1, 11.2, 12.1, 12.2, 13.1, 10.1_

- [x] 28. Implement analysis tools
  - [x] 28.1 Create text analysis UI
    - Text input for analysis
    - Analyzer dropdown
    - Display analysis results (tokens, positions, attributes)
    - Support analyzing by field
    - Show analyzer chain
    - Support custom analyzer definitions
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_
  
  - [x] 28.2 Implement index analyzers inspection
    - Display configured analyzers for index
    - Show analyzer components
    - Display all fields with types
    - Show which analyzer is used per field
    - Support field filtering
    - Show field properties
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_
  
  - [ ]* 28.3 Write unit tests for analysis tools
    - Test text analysis
    - Test analyzer inspection
    - Test field inspection
    - _Requirements: 15.1, 15.3, 16.1, 16.3_


- [x] 29. Implement snapshot management
  - [x] 29.1 Create repository management UI
    - Display existing repositories
    - Create repository form
    - Support filesystem, S3, Azure, GCS, HDFS, URL types
    - Validate repository configuration
    - Delete repositories
    - Show repository details
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11_
  
  - [x] 29.2 Implement snapshot management UI
    - Display snapshots in repository
    - Create snapshot form
    - Support index selection
    - Support partial snapshots
    - Display snapshot progress
    - Delete snapshots
    - Restore snapshot with options
    - Show snapshot metadata
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10_
  
  - [ ]* 29.3 Write unit tests for snapshot management
    - Test repository creation
    - Test snapshot creation
    - Test snapshot restore
    - Test error handling
    - _Requirements: 17.2, 17.9, 18.2, 18.5_

- [x] 30. Implement Cat API access
  - [x] 30.1 Create Cat API UI
    - List available Cat API endpoints
    - Display responses in formatted table
    - Support sorting by column
    - Support filtering results
    - Show help text for endpoints
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.7_
  
  - [ ]* 30.2 Write unit tests for Cat API
    - Test endpoint listing
    - Test response display
    - Test sorting
    - Test filtering
    - _Requirements: 20.1, 20.3, 20.4, 20.5_

- [x] 31. Implement node statistics
  - [x] 31.1 Create node detail view
    - Display detailed node statistics
    - Show thread pool statistics
    - Show queue sizes
    - Display JVM version
    - _Requirements: 14.7, 14.8_
  
  - [ ]* 31.2 Write unit tests for node statistics
    - Test statistics display
    - Test data formatting
    - _Requirements: 14.7, 14.8_


- [x] 32. Implement index statistics
  - [x] 32.1 Create index statistics view
    - Display document count, storage size
    - Show indexing statistics
    - Display search statistics
    - Show merge, refresh, flush statistics
    - Display segment information
    - Support time range filtering
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [ ]* 32.2 Write unit tests for index statistics
    - Test statistics display
    - Test time range filtering
    - _Requirements: 9.1, 9.6_

- [x] 33. Implement accessibility features
  - [x] 33.1 Add ARIA labels and semantic HTML
    - Use semantic HTML elements
    - Add ARIA labels to interactive elements
    - Ensure proper heading hierarchy
    - _Requirements: 32.1, 32.2_
  
  - [x] 33.2 Implement keyboard navigation with Mantine Spotlight
    - Install and configure @mantine/spotlight package
    - Implement Spotlight search for navigation (Cmd/Ctrl+K)
    - Add actions for navigating to clusters, indices, and features
    - Support keyboard navigation for all interactive features
    - Maintain focus management for modals and dialogs
    - Add keyboard shortcuts documentation
    - _Requirements: 32.3, 32.4_
  
  - [x] 33.3 Ensure color contrast and screen reader support
    - Verify WCAG AA color contrast
    - Add screen reader announcements
    - Don't rely solely on color
    - _Requirements: 32.5, 32.6, 32.7_
  
  - [ ]* 33.4 Write property test for keyboard navigation
    - **Property 26: Keyboard Navigation Support**
    - **Validates: Requirements 32.3**

- [x] 34. Implement responsive design
  - [x] 34.1 Add responsive layouts
    - Adapt layout for desktop (1920x1080+)
    - Adapt layout for laptop (1366x768+)
    - Adapt layout for tablet (768x1024+)
    - Mobile-friendly navigation
    - Responsive typography
    - Touch targets 44x44px minimum
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6_
  
  - [ ]* 34.2 Write property test for responsive layout
    - **Property 27: Responsive Layout Adaptation**
    - **Validates: Requirements 33.1, 33.2, 33.3, 33.4**


- [x] 35. Checkpoint - All features implemented
  - Ensure all cluster features work
  - Verify snapshot management works
  - Test Cat API access
  - Verify accessibility features
  - Test responsive design
  - Ask the user if questions arise

- [x] 36. Implement error handling and logging
  - [x] 36.1 Add comprehensive backend logging
    - Log all HTTP requests
    - Log authentication attempts
    - Log Elasticsearch API errors
    - Support configurable log levels
    - Use structured logging (JSON)
    - Include request IDs
    - Sanitize sensitive data
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.8, 30.4_
  
  - [x] 36.2 Implement frontend error display
    - User-friendly error messages in notifications
    - Technical details in expandable sections
    - Dismissible errors
    - Console logging for debugging
    - _Requirements: 29.6, 29.7_
  
  - [ ]* 36.3 Write unit tests for error handling
    - Test error logging
    - Test error display
    - Test error propagation
    - _Requirements: 29.1, 29.6_

- [x] 37. Implement security features
  - [x] 37.1 Add security headers
    - Set CSP, HSTS, X-Frame-Options headers
    - Configure CORS
    - _Requirements: 30.1, 30.2, 30.7_
  
  - [x] 37.2 Implement input validation and sanitization
    - Validate all user inputs
    - Sanitize inputs to prevent XSS
    - _Requirements: 30.3, 30.6_
  
  - [x] 37.3 Configure HTTPS with TLS
    - Support TLS certificate configuration
    - Use HTTPS by default
    - _Requirements: 30.1, 30.8_
  
  - [ ]* 37.4 Write unit tests for security features
    - Test header setting
    - Test input validation
    - Test sanitization
    - _Requirements: 30.2, 30.3, 30.6_


- [-] 38. Implement performance optimizations
  - [x] 38.1 Add backend caching
    - Cache cluster metadata
    - Configurable cache duration
    - _Requirements: 31.2_
  
  - [ ]* 38.2 Write property test for cluster metadata caching
    - **Property 24: Cluster Metadata Caching**
    - **Validates: Requirements 31.2**
  
  - [ ] 38.3 Add frontend optimizations
    - Implement virtual scrolling for large lists
    - Lazy-load components
    - Debounce search and filter inputs
    - _Requirements: 31.3, 31.4, 31.7_
  
  - [ ]* 38.4 Write unit tests for performance features
    - Test caching behavior
    - Test virtual scrolling
    - Test debouncing
    - _Requirements: 31.2, 31.7_

- [ ] 39. Create Docker deployment
  - [ ] 39.1 Create Dockerfile
    - Multi-stage build (Rust builder + minimal runtime)
    - Run as non-root user
    - Expose port 9000
    - Add health check
    - _Requirements: 27.1, 27.4, 27.5, 27.6, 27.7_
  
  - [ ] 39.2 Create docker-compose.yml
    - Include Cerebro service
    - Support environment variable configuration
    - Support volume mounts for config
    - _Requirements: 27.2, 27.3_
  
  - [ ]* 39.3 Test Docker deployment
    - Build Docker image
    - Run container
    - Verify health check
    - Test with environment variables
    - _Requirements: 27.1, 27.7_

- [ ] 40. Set up cross-platform builds
  - [ ] 40.1 Create GitHub Actions workflow
    - Build for Linux x86_64 and ARM64
    - Build for macOS x86_64 and ARM64
    - Build for Windows x86_64
    - Run tests on all platforms
    - Create release artifacts
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8_
  
  - [ ] 40.2 Configure release process
    - Tag releases with version numbers
    - Upload binaries as release assets
    - Generate release notes
    - _Requirements: 29.7_


- [ ] 41. Create documentation
  - [ ] 41.1 Write README.md
    - Project overview
    - Features list
    - Installation instructions
    - Quick start guide
    - Configuration examples
    - _Requirements: 26.10_
  
  - [ ] 41.2 Write configuration documentation
    - Document all configuration options
    - Provide examples for each auth mode
    - Document cluster configuration
    - Document TLS configuration
    - Document environment variable overrides
    - _Requirements: 26.10, 41.10_
  
  - [ ] 41.3 Write deployment documentation
    - Docker deployment guide
    - Binary deployment guide
    - Kubernetes deployment guide
    - Security best practices
    - _Requirements: 27.1, 27.2, 27.3_
  
  - [ ] 41.4 Write migration guide
    - Document differences from legacy Cerebro
    - Provide configuration conversion examples
    - Document breaking changes
    - Provide migration steps
    - _Requirements: 34.1, 34.2, 34.4_
  
  - [ ] 41.5 Create API documentation
    - Document all API endpoints
    - Provide request/response examples
    - Document authentication requirements
    - _Requirements: None (developer documentation)_

- [ ] 42. Write integration tests
  - [ ] 42.1 Set up integration test environment
    - Docker compose with Elasticsearch
    - Test configuration files
    - Test data setup
    - _Requirements: None (testing infrastructure)_
  
  - [ ] 42.2 Write backend integration tests
    - Test authentication flows
    - Test cluster connections
    - Test proxy functionality
    - Test with real Elasticsearch
    - _Requirements: 21.1, 21.5, 2.1, 2.14_
  
  - [ ] 42.3 Write E2E tests
    - Test complete user workflows
    - Test authentication
    - Test cluster management
    - Test index operations
    - Test REST console
    - _Requirements: None (E2E testing)_

- [ ] 43. Final checkpoint - Production ready
  - Ensure all tests pass (unit, property, integration, E2E)
  - Verify Docker image builds and runs
  - Test cross-platform binaries
  - Review documentation completeness
  - Verify security features
  - Test performance
  - Ask the user if questions arise

- [ ] 44. Create backward compatibility tool
  - [ ] 44.1 Implement configuration converter
    - Read legacy Cerebro configuration
    - Convert to new YAML format
    - Validate converted configuration
    - _Requirements: 34.5_
  
  - [ ]* 44.2 Write unit tests for converter
    - Test configuration conversion
    - Test validation
    - Test error handling
    - _Requirements: 34.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration and E2E tests validate complete workflows
- The implementation follows a bottom-up approach: infrastructure first, then features
- Backend and frontend can be developed in parallel after core infrastructure is complete
