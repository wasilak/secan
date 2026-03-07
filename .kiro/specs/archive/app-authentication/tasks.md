# Implementation Plan: Application Authentication

## Overview

This implementation plan breaks down the authentication system into discrete, incremental tasks. The approach follows a bottom-up strategy: configuration management first, then authentication providers, session management, and finally middleware integration. Each task builds on previous work, ensuring the system remains functional at every step.

## Tasks

- [x] 1. Set up authentication module structure and dependencies
  - Create `backend/src/auth/` directory structure
  - Add required dependencies to `Cargo.toml`: `bcrypt`, `argon2`, `openidconnect`, `jsonwebtoken`, `rand`, `base64`
  - Create module files: `mod.rs`, `config.rs`, `session.rs`, `provider.rs`, `local.rs`, `oidc.rs`, `open.rs`, `middleware.rs`
  - Define module exports in `mod.rs`
  - _Requirements: All requirements (foundation)_

- [x] 2. Implement configuration structures and loading
  - [x] 2.1 Define configuration data structures
    - Implement `AuthConfig`, `AuthMode`, `LocalAuthConfig`, `LocalUser`, `HashAlgorithm`
    - Implement `OidcConfig`, `SessionConfig`, `RenewalMode`, `SecurityConfig`
    - Add serde derives for deserialization
    - _Requirements: 1.1, 2.1, 2.2, 3.3, 4.1, 6.1, 6.2, 7.7, 8.4, 11.3, 11.4_
  
  - [x] 2.2 Implement ConfigLoader with validation
    - Create `ConfigLoader` struct with file path
    - Implement `load()` method using `config-rs` with environment variable overrides
    - Implement `validate()` method for all authentication modes
    - Implement `validate_local_user()` for local user validation
    - Implement `validate_oidc_config()` for OIDC configuration validation
    - _Requirements: 1.1, 1.5, 1.6, 2.2, 3.2, 3.5, 4.3, 4.4, 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 2.3 Write property test for configuration parsing
    - **Property 5: Configuration Parsing Completeness**
    - **Validates: Requirements 2.1, 2.8, 3.1, 3.3, 3.4, 4.1, 6.1, 6.2**
  
  - [ ]* 2.4 Write property test for environment variable precedence
    - **Property 9: Environment Variable Precedence**
    - **Validates: Requirements 3.2**
  
  - [ ]* 2.5 Write unit tests for configuration validation
    - Test invalid authentication modes
    - Test missing required fields
    - Test invalid password hash formats
    - Test incomplete OIDC configuration
    - _Requirements: 1.6, 2.2, 10.2, 10.3, 10.4_

- [x] 3. Implement session management
  - [x] 3.1 Implement Session and SessionManager structures
    - Define `Session` struct with token, user_info, timestamps
    - Define `UserInfo` struct with id, username, email, roles, groups
    - Create `SessionManager` with RwLock-protected HashMap
    - Implement `generate_token()` with 256 bits of entropy
    - _Requirements: 7.1, 11.2, 11.7_
  
  - [x] 3.2 Implement session lifecycle methods
    - Implement `create_session()` to generate and store sessions
    - Implement `validate_session()` with expiration checking and renewal
    - Implement `delete_session()` for logout
    - Support both sliding window and fixed expiration renewal modes
    - _Requirements: 7.1, 7.5, 7.6, 7.8, 8.1, 8.2, 8.3, 8.4, 9.1_
  
  - [x] 3.3 Implement rate limiter
    - Create `RateLimiter` struct with attempt tracking
    - Implement `check()` method with time window cleanup
    - Integrate rate limiter into SessionManager
    - _Requirements: 11.4_
  
  - [x] 3.4 Implement session cleanup task
    - Create background tokio task for periodic cleanup
    - Remove expired sessions every 60 seconds
    - _Requirements: 8.5_
  
  - [ ]* 3.5 Write property test for session token entropy
    - **Property 16: Session Token Uniqueness and Entropy**
    - **Validates: Requirements 7.1, 11.2, 11.7**
  
  - [ ]* 3.6 Write property test for session validation
    - **Property 18: Session Retrieval and Validation**
    - **Validates: Requirements 7.5, 7.6, 8.3, 9.5**
  
  - [ ]* 3.7 Write property test for session renewal
    - **Property 21: Session Renewal Behavior**
    - **Validates: Requirements 8.1, 8.4**
  
  - [ ]* 3.8 Write unit tests for session management
    - Test session creation and retrieval
    - Test session expiration in both renewal modes
    - Test session deletion
    - Test rate limiting behavior
    - _Requirements: 7.1, 7.5, 7.6, 8.1, 8.2, 9.1, 11.4_

