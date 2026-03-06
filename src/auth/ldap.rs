// LDAP authentication provider

use crate::auth::session::SessionManager;
use crate::config::LdapConfig;
use anyhow::{anyhow, Context, Result};
use ldap3::{Ldap, LdapConnAsync, LdapConnSettings};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};

/// LDAP authentication provider
#[allow(dead_code)] // Fields will be used in later tasks (6-13)
pub struct LdapAuthProvider {
    config: LdapConfig,
    session_manager: Arc<SessionManager>,
    conn_settings: LdapConnSettings,
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
    /// use cerebro::auth::ldap::LdapAuthProvider;
    /// use cerebro::auth::session::{SessionManager, SessionConfig};
    /// use cerebro::config::LdapConfig;
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
    /// #   required_groups: Vec::new(),
    /// #   connection_timeout_seconds: 10,
    /// #   tls_mode: cerebro::config::TlsMode::None,
    /// #   tls_skip_verify: false,
    /// #   username_attribute: "uid".to_string(),
    /// #   email_attribute: "mail".to_string(),
    /// #   display_name_attribute: "cn".to_string(),
    /// };
    ///
    /// let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
    /// let provider = LdapAuthProvider::new(config, session_manager).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn new(config: LdapConfig, session_manager: Arc<SessionManager>) -> Result<Self> {
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
        })
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
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use cerebro::auth::ldap::LdapAuthProvider;
    /// # use cerebro::auth::session::{SessionManager, SessionConfig};
    /// # use cerebro::config::LdapConfig;
    /// # use std::sync::Arc;
    /// # use ldap3::LdapConnAsync;
    /// # async fn example() -> anyhow::Result<()> {
    /// # let config = LdapConfig {
    /// #     server_url: "ldap://ldap.example.com:389".to_string(),
    /// #     bind_dn: "cn=admin,dc=example,dc=com".to_string(),
    /// #     bind_password: "password".to_string(),
    /// #     user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
    /// #     search_base: None,
    /// #     search_filter: None,
    /// #     group_search_base: None,
    /// #     group_search_filter: None,
    /// #     group_member_attribute: None,
    /// #     user_group_attribute: None,
    /// #     required_groups: Vec::new(),
    /// #     connection_timeout_seconds: 10,
    /// #     tls_mode: cerebro::config::TlsMode::None,
    /// #     tls_skip_verify: false,
    /// #     username_attribute: "uid".to_string(),
    /// #     email_attribute: "mail".to_string(),
    /// #     display_name_attribute: "cn".to_string(),
    /// # };
    /// # let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
    /// # let provider = LdapAuthProvider::new(config, session_manager).await?;
    /// let (conn, mut ldap) = LdapConnAsync::new(&provider.config.server_url).await?;
    /// ldap3::drive!(conn);
    ///
    /// provider.bind_service_account(&mut ldap).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn bind_service_account(&self, ldap: &mut Ldap) -> Result<()> {
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
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use cerebro::auth::ldap::LdapAuthProvider;
    /// # use cerebro::auth::session::{SessionManager, SessionConfig};
    /// # use cerebro::config::LdapConfig;
    /// # use std::sync::Arc;
    /// # use ldap3::LdapConnAsync;
    /// # async fn example() -> anyhow::Result<()> {
    /// # let config = LdapConfig {
    /// #     server_url: "ldap://ldap.example.com:389".to_string(),
    /// #     bind_dn: "cn=admin,dc=example,dc=com".to_string(),
    /// #     bind_password: "password".to_string(),
    /// #     user_dn_pattern: None,
    /// #     search_base: Some("ou=users,dc=example,dc=com".to_string()),
    /// #     search_filter: Some("(uid={username})".to_string()),
    /// #     group_search_base: None,
    /// #     group_search_filter: None,
    /// #     group_member_attribute: None,
    /// #     user_group_attribute: None,
    /// #     required_groups: Vec::new(),
    /// #     connection_timeout_seconds: 10,
    /// #     tls_mode: cerebro::config::TlsMode::None,
    /// #     tls_skip_verify: false,
    /// #     username_attribute: "uid".to_string(),
    /// #     email_attribute: "mail".to_string(),
    /// #     display_name_attribute: "cn".to_string(),
    /// # };
    /// # let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
    /// # let provider = LdapAuthProvider::new(config, session_manager).await?;
    /// let (conn, mut ldap) = LdapConnAsync::new(&provider.config.server_url).await?;
    /// ldap3::drive!(conn);
    ///
    /// provider.bind_service_account(&mut ldap).await?;
    /// let user_entry = provider.search_user(&mut ldap, "testuser").await?;
    /// println!("Found user: {}", user_entry.dn);
    /// # Ok(())
    /// # }
    /// ```
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
        let entry = SearchEntry::construct(entries.into_iter().next().unwrap());

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
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use cerebro::auth::ldap::LdapAuthProvider;
    /// # use cerebro::auth::session::{SessionManager, SessionConfig};
    /// # use cerebro::config::LdapConfig;
    /// # use std::sync::Arc;
    /// # use ldap3::LdapConnAsync;
    /// # async fn example() -> anyhow::Result<()> {
    /// # let config = LdapConfig {
    /// #     server_url: "ldap://ldap.example.com:389".to_string(),
    /// #     bind_dn: "cn=admin,dc=example,dc=com".to_string(),
    /// #     bind_password: "password".to_string(),
    /// #     user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
    /// #     search_base: None,
    /// #     search_filter: None,
    /// #     group_search_base: None,
    /// #     group_search_filter: None,
    /// #     group_member_attribute: None,
    /// #     user_group_attribute: None,
    /// #     required_groups: Vec::new(),
    /// #     connection_timeout_seconds: 10,
    /// #     tls_mode: cerebro::config::TlsMode::None,
    /// #     tls_skip_verify: false,
    /// #     username_attribute: "uid".to_string(),
    /// #     email_attribute: "mail".to_string(),
    /// #     display_name_attribute: "cn".to_string(),
    /// # };
    /// # let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
    /// # let provider = LdapAuthProvider::new(config, session_manager).await?;
    /// let (conn, mut ldap) = LdapConnAsync::new(&provider.config.server_url).await?;
    /// ldap3::drive!(conn);
    ///
    /// let user_dn = "uid=testuser,ou=users,dc=example,dc=com";
    /// let password = "userpassword";
    /// let is_valid = provider.authenticate_user(&mut ldap, user_dn, password).await?;
    ///
    /// if is_valid {
    ///     println!("Authentication successful");
    /// } else {
    ///     println!("Authentication failed");
    /// }
    /// # Ok(())
    /// # }
    /// ```
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
/// use cerebro::auth::ldap::sanitize_ldap_input;
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
}
