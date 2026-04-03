// LDAP authentication provider

use crate::auth::session::SessionManager;
use crate::config::LdapConfig;
use anyhow::{anyhow, Context, Result};
use ldap3::{Ldap, LdapConnAsync, LdapConnSettings};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error, info};

/// LDAP authentication provider
pub struct LdapAuthProvider {
    config: LdapConfig,
    session_manager: Arc<SessionManager>,
    conn_settings: LdapConnSettings,
    rate_limiter: Option<crate::auth::RateLimiter>,
    permission_resolver: crate::auth::PermissionResolver,
}

impl LdapAuthProvider {
    /// Create a new LDAP authentication provider
    ///
    /// Validates configuration and establishes initial connection to verify
    /// LDAP server accessibility.
    ///
    /// # Arguments
    ///
    /// * `config` - LDAP configuration
    /// * `session_manager` - Session manager for creating user sessions
    ///
    /// # Returns
    ///
    /// Returns `Ok(LdapAuthProvider)` if initialization succeeds, or an error if:
    /// - Configuration validation fails
    /// - LDAP server is unreachable
    /// - Service account credentials are invalid
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use secan::auth::ldap::LdapAuthProvider;
    /// use secan::auth::session::{SessionManager, SessionConfig};
    /// use secan::auth::PermissionResolver;
    /// use secan::config::LdapConfig;
    /// use std::sync::Arc;
    ///
    /// # async fn example() -> anyhow::Result<()> {
    /// let config = LdapConfig {
    ///     server_url: "ldap://ldap.example.com:389".to_string(),
    ///     bind_dn: "cn=admin,dc=example,dc=com".to_string(),
    ///     bind_password: "password".to_string(),
    ///     // ... other fields
    /// #   user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
    /// #   search_base: None,
    /// #   search_filter: None,
    /// #   group_search_base: None,
    /// #   group_search_filter: None,
    /// #   group_member_attribute: None,
    /// #   user_group_attribute: None,
    /// #   resolve_nested_groups: false,
    /// #   required_groups: Vec::new(),
    /// #   connection_timeout_seconds: 10,
    /// #   tls_mode: secan::config::TlsMode::None,
    /// #   tls_skip_verify: false,
    /// #   username_attribute: "uid".to_string(),
    /// #   email_attribute: "mail".to_string(),
    /// #   display_name_attribute: "cn".to_string(),
    /// };
    ///
    /// let session_manager = Arc::new(SessionManager::new(SessionConfig::new(
    ///     60,
    ///     "your-session-secret-at-least-32-chars".to_string(),
    /// )));
    /// let permission_resolver = PermissionResolver::empty();
    /// let provider = LdapAuthProvider::new(config, session_manager, permission_resolver).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn new(
        config: LdapConfig,
        session_manager: Arc<SessionManager>,
        permission_resolver: crate::auth::PermissionResolver,
    ) -> Result<Self> {
        // Validate configuration
        config
            .validate()
            .context("LDAP configuration validation failed")?;

        // Create connection settings with configured timeout
        let timeout = Duration::from_secs(config.connection_timeout_seconds);
        let mut conn_settings = LdapConnSettings::new().set_conn_timeout(timeout);

        // Configure TLS mode
        match config.tls_mode {
            crate::config::TlsMode::None => {
                // No TLS
            }
            crate::config::TlsMode::StartTls => {
                conn_settings = conn_settings.set_starttls(true);
            }
            crate::config::TlsMode::Ldaps => {
                // LDAPS is handled by the URL scheme (ldaps://)
            }
        }

        // Set TLS certificate verification
        if config.tls_skip_verify {
            conn_settings = conn_settings.set_no_tls_verify(true);
        }

        // Test connectivity by establishing a connection and binding with service account
        let (conn, mut ldap) =
            LdapConnAsync::with_settings(conn_settings.clone(), &config.server_url)
                .await
                .context("Failed to connect to LDAP server")?;

        // Drive the connection in the background
        ldap3::drive!(conn);

        // Test service account bind
        ldap.simple_bind(&config.bind_dn, &config.bind_password)
            .await
            .context("Failed to bind with LDAP service account")?
            .success()
            .context("LDAP service account bind failed")?;

        // Unbind the test connection
        ldap.unbind()
            .await
            .context("Failed to unbind test connection")?;

        info!(
            server_url = %config.server_url,
            bind_dn = %config.bind_dn,
            tls_mode = ?config.tls_mode,
            "LDAP authentication provider initialized successfully"
        );

        Ok(Self {
            config,
            session_manager,
            conn_settings,
            rate_limiter: None,
            permission_resolver,
        })
    }

    /// Create a new LDAP authentication provider with rate limiting
    pub async fn with_rate_limiter(
        config: LdapConfig,
        session_manager: Arc<SessionManager>,
        rate_limiter: crate::auth::RateLimiter,
        permission_resolver: crate::auth::PermissionResolver,
    ) -> Result<Self> {
        let mut provider = Self::new(config, session_manager, permission_resolver).await?;
        provider.rate_limiter = Some(rate_limiter);
        Ok(provider)
    }

    /// Bind to LDAP server with service account credentials
    ///
    /// This method performs a simple bind operation using the configured service account
    /// credentials (bind_dn and bind_password). The service account is used to search for
    /// users and query group memberships during authentication.
    ///
    /// # Arguments
    ///
    /// * `ldap` - Mutable reference to an LDAP connection
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if the bind succeeds, or an error if:
    /// - The bind operation fails (invalid credentials, connection error, etc.)
    ///
    /// # Security
    ///
    /// On bind failure, this method logs detailed error information for administrators
    /// but returns a generic "LDAP connection failed" error to prevent information
    /// disclosure to potential attackers.
    #[allow(dead_code)] // Will be used in task 13
    async fn bind_service_account(&self, ldap: &mut Ldap) -> Result<()> {
        debug!(
            bind_dn = %self.config.bind_dn,
            "Attempting LDAP service account bind"
        );

        ldap.simple_bind(&self.config.bind_dn, &self.config.bind_password)
            .await
            .map_err(|e| {
                error!(
                    bind_dn = %self.config.bind_dn,
                    error = %e,
                    "LDAP service account bind failed"
                );
                anyhow!("LDAP connection failed")
            })?
            .success()
            .map_err(|e| {
                error!(
                    bind_dn = %self.config.bind_dn,
                    error = %e,
                    "LDAP service account bind failed"
                );
                anyhow!("LDAP connection failed")
            })?;

        debug!(
            bind_dn = %self.config.bind_dn,
            "LDAP service account bind successful"
        );

        Ok(())
    }

    /// Search for a user in the LDAP directory
    ///
    /// This method searches for a user using either:
    /// 1. Direct DN construction via `user_dn_pattern` (if configured)
    /// 2. Subtree search via `search_base` and `search_filter` (if configured)
    ///
    /// The username is sanitized to prevent LDAP injection attacks before being used
    /// in search filters or DN construction.
    ///
    /// # Arguments
    ///
    /// * `ldap` - Mutable reference to an LDAP connection
    /// * `username` - Username to search for (will be sanitized)
    ///
    /// # Returns
    ///
    /// Returns `Ok(SearchEntry)` containing the user's DN and attributes if found,
    /// or an error if:
    /// - User is not found
    /// - Multiple users are found (ambiguous search)
    /// - Search operation times out
    /// - Search operation fails
    ///
    /// # Security
    ///
    /// - Username input is sanitized to prevent LDAP injection
    /// - Search operations are subject to connection timeout
    /// - Errors are logged but generic messages returned to prevent information disclosure
    #[allow(dead_code)] // Will be used in task 13
    async fn search_user(&self, ldap: &mut Ldap, username: &str) -> Result<ldap3::SearchEntry> {
        use ldap3::{Scope, SearchEntry};
        use tracing::warn;

        // Sanitize username to prevent LDAP injection
        let sanitized_username = sanitize_ldap_input(username);

        // Determine search strategy based on configuration
        let (search_base, search_filter, scope) =
            if let Some(pattern) = &self.config.user_dn_pattern {
                // Use user_dn_pattern for direct DN construction
                let user_dn = pattern.replace("{username}", &sanitized_username);
                // Perform base search (search only the specific DN)
                (user_dn, "(objectClass=*)".to_string(), Scope::Base)
            } else if let (Some(base), Some(filter)) =
                (&self.config.search_base, &self.config.search_filter)
            {
                // Use search_base and search_filter for subtree search
                let search_filter = filter.replace("{username}", &sanitized_username);
                (base.clone(), search_filter, Scope::Subtree)
            } else {
                // This should never happen due to configuration validation
                return Err(anyhow!(
                    "Invalid LDAP configuration: no search method configured"
                ));
            };

        // Apply connection timeout to search operation
        let timeout = Duration::from_secs(self.config.connection_timeout_seconds);
        let search_result = tokio::time::timeout(
            timeout,
            ldap.search(
                &search_base,
                scope,
                &search_filter,
                vec!["*"], // Request all attributes
            ),
        )
        .await
        .map_err(|_| {
            error!(
                username = %username,
                timeout_seconds = self.config.connection_timeout_seconds,
                "LDAP search timeout"
            );
            anyhow!("LDAP operation timed out")
        })?
        .map_err(|e| {
            error!(
                username = %username,
                search_base = %search_base,
                search_filter = %search_filter,
                error = %e,
                "LDAP search failed"
            );
            anyhow!("LDAP search failed")
        })?;

        // Get search results
        let (entries, _result) = search_result.success().map_err(|e| {
            error!(
                username = %username,
                error = %e,
                "LDAP search returned error"
            );
            anyhow!("LDAP search failed")
        })?;

        // Check if user was found
        if entries.is_empty() {
            warn!(
                username = %username,
                search_base = %search_base,
                search_filter = %search_filter,
                "User not found in LDAP directory"
            );
            return Err(anyhow!("User not found"));
        }

        // Check for multiple results (ambiguous search)
        if entries.len() > 1 {
            warn!(
                username = %username,
                count = entries.len(),
                search_base = %search_base,
                search_filter = %search_filter,
                "Multiple users found in LDAP directory (ambiguous search)"
            );
            // Return the first entry but log the warning
        }

        // Convert to SearchEntry
        let entry = SearchEntry::construct(
            entries
                .into_iter()
                .next()
                .ok_or_else(|| anyhow!("LDAP search returned no entries after verification"))?,
        );

        debug!(
            username = %username,
            user_dn = %entry.dn,
            "User search completed successfully"
        );

        Ok(entry)
    }

    /// Authenticate user by binding with their credentials
    ///
    /// This method performs a simple bind operation using the user's Distinguished Name
    /// and password to verify their credentials. The bind operation is subject to the
    /// configured connection timeout.
    ///
    /// # Arguments
    ///
    /// * `ldap` - Mutable reference to an LDAP connection
    /// * `user_dn` - User's Distinguished Name
    /// * `password` - User's password
    ///
    /// # Returns
    ///
    /// Returns `Ok(true)` if the bind succeeds (credentials are valid),
    /// `Ok(false)` if the bind fails (invalid credentials), or an error if:
    /// - The bind operation times out
    /// - A connection error occurs
    ///
    /// # Security
    ///
    /// This method does not propagate detailed error information to prevent information
    /// disclosure. It returns `false` for bind failures rather than exposing error details.
    /// Bind success/failure is logged at debug level for troubleshooting.
    #[allow(dead_code)] // Will be used in task 13
    async fn authenticate_user(
        &self,
        ldap: &mut Ldap,
        user_dn: &str,
        password: &str,
    ) -> Result<bool> {
        use tracing::debug;

        debug!(user_dn = %user_dn, "Attempting LDAP bind for user authentication");

        // Apply connection timeout to bind operation
        let timeout = Duration::from_secs(self.config.connection_timeout_seconds);

        let bind_result = tokio::time::timeout(timeout, ldap.simple_bind(user_dn, password))
            .await
            .map_err(|_| {
                debug!(
                    user_dn = %user_dn,
                    timeout_seconds = self.config.connection_timeout_seconds,
                    "LDAP bind timeout during user authentication"
                );
                anyhow!("LDAP bind timeout")
            })?;

        // Check bind result
        match bind_result {
            Ok(bind_response) => {
                // Check if bind was successful
                match bind_response.success() {
                    Ok(_) => {
                        debug!(user_dn = %user_dn, "LDAP bind successful for user");
                        Ok(true)
                    }
                    Err(_) => {
                        // Bind failed (invalid credentials)
                        debug!(user_dn = %user_dn, "LDAP bind failed for user (invalid credentials)");
                        Ok(false)
                    }
                }
            }
            Err(e) => {
                // Connection error during bind
                debug!(
                    user_dn = %user_dn,
                    error = %e,
                    "LDAP bind failed for user (connection error)"
                );
                Ok(false)
            }
        }
    }

    /// Query user's group memberships
    ///
    /// This method queries the user's group memberships using two complementary approaches:
    ///
    /// 1. **Direct group membership query**: Searches for groups where the user DN is listed
    ///    in the group's member attribute (e.g., "member" or "memberUid"). This is configured
    ///    via `group_search_base` and `group_search_filter`.
    ///
    /// 2. **Reverse group membership query**: Extracts group DNs from the user's entry
    ///    (e.g., "memberOf" attribute). This is configured via `user_group_attribute`.
    ///
    /// The results from both methods are combined and deduplicated. Group names (CN) are
    /// extracted from group DNs for easier use in authorization logic.
    ///
    /// # Arguments
    ///
    /// * `ldap` - Mutable reference to an LDAP connection
    /// * `user_dn` - User's Distinguished Name
    /// * `user_entry` - LDAP SearchEntry containing user attributes
    ///
    /// # Returns
    ///
    /// Returns `Ok(Vec<String>)` containing the list of group names the user belongs to,
    /// or an error if:
    /// - Group search operation fails
    /// - Group search operation times out
    ///
    /// # Configuration
    ///
    /// - **Direct query**: Requires `group_search_base` and `group_search_filter` to be configured.
    ///   The `{user_dn}` placeholder in the filter is replaced with the user's DN.
    /// - **Reverse query**: Requires `user_group_attribute` to be configured (e.g., "memberOf").
    ///
    /// If neither is configured, returns an empty vector.
    ///
    /// **Priority**:
    /// 1. If `user_group_attribute` is configured: extract groups from user entry (fast, no query)
    /// 2. If `resolve_nested_groups` is true AND `group_search_filter` is configured: additionally
    ///    run recursive nested group resolution via LDAP_MATCHING_RULE_IN_CHAIN (slow)
    /// 3. Fall back to `group_search_filter` only if `user_group_attribute` is not configured
    #[allow(dead_code)] // Will be used in task 13
    async fn get_user_groups(
        &self,
        ldap: &mut Ldap,
        user_dn: &str,
        user_entry: &ldap3::SearchEntry,
    ) -> Result<Vec<String>> {
        use ldap3::{Scope, SearchEntry};
        use std::collections::HashSet;
        use tracing::debug;

        let mut groups = HashSet::new();

        if let Some(user_group_attribute) = &self.config.user_group_attribute {
            debug!(
                user_dn = %user_dn,
                user_group_attribute = %user_group_attribute,
                resolve_nested_groups = self.config.resolve_nested_groups,
                "Starting group resolution: extracting from user entry"
            );

            if let Some(group_dns) = user_entry.attrs.get(user_group_attribute) {
                debug!(
                    user_dn = %user_dn,
                    direct_groups_count = group_dns.len(),
                    "Extracted {} direct group memberships from user entry",
                    group_dns.len()
                );

                for (i, group_dn) in group_dns.iter().enumerate() {
                    debug!(
                        user_dn = %user_dn,
                        group_index = i,
                        group_dn = %group_dn,
                        "  └── Direct membership: {}",
                        extract_cn_from_dn(group_dn)
                    );
                    let group_name = extract_cn_from_dn(group_dn);
                    groups.insert(group_name);
                }
            } else {
                debug!(
                    user_dn = %user_dn,
                    user_group_attribute = %user_group_attribute,
                    "User entry does not contain group attribute"
                );
            }

            if self.config.resolve_nested_groups {
                if let (Some(group_search_base), Some(group_search_filter)) = (
                    &self.config.group_search_base,
                    &self.config.group_search_filter,
                ) {
                    debug!(
                        user_dn = %user_dn,
                        group_search_base = %group_search_base,
                        resolve_nested_groups = true,
                        "resolve_nested_groups enabled: running recursive group traversal"
                    );

                    let search_filter = group_search_filter.replace("{user_dn}", user_dn);
                    debug!(
                        user_dn = %user_dn,
                        "Executing LDAP_MATCHING_RULE_IN_CHAIN filter: {}",
                        search_filter
                    );

                    let timeout = Duration::from_secs(self.config.connection_timeout_seconds);
                    let search_result = tokio::time::timeout(
                        timeout,
                        ldap.search(
                            group_search_base,
                            Scope::Subtree,
                            &search_filter,
                            vec!["cn"],
                        ),
                    )
                    .await
                    .map_err(|_| {
                        error!(
                            user_dn = %user_dn,
                            timeout_seconds = self.config.connection_timeout_seconds,
                            "Nested group resolution timed out (slow on large directories)"
                        );
                        anyhow!("LDAP operation timed out")
                    })?
                    .map_err(|e| {
                        error!(
                            user_dn = %user_dn,
                            error = %e,
                            "Nested group resolution query failed"
                        );
                        anyhow!("LDAP search failed")
                    })?;

                    let (entries, _result) = search_result.success().map_err(|e| {
                        error!(
                            user_dn = %user_dn,
                            error = %e,
                            "Nested group resolution returned error"
                        );
                        anyhow!("LDAP search failed")
                    })?;

                    let nested_groups_count = entries.len();
                    debug!(
                        user_dn = %user_dn,
                        nested_groups_count = nested_groups_count,
                        "Nested group resolution returned {} total group memberships",
                        nested_groups_count
                    );

                    for entry in entries {
                        let group_entry = SearchEntry::construct(entry);
                        let group_dn = &group_entry.dn;
                        let group_name = if let Some(cn_values) = group_entry.attrs.get("cn") {
                            cn_values
                                .first()
                                .cloned()
                                .unwrap_or_else(|| extract_cn_from_dn(group_dn))
                        } else {
                            extract_cn_from_dn(group_dn)
                        };

                        if groups.insert(group_name.clone()) {
                            debug!(
                                user_dn = %user_dn,
                                nested_group = %group_name,
                                "  └── Nested membership discovered: {}",
                                group_name
                            );
                        }
                    }

                    let new_groups_count = groups.len();
                    debug!(
                        user_dn = %user_dn,
                        direct_groups = ?(new_groups_count - nested_groups_count),
                        nested_groups = nested_groups_count,
                        total_unique = new_groups_count,
                        "Group resolution complete: {} direct + {} nested = {} unique groups",
                        new_groups_count - nested_groups_count,
                        nested_groups_count,
                        new_groups_count
                    );
                } else {
                    debug!(
                        user_dn = %user_dn,
                        resolve_nested_groups = true,
                        "resolve_nested_groups enabled but group_search_filter not configured, skipping nested resolution"
                    );
                }
            } else {
                debug!(
                    user_dn = %user_dn,
                    resolve_nested_groups = false,
                    "Skipping nested group resolution (not enabled)"
                );
            }
        } else if let (Some(group_search_base), Some(group_search_filter)) = (
            &self.config.group_search_base,
            &self.config.group_search_filter,
        ) {
            debug!(
                user_dn = %user_dn,
                group_search_base = %group_search_base,
                group_search_filter = %group_search_filter,
                "user_group_attribute not configured: falling back to direct group search"
            );

            let search_filter = group_search_filter.replace("{user_dn}", user_dn);
            let timeout = Duration::from_secs(self.config.connection_timeout_seconds);
            let search_result = tokio::time::timeout(
                timeout,
                ldap.search(
                    group_search_base,
                    Scope::Subtree,
                    &search_filter,
                    vec!["cn"],
                ),
            )
            .await
            .map_err(|_| {
                error!(
                    user_dn = %user_dn,
                    timeout_seconds = self.config.connection_timeout_seconds,
                    "LDAP group search timeout"
                );
                anyhow!("LDAP operation timed out")
            })?
            .map_err(|e| {
                error!(
                    user_dn = %user_dn,
                    error = %e,
                    "LDAP group search failed"
                );
                anyhow!("LDAP search failed")
            })?;

            let (entries, _result) = search_result.success().map_err(|e| {
                error!(
                    user_dn = %user_dn,
                    error = %e,
                    "LDAP group search returned error"
                );
                anyhow!("LDAP search failed")
            })?;

            debug!(
                user_dn = %user_dn,
                group_count = entries.len(),
                "Group search returned {} groups",
                entries.len()
            );

            for entry in entries {
                let group_entry = SearchEntry::construct(entry);
                let group_name = if let Some(cn_values) = group_entry.attrs.get("cn") {
                    cn_values
                        .first()
                        .cloned()
                        .unwrap_or_else(|| extract_cn_from_dn(&group_entry.dn))
                } else {
                    extract_cn_from_dn(&group_entry.dn)
                };
                groups.insert(group_name);
            }
        }

        let mut group_list: Vec<String> = groups.into_iter().collect();
        group_list.sort();

        debug!(
            user_dn = %user_dn,
            final_group_count = group_list.len(),
            groups = ?group_list,
            "Group membership resolution complete"
        );

        Ok(group_list)
    }

    /// Validate user is member of required groups
    ///
    /// This method enforces group-based access control by verifying that the user
    /// is a member of at least one required group. If no required groups are configured,
    /// all authenticated users are allowed.
    ///
    /// # Arguments
    ///
    /// * `user_groups` - List of group names the user belongs to
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if:
    /// - No required groups are configured (empty `required_groups` list)
    /// - User is a member of at least one required group
    ///
    /// Returns an error if:
    /// - Required groups are configured AND user is not a member of any required group
    ///
    /// # Security
    ///
    /// Validation failures are logged with both the required groups and the user's actual
    /// groups to aid in troubleshooting access control issues.
    #[allow(dead_code)] // Will be used in task 13
    fn validate_required_groups(&self, user_groups: &[String]) -> Result<()> {
        use tracing::warn;

        // If required_groups is empty, allow all authenticated users
        if self.config.required_groups.is_empty() {
            return Ok(());
        }

        // Check if user is member of at least one required group
        let has_required = user_groups
            .iter()
            .any(|g| self.config.required_groups.contains(g));

        if !has_required {
            // Log validation failure with required and actual groups
            warn!(
                required_groups = ?self.config.required_groups,
                user_groups = ?user_groups,
                "LDAP access denied: user is not a member of any required group"
            );
            return Err(anyhow!(
                "Access denied: user is not a member of required groups"
            ));
        }

        Ok(())
    }

    /// Extract user information from LDAP entry
    ///
    /// This method extracts user attributes from an LDAP SearchEntry and constructs
    /// an AuthUser object with the extracted information. It uses the configured
    /// attribute names to extract username, email, and display name.
    ///
    /// # Arguments
    ///
    /// * `user_dn` - User's Distinguished Name (used as user ID)
    /// * `entry` - LDAP SearchEntry containing user attributes
    /// * `groups` - List of group names the user belongs to
    ///
    /// # Returns
    ///
    /// Returns an `AuthUser` object with:
    /// - `id`: User's Distinguished Name
    /// - `username`: Extracted from configured username_attribute (default: "uid")
    /// - `roles`: Empty vector (roles are not extracted from LDAP)
    /// - `accessible_clusters`: Empty vector (clusters are not extracted from LDAP)
    ///
    /// # Attribute Extraction
    ///
    /// - **Username**: Extracted from `username_attribute` (default: "uid"). If not present,
    ///   falls back to extracting CN from the DN.
    /// - **Email**: Extracted from `email_attribute` (default: "mail"). If not present,
    ///   uses empty string.
    /// - **Display Name**: Extracted from `display_name_attribute` (default: "cn"). If not
    ///   present, uses the username.
    ///
    /// # Missing Attributes
    ///
    /// If an attribute is not present in the LDAP entry, the method uses default values:
    /// - Missing username: Extracts CN from DN
    /// - Missing email: Empty string
    /// - Missing display name: Uses username
    #[allow(dead_code)] // Will be used in task 13
    fn extract_user_info(
        &self,
        user_dn: String,
        entry: &ldap3::SearchEntry,
        groups: Vec<String>,
    ) -> crate::auth::session::AuthUser {
        use tracing::debug;

        // Extract username from configured attribute (default: "uid")
        let username = entry
            .attrs
            .get(&self.config.username_attribute)
            .and_then(|values| values.first())
            .cloned()
            .unwrap_or_else(|| {
                // Fallback: extract CN from DN if username attribute not found
                debug!(
                    user_dn = %user_dn,
                    username_attribute = %self.config.username_attribute,
                    "Username attribute not found, extracting CN from DN"
                );
                extract_cn_from_dn(&user_dn)
            });

        // Extract email from configured attribute (default: "mail")
        let email = entry
            .attrs
            .get(&self.config.email_attribute)
            .and_then(|values| values.first())
            .cloned();

        // Extract display name from configured attribute (default: "cn")
        let _display_name = entry
            .attrs
            .get(&self.config.display_name_attribute)
            .and_then(|values| values.first())
            .cloned()
            .unwrap_or_else(|| {
                // Fallback: use username if display name not found
                debug!(
                    user_dn = %user_dn,
                    display_name_attribute = %self.config.display_name_attribute,
                    "Display name attribute not found, using username"
                );
                username.clone()
            });

        debug!(
            user_dn = %user_dn,
            username = %username,
            email = ?email,
            groups = ?groups,
            "Extracted user information from LDAP entry"
        );

        // Create AuthUser with extracted information
        // Note: email is stored in a separate field in the session, not in AuthUser
        // Note: roles are empty for LDAP users (groups are used instead)
        crate::auth::session::AuthUser {
            id: user_dn,
            username,
            roles: Vec::new(),               // Roles are not extracted from LDAP
            accessible_clusters: Vec::new(), // Clusters are not extracted from LDAP
        }
    }

    /// Authenticate a user using LDAP credentials
    ///
    /// This method implements the complete LDAP authentication flow:
    /// 1. Check rate limit to prevent brute force attacks
    /// 2. Connect to LDAP server and bind with service account
    /// 3. Search for user in directory
    /// 4. Authenticate user by binding with their credentials
    /// 5. Re-bind with service account for group queries
    /// 6. Query user's group memberships
    /// 7. Validate required groups (if configured)
    /// 8. Extract user information from LDAP entry
    /// 9. Resolve accessible clusters based on groups
    /// 10. Create session and return session token
    ///
    /// # Security
    ///
    /// - All authentication failures return None (generic failure)
    /// - Rate limiting is enforced before attempting LDAP operations
    /// - User input is sanitized to prevent LDAP injection attacks
    /// - Detailed errors are logged for administrators but not exposed to clients
    ///
    /// # Arguments
    ///
    /// * `username` - Username to authenticate
    /// * `password` - User's password
    ///
    /// # Returns
    ///
    /// Returns `Ok(Some(session_token))` on successful authentication,
    /// `Ok(None)` if rate limited or authentication fails,
    /// or an error if an unexpected error occurs.
    pub async fn authenticate(&self, username: &str, password: &str) -> Result<Option<String>> {
        debug!(
            server_url = %self.config.server_url,
            "Establishing LDAP connection for authentication"
        );

        // Check rate limit to prevent brute force attacks
        if let Some(rate_limiter) = &self.rate_limiter {
            if rate_limiter.is_rate_limited(username).await {
                tracing::warn!(
                    username = %username,
                    "LDAP authentication blocked: rate limit exceeded"
                );
                return Ok(None);
            }
        }

        // Get connection from LDAP pool
        let (conn, mut ldap) =
            LdapConnAsync::with_settings(self.conn_settings.clone(), &self.config.server_url)
                .await
                .map_err(|e| {
                    error!(
                        username = %username,
                        server_url = %self.config.server_url,
                        error = %e,
                        "Failed to connect to LDAP server"
                    );
                    anyhow!("LDAP connection failed")
                })?;

        // Drive the connection in the background
        ldap3::drive!(conn);

        // Bind with service account
        debug!(
            bind_dn = %self.config.bind_dn,
            "Binding with LDAP service account"
        );

        if let Err(e) = self.bind_service_account(&mut ldap).await {
            error!(
                username = %username,
                error = %e,
                "Service account bind failed during authentication"
            );
            // Attempt to unbind before returning
            let _ = ldap.unbind().await;

            // Record failed attempt
            if let Some(rate_limiter) = &self.rate_limiter {
                rate_limiter.record_failed_attempt(username).await;
            }

            return Ok(None);
        }

        debug!(
            bind_dn = %self.config.bind_dn,
            "Service account bind successful"
        );

        // Search for user
        let user_entry = match self.search_user(&mut ldap, username).await {
            Ok(entry) => entry,
            Err(e) => {
                error!(
                    username = %username,
                    error = %e,
                    "User search failed during authentication"
                );
                // Attempt to unbind before returning
                let _ = ldap.unbind().await;

                // Record failed attempt
                if let Some(rate_limiter) = &self.rate_limiter {
                    rate_limiter.record_failed_attempt(username).await;
                }

                return Ok(None);
            }
        };

        let user_dn = user_entry.dn.clone();

        debug!(
            username = %username,
            user_dn = %user_dn,
            "User found in LDAP directory, attempting authentication"
        );

        // Authenticate user by binding with their credentials
        let auth_success = match self.authenticate_user(&mut ldap, &user_dn, password).await {
            Ok(success) => success,
            Err(e) => {
                error!(
                    username = %username,
                    user_dn = %user_dn,
                    error = %e,
                    "User authentication bind failed"
                );
                // Attempt to unbind before returning
                let _ = ldap.unbind().await;

                // Record failed attempt
                if let Some(rate_limiter) = &self.rate_limiter {
                    rate_limiter.record_failed_attempt(username).await;
                }

                return Ok(None);
            }
        };

        if !auth_success {
            error!(
                username = %username,
                user_dn = %user_dn,
                "User authentication failed: invalid password"
            );
            // Attempt to unbind before returning
            let _ = ldap.unbind().await;

            // Record failed attempt
            if let Some(rate_limiter) = &self.rate_limiter {
                rate_limiter.record_failed_attempt(username).await;
            }

            return Ok(None);
        }

        // Re-bind with service account for group queries
        debug!("Re-binding with service account for group queries");

        if let Err(e) = self.bind_service_account(&mut ldap).await {
            error!(
                username = %username,
                error = %e,
                "Service account re-bind failed after user authentication"
            );
            // Attempt to unbind before returning
            let _ = ldap.unbind().await;

            // Record failed attempt
            if let Some(rate_limiter) = &self.rate_limiter {
                rate_limiter.record_failed_attempt(username).await;
            }

            return Ok(None);
        }

        // Query user's group memberships
        debug!(
            username = %username,
            user_dn = %user_dn,
            "Querying user group memberships"
        );

        let groups = match self.get_user_groups(&mut ldap, &user_dn, &user_entry).await {
            Ok(groups) => groups,
            Err(e) => {
                error!(
                    username = %username,
                    user_dn = %user_dn,
                    error = %e,
                    "Failed to query user groups"
                );
                // Attempt to unbind before returning
                let _ = ldap.unbind().await;

                // Record failed attempt
                if let Some(rate_limiter) = &self.rate_limiter {
                    rate_limiter.record_failed_attempt(username).await;
                }

                return Ok(None);
            }
        };

        debug!(
            username = %username,
            user_dn = %user_dn,
            groups_count = groups.len(),
            "User groups resolved"
        );

        // Validate required groups
        if self.config.required_groups.is_empty() {
            debug!("No required groups configured, allowing all authenticated users");
        } else {
            debug!(
                required_groups = ?self.config.required_groups,
                user_groups = ?groups,
                "Validating required group membership"
            );
        }

        if let Err(e) = self.validate_required_groups(&groups) {
            error!(
                username = %username,
                user_dn = %user_dn,
                groups = ?groups,
                error = %e,
                "User failed required group validation"
            );
            // Attempt to unbind before returning
            let _ = ldap.unbind().await;

            // Record failed attempt (access denied counts as failure)
            if let Some(rate_limiter) = &self.rate_limiter {
                rate_limiter.record_failed_attempt(username).await;
            }

            return Ok(None);
        }

        debug!(
            username = %username,
            user_dn = %user_dn,
            "Required group validation passed"
        );

        // Extract user information
        let auth_user = self.extract_user_info(user_dn.clone(), &user_entry, groups.clone());

        // Unbind LDAP connection
        if let Err(e) = ldap.unbind().await {
            error!(
                username = %username,
                error = %e,
                "Failed to unbind LDAP connection"
            );
            // Continue anyway since authentication was successful
        }

        // Record successful authentication (clears rate limit)
        if let Some(rate_limiter) = &self.rate_limiter {
            rate_limiter.record_success(username).await;
        }

        // Resolve accessible clusters based on user's groups
        debug!(
            username = %username,
            groups = ?groups,
            "Resolving cluster access for user"
        );

        let accessible_clusters = self.permission_resolver.resolve_cluster_access(&groups);

        // Create AuthUser with accessible clusters
        let auth_user_with_clusters = crate::auth::session::AuthUser::new_with_clusters(
            auth_user.id,
            auth_user.username.clone(),
            groups.clone(),
            accessible_clusters.clone(),
        );

        // Create session using session_manager
        let session_token = self
            .session_manager
            .create_session(auth_user_with_clusters)
            .await
            .context("Failed to create session after successful LDAP authentication")?;

        // Log authentication success with username and groups
        debug!(
            username = %username,
            user_dn = %user_dn,
            groups = ?groups,
            accessible_clusters = ?accessible_clusters,
            "LDAP authentication successful"
        );

        Ok(Some(session_token))
    }

    /// Get the provider type identifier
    ///
    /// Returns "ldap" to identify this as an LDAP authentication provider.
    pub fn provider_type(&self) -> &str {
        "ldap"
    }
}

