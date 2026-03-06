// LDAP authentication provider

use crate::auth::session::SessionManager;
use crate::config::LdapConfig;
use anyhow::{Context, Result};
use ldap3::{LdapConnAsync, LdapConnSettings};
use std::sync::Arc;
use std::time::Duration;
use tracing::info;

/// LDAP authentication provider
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
