# Implementation Plan: LDAP Authentication

## Overview

This implementation plan adds LDAP authentication support to the application as a third authentication provider alongside local user and OIDC authentication. The implementation uses the ldap3 Rust crate for LDAP protocol communication and follows the existing AuthProvider trait pattern for seamless integration with the authentication infrastructure.

The implementation follows a direct login flow (username/password form submission) similar to local authentication, supports flexible group membership queries with optional required group enforcement, and includes comprehensive security measures including LDAP injection prevention and rate limiting integration.

## Tasks

- [x] 1. Add LDAP dependencies and configuration structures
  - Add ldap3 crate dependency to backend/Cargo.toml with TLS features
  - Create LdapConfig struct with all configuration parameters (server_url, bind_dn, bind_password, search parameters, group mapping, TLS settings, attribute mappings)
  - Create TlsMode enum with None, StartTls, and Ldaps variants
  - Add default functions for configuration fields (timeout, TLS mode, attribute names)
  - Extend AuthMode enum to include Ldap variant
  - Extend AuthConfig struct to include optional ldap field
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 7.1_

- [ ]* 1.1 Write property test for configuration validation
  - **Property 1: Configuration Validation Rejects Invalid Configurations**
  - **Validates: Requirements 6.2, 6.3, 6.4, 6.7, 6.8**
  - Test that invalid configurations (empty bind DN, empty password, invalid URL scheme, zero timeout, missing required fields) are rejected with descriptive errors

- [x] 2. Implement configuration validation
  - Create validate_config function that checks all LdapConfig parameters
  - Validate server URL has ldap:// or ldaps:// scheme
  - Validate bind_dn and bind_password are not empty
  - Validate connection_timeout_seconds is positive
  - Validate either user_dn_pattern OR (search_base AND search_filter) is configured
  - Validate group mapping configuration (both group_search_base and group_search_filter required if either is present)
  - Return descriptive error messages for each validation failure
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ]* 2.1 Write unit tests for configuration validation
  - Test empty bind_dn rejection
  - Test empty bind_password rejection
  - Test invalid URL scheme rejection
  - Test zero timeout rejection
  - Test missing user search configuration rejection
  - Test incomplete group mapping configuration rejection
  - _Requirements: 6.2, 6.3, 6.4, 6.7, 6.8_

- [x] 3. Implement LDAP input sanitization
  - Create sanitize_ldap_input function that escapes LDAP special characters
  - Escape backslash (\) to \5c
  - Escape asterisk (*) to \2a
  - Escape left parenthesis (() to \28
  - Escape right parenthesis ()) to \29
  - Escape null byte (\0) to \00
  - Follow RFC 4515 escaping rules
  - _Requirements: 8.7_

- [ ]* 3.1 Write property test for LDAP injection prevention
  - **Property 9: LDAP Injection Prevention Through Input Sanitization**
  - **Validates: Requirements 8.7**
  - Test that any input containing LDAP special characters is properly escaped

- [ ]* 3.2 Write unit tests for LDAP injection prevention
  - Test escaping of asterisk in "user*"
  - Test escaping of parentheses in "(admin)"
  - Test escaping of backslash in "user\name"
  - Test escaping of null byte
  - Test combination of multiple special characters
  - _Requirements: 8.7_

- [x] 4. Implement LdapAuthProvider structure and initialization
  - Create LdapAuthProvider struct with config, session_manager, and ldap_pool fields
  - Implement new() constructor that validates configuration
  - Create LdapConnSettings with configured timeout
  - Configure TLS mode (None, StartTLS, or LDAPS) based on config
  - Set TLS certificate verification based on tls_skip_verify flag
  - Create LdapConnPool with server URL and settings
  - Test connectivity by getting connection and binding with service account
  - Return descriptive error if LDAP server is unreachable
  - Log successful initialization
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.6, 3.7, 3.8_

- [ ]* 4.1 Write unit tests for provider initialization
  - Test successful initialization with valid configuration
  - Test initialization failure with unreachable server
  - Test initialization failure with invalid service account credentials
  - Test TLS mode configuration (None, StartTLS, LDAPS)
  - Test connection pool creation
  - _Requirements: 3.6, 3.7, 3.8_

- [x] 5. Checkpoint - Ensure configuration and initialization work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement service account binding
  - Create bind_service_account async method
  - Perform simple_bind with configured bind_dn and bind_password
  - Log detailed error on bind failure
  - Return generic "LDAP connection failed" error to prevent information disclosure
  - _Requirements: 4.1, 4.8_

- [x] 7. Implement user search functionality
  - Create search_user async method that takes connection and username
  - Sanitize username input using sanitize_ldap_input
  - If user_dn_pattern is configured, construct user DN and perform base search
  - If search_base and search_filter are configured, perform subtree search
  - Replace {username} placeholder in search filter with sanitized username
  - Apply connection timeout to search operation
  - Return SearchEntry with user DN and attributes
  - Return error if user not found
  - Log warning if multiple users found
  - _Requirements: 4.2, 2.5, 2.6, 2.7, 8.7, 9.3_

