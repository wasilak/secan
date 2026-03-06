// Integration test for LDAP configuration loading and validation

use secan::config::{AuthConfig, AuthMode, Config, LdapConfig, TlsMode};

#[test]
fn test_ldap_config_validation_at_startup() {
    // Test that LDAP configuration is validated when auth mode is Ldap
    let config = Config {
        server: secan::config::ServerConfig::default(),
        auth: AuthConfig {
            mode: AuthMode::Ldap,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            ldap: Some(LdapConfig {
                server_url: "ldap://ldap.example.com:389".to_string(),
                bind_dn: "cn=admin,dc=example,dc=com".to_string(),
                bind_password: "password".to_string(),
                user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
                search_base: None,
                search_filter: None,
                group_search_base: None,
                group_search_filter: None,
                group_member_attribute: None,
                user_group_attribute: None,
                required_groups: Vec::new(),
                connection_timeout_seconds: 10,
                tls_mode: TlsMode::None,
                tls_skip_verify: false,
                username_attribute: "uid".to_string(),
                email_attribute: "mail".to_string(),
                display_name_attribute: "cn".to_string(),
            }),
            roles: Vec::new(),
            permissions: Vec::new(),
        },
        clusters: vec![secan::config::ClusterConfig::new(
            "test".to_string(),
            vec!["http://localhost:9200".to_string()],
        )],
        cache: secan::config::CacheConfig::default(),
    };

    // Validation should succeed with valid LDAP configuration
    assert!(config.validate().is_ok());
}

#[test]
fn test_ldap_config_validation_fails_with_invalid_url() {
    // Test that validation fails with invalid LDAP server URL
    let config = Config {
        server: secan::config::ServerConfig::default(),
        auth: AuthConfig {
            mode: AuthMode::Ldap,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            ldap: Some(LdapConfig {
                server_url: "http://ldap.example.com".to_string(), // Invalid scheme
                bind_dn: "cn=admin,dc=example,dc=com".to_string(),
                bind_password: "password".to_string(),
                user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
                search_base: None,
                search_filter: None,
                group_search_base: None,
                group_search_filter: None,
                group_member_attribute: None,
                user_group_attribute: None,
                required_groups: Vec::new(),
                connection_timeout_seconds: 10,
                tls_mode: TlsMode::None,
                tls_skip_verify: false,
                username_attribute: "uid".to_string(),
                email_attribute: "mail".to_string(),
                display_name_attribute: "cn".to_string(),
            }),
            roles: Vec::new(),
            permissions: Vec::new(),
        },
        clusters: vec![secan::config::ClusterConfig::new(
            "test".to_string(),
            vec!["http://localhost:9200".to_string()],
        )],
        cache: secan::config::CacheConfig::default(),
    };

    // Validation should fail with descriptive error
    let result = config.validate();
    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("must use ldap:// or ldaps://"));
}

#[test]
fn test_ldap_config_validation_fails_without_config() {
    // Test that validation fails when LDAP mode is selected but no config provided
    let config = Config {
        server: secan::config::ServerConfig::default(),
        auth: AuthConfig {
            mode: AuthMode::Ldap,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            ldap: None, // No LDAP config
            roles: Vec::new(),
            permissions: Vec::new(),
        },
        clusters: vec![secan::config::ClusterConfig::new(
            "test".to_string(),
            vec!["http://localhost:9200".to_string()],
        )],
        cache: secan::config::CacheConfig::default(),
    };

    // Validation should fail with descriptive error
    let result = config.validate();
    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("LDAP mode requires LDAP configuration"));
}

#[test]
fn test_ldap_config_validation_fails_with_empty_bind_dn() {
    // Test that validation fails with empty bind DN
    let config = Config {
        server: secan::config::ServerConfig::default(),
        auth: AuthConfig {
            mode: AuthMode::Ldap,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            ldap: Some(LdapConfig {
                server_url: "ldap://ldap.example.com:389".to_string(),
                bind_dn: String::new(), // Empty bind DN
                bind_password: "password".to_string(),
                user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
                search_base: None,
                search_filter: None,
                group_search_base: None,
                group_search_filter: None,
                group_member_attribute: None,
                user_group_attribute: None,
                required_groups: Vec::new(),
                connection_timeout_seconds: 10,
                tls_mode: TlsMode::None,
                tls_skip_verify: false,
                username_attribute: "uid".to_string(),
                email_attribute: "mail".to_string(),
                display_name_attribute: "cn".to_string(),
            }),
            roles: Vec::new(),
            permissions: Vec::new(),
        },
        clusters: vec![secan::config::ClusterConfig::new(
            "test".to_string(),
            vec!["http://localhost:9200".to_string()],
        )],
        cache: secan::config::CacheConfig::default(),
    };

    // Validation should fail with descriptive error
    let result = config.validate();
    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("bind_dn cannot be empty"));
}

#[test]
fn test_ldap_config_validation_fails_with_zero_timeout() {
    // Test that validation fails with zero timeout
    let config = Config {
        server: secan::config::ServerConfig::default(),
        auth: AuthConfig {
            mode: AuthMode::Ldap,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            ldap: Some(LdapConfig {
                server_url: "ldap://ldap.example.com:389".to_string(),
                bind_dn: "cn=admin,dc=example,dc=com".to_string(),
                bind_password: "password".to_string(),
                user_dn_pattern: Some("uid={username},ou=users,dc=example,dc=com".to_string()),
                search_base: None,
                search_filter: None,
                group_search_base: None,
                group_search_filter: None,
                group_member_attribute: None,
                user_group_attribute: None,
                required_groups: Vec::new(),
                connection_timeout_seconds: 0, // Zero timeout
                tls_mode: TlsMode::None,
                tls_skip_verify: false,
                username_attribute: "uid".to_string(),
                email_attribute: "mail".to_string(),
                display_name_attribute: "cn".to_string(),
            }),
            roles: Vec::new(),
            permissions: Vec::new(),
        },
        clusters: vec![secan::config::ClusterConfig::new(
            "test".to_string(),
            vec!["http://localhost:9200".to_string()],
        )],
        cache: secan::config::CacheConfig::default(),
    };

    // Validation should fail with descriptive error
    let result = config.validate();
    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("connection_timeout_seconds must be positive"));
}