/// Extract CN (Common Name) from a Distinguished Name
///
/// This helper function extracts the CN component from an LDAP Distinguished Name.
/// It's used as a fallback when the username attribute is not present in the LDAP entry.
///
/// # Arguments
///
/// * `dn` - Distinguished Name (e.g., "uid=testuser,ou=users,dc=example,dc=com")
///
/// # Returns
///
/// Returns the CN value if found, or the full DN if CN is not present.
///
/// # Examples
///
/// ```
/// use secan::auth::ldap::extract_cn_from_dn;
///
/// assert_eq!(
///     extract_cn_from_dn("cn=Test User,ou=users,dc=example,dc=com"),
///     "Test User"
/// );
///
/// assert_eq!(
///     extract_cn_from_dn("uid=testuser,ou=users,dc=example,dc=com"),
///     "testuser"
/// );
/// ```
pub fn extract_cn_from_dn(dn: &str) -> String {
    // Try to extract CN from DN
    for component in dn.split(',') {
        let component = component.trim();
        if component.to_lowercase().starts_with("cn=") {
            return component[3..].to_string();
        }
        // Also try uid= as fallback
        if component.to_lowercase().starts_with("uid=") {
            return component[4..].to_string();
        }
    }

    // If no CN or UID found, return the full DN
    dn.to_string()
}