- [x] 4. Checkpoint - Ensure configuration and session tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement authentication provider interface and factory
  - [x] 5.1 Define AuthProvider trait and related types
    - Define `AuthProvider` trait with `authenticate()` and `provider_type()` methods
    - Define `AuthRequest` enum (LocalCredentials, OidcCallback, Open)
    - Define `AuthResponse` struct with user_info and session_token
    - _Requirements: 1.3, 1.4_
  
  - [x] 5.2 Implement AuthProviderFactory
    - Create `AuthProviderFactory` with config and session_manager
    - Implement `create()` method to instantiate providers based on mode
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 6. Implement local authentication provider
  - [x] 6.1 Implement LocalAuthProvider structure
    - Create `LocalAuthProvider` with config, session_manager, and user HashMap
    - Build user lookup HashMap from configuration
    - _Requirements: 2.1, 2.8_
  
  - [x] 6.2 Implement password verification
    - Implement `verify_password()` supporting bcrypt and argon2
    - Use `bcrypt` crate for bcrypt verification
    - Use `argon2` crate for argon2 verification
    - _Requirements: 2.3, 2.4, 2.5_
  
  - [x] 6.3 Implement AuthProvider trait for LocalAuthProvider
    - Implement `authenticate()` method for local credentials
    - Verify password and create session on success
    - Return generic error message on failure
    - _Requirements: 2.5, 2.6, 2.7, 11.5_
  
  - [ ]* 6.4 Write property test for password hashing
    - **Property 7: Password Hash Round Trip**
    - **Validates: Requirements 2.3, 2.4**
  
  - [ ]* 6.5 Write property test for local authentication
    - **Property 8: Local Authentication Correctness**
    - **Validates: Requirements 2.5, 2.6, 2.7**
  
  - [ ]* 6.6 Write unit tests for local authentication
    - Test successful authentication
    - Test invalid username
    - Test invalid password
    - Test generic error messages
    - _Requirements: 2.5, 2.6, 2.7, 11.5_

- [x] 7. Implement OIDC authentication provider
  - [x] 7.1 Implement OidcAuthProvider structure
    - Create `OidcAuthProvider` with config, session_manager, client, and jwks
    - Use `openidconnect` crate for OIDC client
    - Support both auto-discovery and manual configuration
    - Fetch and cache JWKS at initialization
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 7.2 Implement authorization URL generation
    - Implement `authorization_url()` method
    - Generate URL with CSRF token and required scopes (openid, profile, email)
    - _Requirements: 5.1_
  
  - [x] 7.3 Implement token exchange and validation
    - Implement `authenticate()` for OIDC callback
    - Exchange authorization code for tokens
    - Validate ID token signature using JWKS
    - Extract user information from token claims
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  
  - [x] 7.4 Implement group-based access control
    - Implement `validate_groups()` method
    - Extract group claim from token
    - Check user membership in required groups
    - Return descriptive error if access denied
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [x] 7.5 Complete OIDC authentication flow
    - Create session on successful authentication
    - Return session token in response
    - _Requirements: 5.6_
  
  - [ ]* 7.6 Write property test for group-based access control
    - **Property 15: Group-Based Access Control**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.7**
  
  - [ ]* 7.7 Write unit tests for OIDC authentication
    - Test authorization URL generation
    - Test token validation with mock JWKS
    - Test group validation with various configurations
    - Test error handling for missing claims
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 6.3, 6.4, 6.5, 6.6_

- [x] 8. Implement open authentication provider
  - [x] 8.1 Implement OpenAuthProvider
    - Create `OpenAuthProvider` with session_manager
    - Implement `authenticate()` to create default dev user session
    - _Requirements: 1.2_
  
  - [ ]* 8.2 Write unit test for open authentication
    - Test that open mode creates dev user session
    - _Requirements: 1.2_

- [x] 9. Checkpoint - Ensure all authentication provider tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement authentication middleware
  - [x] 10.1 Implement AuthMiddleware structure
    - Create `AuthMiddleware` with session_manager and config
    - _Requirements: 7.5, 7.6_
  
  - [x] 10.2 Implement authentication middleware logic
    - Implement `authenticate()` middleware function
    - Skip authentication for open mode
    - Skip authentication for public endpoints (login, OIDC callback)
    - Extract session token from cookies
    - Validate session and add user info to request extensions
    - Return 401 Unauthorized for invalid sessions
    - _Requirements: 1.2, 7.5, 7.6_
  
  - [x] 10.3 Implement cookie extraction helper
    - Implement `extract_session_token()` to parse cookies
    - Support configurable cookie name
    - _Requirements: 7.2_
  
  - [ ]* 10.4 Write unit tests for middleware
    - Test open mode bypass
    - Test public endpoint bypass
    - Test valid session authentication
    - Test invalid session rejection
    - Test missing cookie rejection
    - _Requirements: 1.2, 7.5, 7.6_

