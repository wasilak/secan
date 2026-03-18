use crate::auth::{AuthUser, PermissionResolver, RateLimiter, SessionManager};
use crate::config::LocalUser;
use anyhow::{Context, Result};
use bcrypt::{hash, verify, DEFAULT_COST};

/// Local user authentication provider
#[derive(Debug, Clone)]
pub struct LocalAuthProvider {
    users: Vec<LocalUser>,
    session_manager: SessionManager,
    rate_limiter: Option<RateLimiter>,
    permission_resolver: PermissionResolver,
}

impl LocalAuthProvider {
    /// Create a new local authentication provider
    pub fn new(
        users: Vec<LocalUser>,
        session_manager: SessionManager,
        permission_resolver: PermissionResolver,
    ) -> Self {
        Self {
            users,
            session_manager,
            rate_limiter: None,
            permission_resolver,
        }
    }

    /// Create a new local authentication provider with rate limiting
    pub fn with_rate_limiter(
        users: Vec<LocalUser>,
        session_manager: SessionManager,
        rate_limiter: RateLimiter,
        permission_resolver: PermissionResolver,
    ) -> Self {
        Self {
            users,
            session_manager,
            rate_limiter: Some(rate_limiter),
            permission_resolver,
        }
    }

    /// Authenticate a user with username and password
    ///
    /// Returns a session token if authentication succeeds
    /// Returns None if rate limited or authentication fails
    pub async fn authenticate(&self, username: &str, password: &str) -> Result<Option<String>> {
        // Check rate limiting by username
        if let Some(rate_limiter) = &self.rate_limiter {
            if rate_limiter.is_rate_limited(username).await {
                tracing::warn!(
                    username = %username,
                    "Authentication blocked: rate limit exceeded"
                );
                return Ok(None);
            }
        }

        // Find user by username
        let user = self.users.iter().find(|u| u.username == username);

        match user {
            Some(user) => {
                // Verify password against stored hash (async to avoid blocking runtime)
                let password_valid = verify_password_async(password, &user.password_hash).await?;

                if password_valid {
                    // Record successful authentication (clears rate limit)
                    if let Some(rate_limiter) = &self.rate_limiter {
                        rate_limiter.record_success(username).await;
                    }

                    // Resolve accessible clusters based on user's groups
                    let accessible_clusters = self
                        .permission_resolver
                        .resolve_cluster_access(&user.groups);

                    // Create session for authenticated user with accessible clusters
                    let auth_user = AuthUser::new_with_clusters(
                        user.username.clone(),
                        user.username.clone(),
                        user.groups.clone(),
                        accessible_clusters.clone(),
                    );

                    let token = self.session_manager.create_session(auth_user).await?;

                    tracing::info!(
                        username = %username,
                        groups = ?user.groups,
                        accessible_clusters = ?accessible_clusters,
                        "User authenticated successfully"
                    );

                    Ok(Some(token))
                } else {
                    // Record failed attempt
                    if let Some(rate_limiter) = &self.rate_limiter {
                        rate_limiter.record_failed_attempt(username).await;
                    }

                    tracing::warn!(
                        username = %username,
                        "Authentication failed: invalid password"
                    );
                    Ok(None)
                }
            }
            None => {
                // Record failed attempt even for non-existent users
                // to prevent username enumeration attacks
                if let Some(rate_limiter) = &self.rate_limiter {
                    rate_limiter.record_failed_attempt(username).await;
                }

                tracing::warn!(
                    username = %username,
                    "Authentication failed: user not found"
                );
                Ok(None)
            }
        }
    }