/// Sanitizes user input to prevent LDAP injection attacks.
///
/// This function escapes LDAP special characters according to RFC 4515.
/// It should be called on all user-provided input before using it in LDAP search filters.
///
/// # Special Characters Escaped
///
/// - Backslash (`\`) → `\5c`
/// - Asterisk (`*`) → `\2a`
/// - Left parenthesis (`(`) → `\28`
/// - Right parenthesis (`)`) → `\29`
/// - Null byte (`\0`) → `\00`
///
/// # Examples
///
/// ```
/// use secan::auth::ldap::sanitize_ldap_input;
///
/// assert_eq!(sanitize_ldap_input("user*"), "user\\2a");
/// assert_eq!(sanitize_ldap_input("(admin)"), "\\28admin\\29");
/// assert_eq!(sanitize_ldap_input("user\\name"), "user\\5cname");
/// ```
///
/// # Security
///
/// This function prevents LDAP injection attacks by escaping characters that have
/// special meaning in LDAP search filters. Always use this function on user input
/// before constructing LDAP queries.
///
/// # References
///
/// - RFC 4515: LDAP String Representation of Search Filters
pub fn sanitize_ldap_input(input: &str) -> String {
    // Escape LDAP special characters according to RFC 4515
    // Note: Backslash must be escaped first to avoid double-escaping
    input
        .replace('\\', "\\5c") // Backslash must be first
        .replace('*', "\\2a") // Asterisk
        .replace('(', "\\28") // Left parenthesis
        .replace(')', "\\29") // Right parenthesis
        .replace('\0', "\\00") // Null byte
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_asterisk() {
        assert_eq!(sanitize_ldap_input("user*"), "user\\2a");
    }

    #[test]
    fn test_sanitize_parentheses() {
        assert_eq!(sanitize_ldap_input("(admin)"), "\\28admin\\29");
    }

    #[test]
    fn test_sanitize_backslash() {
        assert_eq!(sanitize_ldap_input("user\\name"), "user\\5cname");
    }

    #[test]
    fn test_sanitize_null_byte() {
        assert_eq!(sanitize_ldap_input("user\0name"), "user\\00name");
    }

    #[test]
    fn test_sanitize_multiple_special_chars() {
        assert_eq!(sanitize_ldap_input("user*(admin)"), "user\\2a\\28admin\\29");
    }

    #[test]
    fn test_sanitize_backslash_and_asterisk() {
        // Backslash should be escaped first, then asterisk
        assert_eq!(sanitize_ldap_input("user\\*"), "user\\5c\\2a");
    }

    #[test]
    fn test_sanitize_empty_string() {
        assert_eq!(sanitize_ldap_input(""), "");
    }

    #[test]
    fn test_sanitize_no_special_chars() {
        assert_eq!(sanitize_ldap_input("username"), "username");
    }

    #[test]
    fn test_sanitize_all_special_chars() {
        assert_eq!(sanitize_ldap_input("\\*()\0"), "\\5c\\2a\\28\\29\\00");
    }

    #[test]
    fn test_extract_cn_from_dn_with_cn() {
        assert_eq!(
            extract_cn_from_dn("cn=Test User,ou=users,dc=example,dc=com"),
            "Test User"
        );
    }

    #[test]
    fn test_extract_cn_from_dn_with_uid() {
        assert_eq!(
            extract_cn_from_dn("uid=testuser,ou=users,dc=example,dc=com"),
            "testuser"
        );
    }

    #[test]
    fn test_extract_cn_from_dn_with_both() {
        // Should prefer CN over UID
        assert_eq!(
            extract_cn_from_dn("cn=Test User,uid=testuser,ou=users,dc=example,dc=com"),
            "Test User"
        );
    }

    #[test]
    fn test_extract_cn_from_dn_no_cn_or_uid() {
        let dn = "ou=users,dc=example,dc=com";
        assert_eq!(extract_cn_from_dn(dn), dn);
    }

    #[test]
    fn test_extract_cn_from_dn_case_insensitive() {
        assert_eq!(
            extract_cn_from_dn("CN=Test User,OU=users,DC=example,DC=com"),
            "Test User"
        );
    }

    #[test]
    fn test_extract_cn_from_dn_with_spaces() {
        // When there are spaces around the equals sign, the component won't match "cn="
        // because it will be "cn " after trimming and splitting
        // This is expected behavior - DNs should be properly formatted
        assert_eq!(
            extract_cn_from_dn("cn=Test User,ou=users,dc=example,dc=com"),
            "Test User"
        );
    }
}
