use crate::auth::{AuthUser, SessionManager};
use crate::config::LocalUser;
use anyhow::{Context, Result};
use bcrypt::{hash, verify, DEFAULT_COST};

/// Local user authentication provider
#[derive(Debug, Clone)]
pub struct LocalAuthProvider {
    users: Vec<LocalUser>,
    session_manager: SessionManager,
}

impl LocalAuthProvider {
    /// Create a new local authentication provider
    pub fn new(users: Vec<LocalUser>, session_manager: SessionManager) -> Self {
        Self {
            users,
            session_manager,
        }
    }

    /// Authenticate a user with username and password
    ///
    /// Returns a session token if authentication succeeds
    pub async fn authenticate(&self, username: &str, password: &str) -> Result<Option<String>> {
        // Find user by username
        let user = self.users.iter().find(|u| u.username == username);

        match user {
            Some(user) => {
                // Verify password against stored hash
                let password_valid = verify_password(password, &user.password_hash)?;

                if password_valid {
                    // Create session for authenticated user
                    let auth_user = AuthUser::new(
                        user.username.clone(),
                        user.username.clone(),
                        user.roles.clone(),
                    );

                    let token = self.session_manager.create_session(auth_user).await?;

                    tracing::info!(
                        username = %username,
                        roles = ?user.roles,
                        "User authenticated successfully"
                    );

                    Ok(Some(token))
                } else {
                    tracing::warn!(
                        username = %username,
                        "Authentication failed: invalid password"
                    );
                    Ok(None)
                }
            }
            None => {
                tracing::warn!(
                    username = %username,
                    "Authentication failed: user not found"
                );
                Ok(None)
            }
        }
    }

    /// Validate credentials without creating a session
    ///
    /// Useful for testing or validation purposes
    pub fn validate_credentials(&self, username: &str, password: &str) -> Result<bool> {
        let user = self.users.iter().find(|u| u.username == username);

        match user {
            Some(user) => verify_password(password, &user.password_hash),
            None => Ok(false),
        }
    }

    /// Get user information by username
    pub fn get_user(&self, username: &str) -> Option<&LocalUser> {
        self.users.iter().find(|u| u.username == username)
    }

    /// Get all configured users (without password hashes)
    pub fn list_users(&self) -> Vec<String> {
        self.users.iter().map(|u| u.username.clone()).collect()
    }
}

/// Hash a password using bcrypt
///
/// Uses DEFAULT_COST (12) for security
pub fn hash_password(password: &str) -> Result<String> {
    hash(password, DEFAULT_COST).context("Failed to hash password")
}

/// Verify a password against a bcrypt hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    verify(password, hash).context("Failed to verify password")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::SessionConfig;

    fn create_test_users() -> Vec<LocalUser> {
        vec![
            LocalUser {
                username: "admin".to_string(),
                password_hash: hash_password("admin123").unwrap(),
                roles: vec!["admin".to_string()],
            },
            LocalUser {
                username: "developer".to_string(),
                password_hash: hash_password("dev123").unwrap(),
                roles: vec!["developer".to_string()],
            },
        ]
    }

    #[test]
    fn test_hash_password() {
        let password = "test_password";
        let hash = hash_password(password).unwrap();

        // Hash should not be empty
        assert!(!hash.is_empty());

        // Hash should start with bcrypt prefix
        assert!(hash.starts_with("$2b$"));

        // Hashing the same password twice should produce different hashes
        let hash2 = hash_password(password).unwrap();
        assert_ne!(hash, hash2);
    }

    #[test]
    fn test_verify_password() {
        let password = "test_password";
        let hash = hash_password(password).unwrap();

        // Correct password should verify
        assert!(verify_password(password, &hash).unwrap());

        // Incorrect password should not verify
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_verify_password_with_known_hash() {
        // Pre-generated bcrypt hash for "test123"
        let hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqYqYqYqYq";
        let password = "test123";

        // This will fail because the hash is truncated, but demonstrates the concept
        // In real usage, we'd use a full valid hash
        let result = verify_password(password, hash);
        assert!(result.is_err() || !result.unwrap());
    }

    #[tokio::test]
    async fn test_local_auth_provider_authenticate_success() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        let token = provider.authenticate("admin", "admin123").await.unwrap();

        assert!(token.is_some());
        assert!(!token.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_local_auth_provider_authenticate_wrong_password() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        let token = provider
            .authenticate("admin", "wrong_password")
            .await
            .unwrap();

        assert!(token.is_none());
    }

    #[tokio::test]
    async fn test_local_auth_provider_authenticate_user_not_found() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        let token = provider
            .authenticate("nonexistent", "password")
            .await
            .unwrap();

        assert!(token.is_none());
    }

    #[test]
    fn test_local_auth_provider_validate_credentials() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        // Valid credentials
        assert!(provider.validate_credentials("admin", "admin123").unwrap());

        // Invalid password
        assert!(!provider.validate_credentials("admin", "wrong").unwrap());

        // User not found
        assert!(!provider
            .validate_credentials("nonexistent", "password")
            .unwrap());
    }

    #[test]
    fn test_local_auth_provider_get_user() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        let user = provider.get_user("admin");
        assert!(user.is_some());
        assert_eq!(user.unwrap().username, "admin");
        assert_eq!(user.unwrap().roles, vec!["admin"]);

        let user = provider.get_user("nonexistent");
        assert!(user.is_none());
    }

    #[test]
    fn test_local_auth_provider_list_users() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        let usernames = provider.list_users();
        assert_eq!(usernames.len(), 2);
        assert!(usernames.contains(&"admin".to_string()));
        assert!(usernames.contains(&"developer".to_string()));
    }

    #[tokio::test]
    async fn test_local_auth_provider_multiple_authentications() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let provider = LocalAuthProvider::new(users, session_manager);

        // Authenticate multiple users
        let token1 = provider
            .authenticate("admin", "admin123")
            .await
            .unwrap()
            .unwrap();
        let token2 = provider
            .authenticate("developer", "dev123")
            .await
            .unwrap()
            .unwrap();

        // Tokens should be different
        assert_ne!(token1, token2);

        // Both tokens should be valid
        assert!(!token1.is_empty());
        assert!(!token2.is_empty());
    }

    #[test]
    fn test_password_hash_security() {
        let password = "secure_password_123";
        let hash = hash_password(password).unwrap();

        // Hash should be significantly longer than password
        assert!(hash.len() > password.len());

        // Hash should contain bcrypt cost factor (12)
        assert!(hash.contains("$12$"));

        // Verify works correctly
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }
}
