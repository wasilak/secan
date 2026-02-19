//! Local authentication provider
//!
//! This module implements authentication using locally configured users
//! with bcrypt or argon2 password hashing.

use anyhow::{anyhow, Result};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

use super::config::{HashAlgorithm, LocalAuthConfig, LocalUser};
use super::provider::{AuthProvider, AuthRequest, AuthResponse};
use super::session::{SessionManager, UserInfo};

/// Local authentication provider
///
/// Authenticates users against locally configured credentials with bcrypt or argon2 hashing.
pub struct LocalAuthProvider {
    config: LocalAuthConfig,
    session_manager: Arc<SessionManager>,
    users: HashMap<String, LocalUser>,
}

impl LocalAuthProvider {
    /// Create a new local authentication provider
    ///
    /// Builds a user lookup HashMap from the configuration for efficient authentication.
    pub fn new(config: LocalAuthConfig, session_manager: Arc<SessionManager>) -> Self {
        // Build user lookup HashMap for efficient authentication
        let users = config
            .users
            .iter()
            .map(|u| (u.username.clone(), u.clone()))
            .collect();

        Self {
            config,
            session_manager,
            users,
        }
    }

    /// Verify a password against a stored hash
    ///
    /// Supports both bcrypt and argon2 hashing algorithms.
    fn verify_password(&self, user: &LocalUser, password: &str) -> Result<bool> {
        match user.hash_algorithm {
            HashAlgorithm::Bcrypt => {
                // Use bcrypt crate for verification
                let valid = bcrypt::verify(password, &user.password_hash)
                    .map_err(|e| anyhow!("Bcrypt verification failed: {}", e))?;
                Ok(valid)
            }
            HashAlgorithm::Argon2 => {
                // Use argon2 crate for verification
                let argon2 = Argon2::default();
                let parsed_hash = PasswordHash::new(&user.password_hash)
                    .map_err(|e| anyhow!("Invalid argon2 hash format: {}", e))?;
                
                let valid = argon2
                    .verify_password(password.as_bytes(), &parsed_hash)
                    .is_ok();
                Ok(valid)
            }
        }
    }
}

#[async_trait]
impl AuthProvider for LocalAuthProvider {
    async fn authenticate(&self, request: AuthRequest) -> Result<AuthResponse> {
        let (username, password) = match request {
            AuthRequest::LocalCredentials { username, password } => (username, password),
            _ => return Err(anyhow!("Invalid request type for local authentication")),
        };

        // Check rate limit before attempting authentication
        self.session_manager
            .check_rate_limit(&username)
            .map_err(|_| anyhow!("Invalid credentials"))?; // Generic error message

        // Look up user
        let user = self
            .users
            .get(&username)
            .ok_or_else(|| anyhow!("Invalid credentials"))?; // Generic error message

        // Verify password
        let valid = self
            .verify_password(user, &password)
            .map_err(|_| anyhow!("Invalid credentials"))?; // Generic error message

        if !valid {
            return Err(anyhow!("Invalid credentials")); // Generic error message
        }

        // Create user info
        let user_info = UserInfo {
            id: username.clone(),
            username: username.clone(),
            email: None,
            roles: user.roles.clone(),
            groups: vec![],
        };

        // Create session
        let session_token = self
            .session_manager
            .create_session(user_info.clone())
            .await?;

        Ok(AuthResponse {
            user_info,
            session_token,
        })
    }