- [ ]* 7.1 Write unit tests for user search
  - Test user search with user_dn_pattern (direct DN construction)
  - Test user search with search_base and search_filter
  - Test username sanitization in search filter
  - Test user not found scenario
  - Test multiple users found scenario
  - Test search timeout
  - _Requirements: 4.2, 2.5, 2.6, 2.7_

- [x] 8. Implement user authentication (bind)
  - Create authenticate_user async method that takes connection, user DN, and password
  - Perform simple_bind with user DN and password
  - Apply connection timeout to bind operation
  - Return true if bind succeeds
  - Return false if bind fails (don't propagate error details)
  - Log bind success/failure at debug level
  - _Requirements: 4.3, 9.3_

- [ ]* 8.1 Write unit tests for user authentication
  - Test successful user bind
  - Test failed user bind (invalid password)
  - Test bind timeout
  - _Requirements: 4.3, 9.3_

- [x] 9. Implement user attribute extraction
  - Create extract_user_info method that takes user DN, SearchEntry, and groups
  - Extract username from configured username_attribute (default: "uid")
  - Extract email from configured email_attribute (default: "mail")
  - Extract display name from configured display_name_attribute (default: "cn")
  - Use user DN as the user ID
  - Use empty/default values for missing attributes
  - Return UserInfo struct with extracted data
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 9.1 Write property test for attribute extraction
  - **Property 4: User Attribute Extraction Uses Configured Attribute Names**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
  - Test that extraction uses configured attribute names and DN as user ID

- [ ]* 9.2 Write property test for missing attributes
  - **Property 5: Missing Attributes Are Handled Gracefully**
  - **Validates: Requirements 10.5**
  - Test that missing attributes don't cause errors and use default values

- [ ]* 9.3 Write unit tests for attribute extraction
  - Test extraction with all attributes present
  - Test extraction with missing email attribute
  - Test extraction with missing display name attribute
  - Test fallback to CN from DN when username attribute missing
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 10. Implement group membership queries
  - Create get_user_groups async method that takes connection, user DN, and user entry
  - Implement direct group membership query (search groups where user is member)
  - If group_search_base and group_search_filter configured, search for groups
  - Replace {user_dn} placeholder in group search filter
  - Extract group names (CN) from group entries
  - Implement reverse group membership query (user entry contains group DNs)
  - If user_group_attribute configured, extract group DNs from user entry
  - Parse CNs from group DNs
  - Combine groups from both methods
  - Return vector of group names
  - Log group query results at debug level
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 2.8, 2.9, 2.10_

- [ ]* 10.1 Write property test for group extraction
  - **Property 6: Group Membership Extraction Produces Group Names**
  - **Validates: Requirements 5.4, 5.5**
  - Test that group extraction produces group names (not full DNs)

- [ ]* 10.2 Write unit tests for group membership queries
  - Test direct group membership query (member attribute)
  - Test reverse group membership query (user's group attribute)
  - Test CN extraction from group DNs
  - Test empty group list when no groups configured
  - Test combination of both query methods
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 11. Implement required group validation
  - Create validate_required_groups method that takes user groups
  - If required_groups is empty, return success (allow all authenticated users)
  - Check if user is member of at least one required group
  - Return success if user has required group membership
  - Return access denied error if user lacks required group membership
  - Log validation failure with required and actual groups
  - _Requirements: 5.6, 5.7, 5.8_

- [ ]* 11.1 Write property test for required group validation
  - **Property 7: Required Group Validation Enforces Access Control**
  - **Validates: Requirements 5.6**
  - Test that authentication succeeds only when user has at least one required group

- [ ]* 11.2 Write unit tests for required group validation
  - Test validation success with matching group
  - Test validation failure without matching group
  - Test validation success with empty required_groups (allow all)
  - Test validation with multiple required groups
  - _Requirements: 5.6, 5.7, 5.8_

- [x] 12. Checkpoint - Ensure core LDAP operations work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement AuthProvider trait for LdapAuthProvider
  - Implement authenticate async method
  - Extract username and password from AuthRequest::LocalCredentials
  - Return error for non-LocalCredentials request types
  - Check rate limit using session_manager.check_rate_limit
  - Return rate limit error if exceeded
  - Get connection from LDAP pool
  - Bind with service account
  - Search for user
  - Authenticate user by binding with their credentials
  - Re-bind with service account for group queries
  - Query user's group memberships
  - Validate required groups
  - Extract user information
  - Create session using session_manager.create_session
  - Return AuthResponse with UserInfo and session token
  - Return generic "Invalid credentials" error for all authentication failures
  - Log authentication success with username and groups
  - Log authentication failures with details for administrators
  - Implement provider_type method returning "ldap"
  - _Requirements: 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 8.1, 8.2, 8.3, 8.4_

- [ ]* 13.1 Write property test for generic error messages
  - **Property 2: Authentication Failures Return Generic Error Messages**
  - **Validates: Requirements 4.8, 4.9, 4.10, 8.1, 8.5**
  - Test that all failure scenarios return same generic error message

- [ ]* 13.2 Write property test for successful authentication
  - **Property 3: Successful Authentication Creates Complete UserInfo**
  - **Validates: Requirements 4.5, 4.7**
  - Test that successful authentication returns complete UserInfo with session token

- [ ]* 13.3 Write property test for session creation
  - **Property 14: Session Creation After Successful Authentication**
  - **Validates: Requirements 4.6**
  - Test that session is created and token is included in AuthResponse

- [ ]* 13.4 Write property test for rate limiting
  - **Property 8: Rate Limiting Prevents Brute Force Attacks**
  - **Validates: Requirements 8.3**
  - Test that excessive authentication attempts are rejected with rate limit error

- [ ]* 13.5 Write property test for connection timeout
  - **Property 10: Connection Timeout Enforcement**
  - **Validates: Requirements 9.3**
  - Test that operations exceeding timeout fail with timeout error

- [ ]* 13.6 Write property test for success logging
  - **Property 11: Authentication Success Logging Contains User Details**
  - **Validates: Requirements 4.12**
  - Test that successful authentication logs username and groups

- [ ]* 13.7 Write property test for failure logging
  - **Property 12: Authentication Failure Logging Contains Administrative Details**
  - **Validates: Requirements 4.11, 8.2**
  - Test that failed authentication logs detailed error information

- [ ]* 13.8 Write property test for connection error logging
  - **Property 13: Connection Error Logging For Troubleshooting**
  - **Validates: Requirements 8.6**
  - Test that connection errors are logged with details

- [ ]* 13.9 Write unit tests for authentication flow
  - Test successful authentication with valid credentials
  - Test authentication failure with invalid password
  - Test authentication failure with non-existent user
  - Test authentication failure with service account bind failure
  - Test rate limit enforcement
  - Test required group validation during authentication
  - Test invalid request type rejection
  - Test session creation after successful authentication
  - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 8.3_

- [x] 14. Extend AuthProviderFactory to support LDAP mode
  - Update AuthProviderFactory::create method to handle AuthMode::Ldap
  - Extract ldap configuration from AuthConfig
  - Return error if LDAP mode selected but configuration missing
  - Create LdapAuthProvider instance with configuration and session_manager
  - Return boxed LdapAuthProvider as Box<dyn AuthProvider>
  - _Requirements: 7.2, 7.3_

- [ ]* 14.1 Write unit tests for factory integration
  - Test factory creates LdapAuthProvider when mode is Ldap
  - Test factory returns error when LDAP mode selected but config missing
  - Test factory returns correct provider_type
  - _Requirements: 7.2, 7.3_

- [x] 15. Update configuration loading and validation
  - Update configuration loader to parse ldap section from config file
  - Call validate_ldap_config when auth mode is Ldap
  - Ensure LDAP configuration is validated at startup
  - Return descriptive errors for configuration validation failures
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ]* 15.1 Write unit tests for configuration loading
  - Test loading valid LDAP configuration from YAML
  - Test configuration validation at startup
  - Test error when LDAP mode selected without configuration
  - Test default values for optional configuration fields
  - _Requirements: 6.1, 2.11, 2.12, 2.13_

- [x] 16. Checkpoint - Ensure integration with authentication infrastructure works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Add integration tests with mock LDAP server
  - Create mock LDAP server for integration testing
  - Test complete authentication flow with mock server
  - Test TLS/StartTLS connections
  - Test connection timeout scenarios
  - Test service account bind failures
  - Test user search scenarios (found, not found, multiple results)
  - Test user bind scenarios (success, failure)
  - Test group membership queries (direct and reverse)
  - Test required group validation
  - Test rate limiting integration
  - _Requirements: All requirements_

- [x] 18. Create example LDAP configuration
  - Create example configuration file showing LDAP setup
  - Document all configuration parameters with comments
  - Include examples for OpenLDAP, Active Directory, and FreeIPA
  - Show TLS configuration options
  - Show group mapping configuration
  - Show required groups configuration
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13_

- [x] 19. Update authentication documentation
  - Document LDAP authentication mode in README or docs
  - Explain configuration parameters
  - Provide setup instructions for common LDAP servers
  - Document security considerations (TLS, certificate validation)
  - Document troubleshooting steps
  - Include example configurations
  - _Requirements: All requirements_

- [~] 20. Final checkpoint - Ensure all tests pass and documentation is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Integration tests verify the complete authentication flow with a mock LDAP server
- The implementation follows the existing authentication infrastructure patterns for seamless integration
- Security is a primary concern: LDAP injection prevention, generic error messages, rate limiting, and TLS support are all included
- The ldap3 crate provides connection pooling, async support, and TLS capabilities out of the box