- [x] 11. Implement authentication API routes
  - [x] 11.1 Create authentication route handlers
    - Create `backend/src/routes/auth.rs`
    - Implement `POST /api/auth/login` for local authentication
    - Implement `GET /api/auth/oidc/login` to initiate OIDC flow
    - Implement `GET /api/auth/oidc/callback` to handle OIDC callback
    - Implement `POST /api/auth/logout` for logout
    - _Requirements: 2.6, 5.1, 5.2, 9.1, 9.2, 9.4_
  
  - [x] 11.2 Implement cookie handling in route handlers
    - Set session cookie with HttpOnly, Secure, and SameSite attributes
    - Clear session cookie on logout
    - Support configurable cookie settings from SessionConfig
    - _Requirements: 7.2, 7.3, 7.4, 9.2_
  
  - [x] 11.3 Implement error responses
    - Return appropriate HTTP status codes
    - Return JSON error responses with generic messages
    - Log detailed errors server-side
    - _Requirements: 2.7, 5.5, 6.4, 6.5, 11.5, 12.1, 12.2_
  
  - [ ]* 11.4 Write property test for cookie security attributes
    - **Property 17: Session Cookie Security Attributes**
    - **Validates: Requirements 7.2, 7.3, 7.4**
  
  - [ ]* 11.5 Write integration tests for authentication routes
    - Test local login flow end-to-end
    - Test OIDC login initiation
    - Test logout flow
    - Test cookie handling
    - _Requirements: 2.6, 2.7, 5.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.4_

- [x] 12. Integrate authentication into main application
  - [x] 12.1 Update main.rs to load authentication configuration
    - Load AuthConfig using ConfigLoader
    - Handle configuration validation errors
    - Log active authentication mode
    - _Requirements: 10.1, 10.5, 10.6_
  
  - [x] 12.2 Initialize authentication components
    - Create SessionManager with configuration
    - Create AuthProviderFactory
    - Create authentication provider based on mode
    - _Requirements: 1.1, 1.3, 1.4_
  
  - [x] 12.3 Register authentication middleware
    - Add AuthMiddleware to Axum router
    - Apply middleware to protected routes
    - Exclude public routes (login, OIDC endpoints)
    - _Requirements: 7.5, 7.6_
  
  - [x] 12.4 Register authentication routes
    - Add authentication routes to Axum router
    - Mount routes at `/api/auth/`
    - _Requirements: 2.6, 5.1, 5.2, 9.1, 9.4_

- [-] 13. Implement logging and security features
  - [x] 13.1 Add authentication event logging
    - Log successful authentication with username and IP
    - Log failed authentication attempts with reason
    - Log session creation and expiration
    - Log OIDC provider communication errors
    - Never log passwords or full session tokens
    - _Requirements: 11.1, 12.1, 12.2, 12.4, 12.5_
  
  - [ ] 13.2 Implement log level configuration
    - Support configurable log levels for auth events
    - Use appropriate log levels (ERROR, WARN, INFO, DEBUG)
    - _Requirements: 12.6_
  
  - [ ]* 13.3 Write property test for sensitive data protection
    - **Property 28: Sensitive Data Protection**
    - **Validates: Requirements 11.1**
  
  - [ ]* 13.4 Write unit tests for logging
    - Test that passwords are never logged
    - Test that session tokens are truncated in logs
    - Test log level configuration
    - _Requirements: 11.1, 12.6_

- [ ] 14. Add example configuration files
  - [ ] 14.1 Create example config.yaml with authentication settings
    - Add examples for all three authentication modes
    - Include comments explaining each setting
    - Add example local users with bcrypt hashes
    - Add example OIDC configuration
    - _Requirements: 1.1, 2.1, 4.1, 6.1, 7.7_
  
  - [ ] 14.2 Create .env.example with environment variable examples
    - Document all authentication environment variables
    - Show examples for local users and OIDC configuration
    - _Requirements: 3.1, 3.3_
  
  - [ ] 14.3 Update README with authentication documentation
    - Document authentication modes and configuration
    - Provide examples for each authentication mode
    - Document environment variable overrides
    - Document OIDC setup with common providers
    - _Requirements: All requirements (documentation)_

- [ ] 15. Final checkpoint - Ensure all tests pass and application builds
  - Run `cargo fmt` to format code
  - Run `cargo clippy` to check for warnings
  - Run `cargo build` to verify build succeeds
  - Run `cargo test` to verify all tests pass
  - Test application startup with each authentication mode
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and integration points
- The implementation follows a bottom-up approach: configuration → session management → providers → middleware → routes → integration
- OIDC integration may require additional testing with real identity providers (Keycloak, Auth0, Okta)