    fn provider_type(&self) -> &str {
        "local"
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::config::{RenewalMode, SecurityConfig, SessionConfig};

    fn create_test_session_config() -> SessionConfig {
        SessionConfig {
            timeout_seconds: 3600,
            renewal_mode: RenewalMode::SlidingWindow,
            cookie_name: "session_token".to_string(),
            secure_only: true,
        }
    }

    fn create_test_security_config() -> SecurityConfig {
        SecurityConfig {
            rate_limit_attempts: 5,
            rate_limit_window_seconds: 300,
            min_password_length: 8,
            require_https: false,
        }
    }

    fn create_bcrypt_hash(password: &str) -> String {
        bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap()
    }

    fn create_argon2_hash(password: &str) -> String {
        use argon2::password_hash::{PasswordHasher, SaltString};
        use rand::rngs::OsRng;

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        argon2
            .hash_password(password.as_bytes(), &salt)
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn test_successful_authentication_bcrypt() {
        let password = "test_password_123";
        let password_hash = create_bcrypt_hash(password);

        let config = LocalAuthConfig {
            users: vec![LocalUser {
                username: "testuser".to_string(),
                password_hash,
                hash_algorithm: HashAlgorithm::Bcrypt,
                roles: vec!["admin".to_string()],
            }],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        let request = AuthRequest::LocalCredentials {
            username: "testuser".to_string(),
            password: password.to_string(),
        };

        let response = provider.authenticate(request).await.unwrap();
        assert_eq!(response.user_info.username, "testuser");
        assert_eq!(response.user_info.roles, vec!["admin"]);
        assert!(!response.session_token.is_empty());
    }

    #[tokio::test]
    async fn test_successful_authentication_argon2() {
        let password = "test_password_456";
        let password_hash = create_argon2_hash(password);

        let config = LocalAuthConfig {
            users: vec![LocalUser {
                username: "argonuser".to_string(),
                password_hash,
                hash_algorithm: HashAlgorithm::Argon2,
                roles: vec!["user".to_string()],
            }],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        let request = AuthRequest::LocalCredentials {
            username: "argonuser".to_string(),
            password: password.to_string(),
        };

        let response = provider.authenticate(request).await.unwrap();
        assert_eq!(response.user_info.username, "argonuser");
        assert_eq!(response.user_info.roles, vec!["user"]);
        assert!(!response.session_token.is_empty());
    }

    #[tokio::test]
    async fn test_invalid_username() {
        let password = "test_password_123";
        let password_hash = create_bcrypt_hash(password);

        let config = LocalAuthConfig {
            users: vec![LocalUser {
                username: "testuser".to_string(),
                password_hash,
                hash_algorithm: HashAlgorithm::Bcrypt,
                roles: vec!["admin".to_string()],
            }],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        let request = AuthRequest::LocalCredentials {
            username: "nonexistent".to_string(),
            password: password.to_string(),
        };

        let result = provider.authenticate(request).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().to_string(), "Invalid credentials");
    }

    #[tokio::test]
    async fn test_invalid_password() {
        let password = "correct_password";
        let password_hash = create_bcrypt_hash(password);

        let config = LocalAuthConfig {
            users: vec![LocalUser {
                username: "testuser".to_string(),
                password_hash,
                hash_algorithm: HashAlgorithm::Bcrypt,
                roles: vec!["admin".to_string()],
            }],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        let request = AuthRequest::LocalCredentials {
            username: "testuser".to_string(),
            password: "wrong_password".to_string(),
        };

        let result = provider.authenticate(request).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().to_string(), "Invalid credentials");
    }

    #[tokio::test]
    async fn test_generic_error_messages() {
        let password = "test_password";
        let password_hash = create_bcrypt_hash(password);

        let config = LocalAuthConfig {
            users: vec![LocalUser {
                username: "testuser".to_string(),
                password_hash,
                hash_algorithm: HashAlgorithm::Bcrypt,
                roles: vec!["admin".to_string()],
            }],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        // Test invalid username
        let request1 = AuthRequest::LocalCredentials {
            username: "nonexistent".to_string(),
            password: password.to_string(),
        };
        let result1 = provider.authenticate(request1).await;
        assert!(result1.is_err());
        assert_eq!(result1.unwrap_err().to_string(), "Invalid credentials");

        // Test invalid password
        let request2 = AuthRequest::LocalCredentials {
            username: "testuser".to_string(),
            password: "wrong_password".to_string(),
        };
        let result2 = provider.authenticate(request2).await;
        assert!(result2.is_err());
        assert_eq!(result2.unwrap_err().to_string(), "Invalid credentials");

        // Both should return the same generic error message
        assert_eq!(
            result1.unwrap_err().to_string(),
            result2.unwrap_err().to_string()
        );
    }

    #[tokio::test]
    async fn test_invalid_request_type() {
        let config = LocalAuthConfig {
            users: vec![LocalUser {
                username: "testuser".to_string(),
                password_hash: create_bcrypt_hash("password"),
                hash_algorithm: HashAlgorithm::Bcrypt,
                roles: vec!["admin".to_string()],
            }],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        // Try to authenticate with OIDC request type
        let request = AuthRequest::OidcCallback {
            code: "auth_code".to_string(),
            state: "state".to_string(),
        };

        let result = provider.authenticate(request).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Invalid request type"));
    }

    #[tokio::test]
    async fn test_multiple_users() {
        let password1 = "password1";
        let password2 = "password2";

        let config = LocalAuthConfig {
            users: vec![
                LocalUser {
                    username: "user1".to_string(),
                    password_hash: create_bcrypt_hash(password1),
                    hash_algorithm: HashAlgorithm::Bcrypt,
                    roles: vec!["admin".to_string()],
                },
                LocalUser {
                    username: "user2".to_string(),
                    password_hash: create_argon2_hash(password2),
                    hash_algorithm: HashAlgorithm::Argon2,
                    roles: vec!["user".to_string()],
                },
            ],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        // Authenticate user1
        let request1 = AuthRequest::LocalCredentials {
            username: "user1".to_string(),
            password: password1.to_string(),
        };
        let response1 = provider.authenticate(request1).await.unwrap();
        assert_eq!(response1.user_info.username, "user1");
        assert_eq!(response1.user_info.roles, vec!["admin"]);

        // Authenticate user2
        let request2 = AuthRequest::LocalCredentials {
            username: "user2".to_string(),
            password: password2.to_string(),
        };
        let response2 = provider.authenticate(request2).await.unwrap();
        assert_eq!(response2.user_info.username, "user2");
        assert_eq!(response2.user_info.roles, vec!["user"]);
    }

    #[test]
    fn test_verify_password_bcrypt() {
        let password = "test_password";
        let password_hash = create_bcrypt_hash(password);

        let user = LocalUser {
            username: "testuser".to_string(),
            password_hash,
            hash_algorithm: HashAlgorithm::Bcrypt,
            roles: vec!["admin".to_string()],
        };

        let config = LocalAuthConfig { users: vec![] };
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let provider = LocalAuthProvider::new(config, session_manager);

        // Correct password
        let result = provider.verify_password(&user, password);
        assert!(result.is_ok());
        assert!(result.unwrap());

        // Incorrect password
        let result = provider.verify_password(&user, "wrong_password");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_verify_password_argon2() {
        let password = "test_password";
        let password_hash = create_argon2_hash(password);

        let user = LocalUser {
            username: "testuser".to_string(),
            password_hash,
            hash_algorithm: HashAlgorithm::Argon2,
            roles: vec!["admin".to_string()],
        };

        let config = LocalAuthConfig { users: vec![] };
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let provider = LocalAuthProvider::new(config, session_manager);

        // Correct password
        let result = provider.verify_password(&user, password);
        assert!(result.is_ok());
        assert!(result.unwrap());

        // Incorrect password
        let result = provider.verify_password(&user, "wrong_password");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_user_lookup_hashmap() {
        let config = LocalAuthConfig {
            users: vec![
                LocalUser {
                    username: "user1".to_string(),
                    password_hash: "hash1".to_string(),
                    hash_algorithm: HashAlgorithm::Bcrypt,
                    roles: vec!["admin".to_string()],
                },
                LocalUser {
                    username: "user2".to_string(),
                    password_hash: "hash2".to_string(),
                    hash_algorithm: HashAlgorithm::Argon2,
                    roles: vec!["user".to_string()],
                },
            ],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        let provider = LocalAuthProvider::new(config, session_manager);

        // Verify users are in the HashMap
        assert!(provider.users.contains_key("user1"));
        assert!(provider.users.contains_key("user2"));
        assert_eq!(provider.users.len(), 2);

        // Verify user details
        let user1 = provider.users.get("user1").unwrap();
        assert_eq!(user1.username, "user1");
        assert_eq!(user1.roles, vec!["admin"]);

        let user2 = provider.users.get("user2").unwrap();
        assert_eq!(user2.username, "user2");
        assert_eq!(user2.roles, vec!["user"]);
    }

    #[test]
    fn test_provider_type() {
        let config = LocalAuthConfig { users: vec![] };
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let provider = LocalAuthProvider::new(config, session_manager);

        assert_eq!(provider.provider_type(), "local");
    }
}