    /// Authenticate with IP-based rate limiting
    ///
    /// Checks both username and IP address for rate limiting
    pub async fn authenticate_with_ip(
        &self,
        username: &str,
        password: &str,
        ip_address: &str,
    ) -> Result<Option<String>> {
        // Check rate limiting by IP address
        if let Some(rate_limiter) = &self.rate_limiter {
            if rate_limiter.is_rate_limited(ip_address).await {
                tracing::warn!(
                    username = %username,
                    ip = %ip_address,
                    "Authentication blocked: IP rate limit exceeded"
                );
                return Ok(None);
            }

            // Also check username-based rate limiting
            if rate_limiter.is_rate_limited(username).await {
                tracing::warn!(
                    username = %username,
                    ip = %ip_address,
                    "Authentication blocked: username rate limit exceeded"
                );
                return Ok(None);
            }
        }

        // Find user by username
        let user = self.users.iter().find(|u| u.username == username);

        match user {
            Some(user) => {
                // Verify password against stored hash (async to avoid blocking runtime)
                let password_valid = verify_password_async(password, &user.password_hash).await?;

                if password_valid {
                    // Record successful authentication (clears rate limits)
                    if let Some(rate_limiter) = &self.rate_limiter {
                        rate_limiter.record_success(username).await;
                        rate_limiter.record_success(ip_address).await;
                    }

                    // Resolve accessible clusters based on user's groups
                    let accessible_clusters = self
                        .permission_resolver
                        .resolve_cluster_access(&user.groups);

                    // Create session for authenticated user with accessible clusters
                    let auth_user = AuthUser::new_with_clusters(
                        user.username.clone(),
                        user.username.clone(),
                        user.groups.clone(),
                        accessible_clusters.clone(),
                    );

                    let token = self.session_manager.create_session(auth_user).await?;

                    tracing::info!(
                        username = %username,
                        ip = %ip_address,
                        groups = ?user.groups,
                        accessible_clusters = ?accessible_clusters,
                        "User authenticated successfully"
                    );

                    Ok(Some(token))
                } else {
                    // Record failed attempt for both username and IP
                    if let Some(rate_limiter) = &self.rate_limiter {
                        rate_limiter.record_failed_attempt(username).await;
                        rate_limiter.record_failed_attempt(ip_address).await;
                    }

                    tracing::warn!(
                        username = %username,
                        ip = %ip_address,
                        "Authentication failed: invalid password"
                    );
                    Ok(None)
                }
            }
            None => {
                // Record failed attempt for both username and IP
                if let Some(rate_limiter) = &self.rate_limiter {
                    rate_limiter.record_failed_attempt(username).await;
                    rate_limiter.record_failed_attempt(ip_address).await;
                }

                tracing::warn!(
                    username = %username,
                    ip = %ip_address,
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

/// Verify a password asynchronously using spawn_blocking
///
/// This prevents blocking the async runtime during bcrypt verification,
/// which is CPU-intensive and can take 100-500ms per verification.
///
/// # Arguments
///
/// * `password` - The plaintext password to verify
/// * `hash` - The bcrypt hash to verify against
///
/// # Returns
///
/// Returns `Ok(true)` if password matches, `Ok(false)` if it doesn't,
/// or an error if verification fails.
///
/// # Errors
///
/// Returns an error if:
/// - The hash format is invalid
/// - bcrypt internal error occurs
/// - spawn_blocking fails (falls back to sync verification with warning)
pub async fn verify_password_async(password: &str, hash: &str) -> Result<bool> {
    // Clone data for the blocking task and fallback
    let password_owned = password.to_string();
    let hash_owned = hash.to_string();

    // Use spawn_blocking to offload CPU-intensive bcrypt to dedicated thread pool
    match tokio::task::spawn_blocking(move || verify_password(&password_owned, &hash_owned)).await {
        Ok(result) => result,
        Err(e) => {
            // spawn_blocking failed (e.g., pool shut down) - fall back to sync
            // Note: we can't use the owned values here as they were moved into the closure,
            // so we fall back to using the original references
            tracing::warn!(
                error = %e,
                "spawn_blocking failed for password verification, falling back to synchronous"
            );
            verify_password(password, hash)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::{RateLimitConfig, RateLimiter, SessionConfig};

    fn create_test_users() -> Vec<LocalUser> {
        vec![
            LocalUser {
                username: "admin".to_string(),
                password_hash: hash_password("admin123").unwrap(),
                groups: vec!["admin".to_string()],
            },
            LocalUser {
                username: "developer".to_string(),
                password_hash: hash_password("dev123").unwrap(),
                groups: vec!["developer".to_string()],
            },
        ]
    }

    #[test]
    fn test_hash_password() {
        let password = "test_password";
        let hash = hash_password(password).unwrap();

        assert!(!hash.is_empty());
        assert!(hash.starts_with("$2b$"));

        let hash2 = hash_password(password).unwrap();
        assert_ne!(hash, hash2);
    }

    #[test]
    fn test_verify_password() {
        let password = "test_password";
        let hash = hash_password(password).unwrap();

        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[tokio::test]
    async fn test_verify_password_async() {
        let password = "test_password";
        let hash = hash_password(password).unwrap();

        // Test correct password
        assert!(verify_password_async(password, &hash).await.unwrap());

        // Test wrong password
        assert!(!verify_password_async("wrong_password", &hash)
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn test_verify_password_async_non_blocking() {
        let password = "test_password";
        let hash = hash_password(password).unwrap();

        // Spawn multiple concurrent verifications to ensure they don't block each other
        let handles: Vec<_> = (0..5)
            .map(|i| {
                let pwd = if i % 2 == 0 {
                    password.to_string()
                } else {
                    "wrong_password".to_string()
                };
                let hash = hash.clone();
                tokio::spawn(async move { verify_password_async(&pwd, &hash).await })
            })
            .collect();

        // All should complete successfully
        for (i, handle) in handles.into_iter().enumerate() {
            let result = handle.await.unwrap().unwrap();
            if i % 2 == 0 {
                assert!(result, "Even-indexed tasks should verify successfully");
            } else {
                assert!(!result, "Odd-indexed tasks should fail verification");
            }
        }
    }

    #[tokio::test]
    async fn test_local_auth_provider_authenticate_success() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let permission_resolver = PermissionResolver::empty();
        let provider = LocalAuthProvider::new(users, session_manager, permission_resolver);

        let token = provider.authenticate("admin", "admin123").await.unwrap();
        assert!(token.is_some());
    }

    #[tokio::test]
    async fn test_local_auth_provider_with_rate_limiter() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let rate_limit_config = RateLimitConfig::new(3, 300, 900);
        let rate_limiter = RateLimiter::new(rate_limit_config);
        let permission_resolver = PermissionResolver::empty();
        let provider = LocalAuthProvider::with_rate_limiter(
            users,
            session_manager,
            rate_limiter,
            permission_resolver,
        );

        let token = provider.authenticate("admin", "admin123").await.unwrap();
        assert!(token.is_some());
    }

    #[tokio::test]
    async fn test_local_auth_provider_rate_limiting() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let rate_limit_config = RateLimitConfig::new(3, 300, 900);
        let rate_limiter = RateLimiter::new(rate_limit_config);
        let permission_resolver = PermissionResolver::empty();
        let provider = LocalAuthProvider::with_rate_limiter(
            users,
            session_manager,
            rate_limiter,
            permission_resolver,
        );

        // Make 3 failed attempts
        for _ in 0..3 {
            let token = provider
                .authenticate("admin", "wrong_password")
                .await
                .unwrap();
            assert!(token.is_none());
        }

        // Fourth attempt should be blocked even with correct password
        let token = provider.authenticate("admin", "admin123").await.unwrap();
        assert!(token.is_none());
    }

    #[tokio::test]
    async fn test_local_auth_provider_ip_rate_limiting() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let rate_limit_config = RateLimitConfig::new(3, 300, 900);
        let rate_limiter = RateLimiter::new(rate_limit_config);
        let permission_resolver = PermissionResolver::empty();
        let provider = LocalAuthProvider::with_rate_limiter(
            users,
            session_manager,
            rate_limiter,
            permission_resolver,
        );

        let ip = "192.168.1.100";

        // Make 3 failed attempts from same IP
        for _ in 0..3 {
            let token = provider
                .authenticate_with_ip("admin", "wrong_password", ip)
                .await
                .unwrap();
            assert!(token.is_none());
        }

        // Fourth attempt should be blocked by IP rate limit
        let token = provider
            .authenticate_with_ip("admin", "admin123", ip)
            .await
            .unwrap();
        assert!(token.is_none());
    }

    #[tokio::test]
    async fn test_local_auth_provider_success_clears_rate_limit() {
        let users = create_test_users();
        let session_config = SessionConfig::new(60);
        let session_manager = SessionManager::new(session_config);
        let rate_limit_config = RateLimitConfig::new(5, 300, 900);
        let rate_limiter = RateLimiter::new(rate_limit_config);
        let permission_resolver = PermissionResolver::empty();
        let provider = LocalAuthProvider::with_rate_limiter(
            users,
            session_manager,
            rate_limiter,
            permission_resolver,
        );

        // Make 2 failed attempts
        provider
            .authenticate("admin", "wrong_password")
            .await
            .unwrap();
        provider
            .authenticate("admin", "wrong_password")
            .await
            .unwrap();

        // Successful authentication should clear rate limit
        let token = provider.authenticate("admin", "admin123").await.unwrap();
        assert!(token.is_some());

        // Should be able to make more attempts now
        provider
            .authenticate("admin", "wrong_password")
            .await
            .unwrap();
        provider
            .authenticate("admin", "wrong_password")
            .await
            .unwrap();
    }
}
