//! Session management for authentication
//!
//! This module provides session creation, validation, renewal, and cleanup functionality.
//! It supports both sliding window and fixed expiration renewal modes, and includes
//! rate limiting to prevent brute force attacks.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use super::config::{RenewalMode, SecurityConfig, SessionConfig};

/// User information stored in sessions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub roles: Vec<String>,
    pub groups: Vec<String>,
}

/// Session data structure
#[derive(Debug, Clone)]
struct Session {
    token: String,
    user_info: UserInfo,
    created_at: Instant,
    last_activity: Instant,
    expires_at: Instant,
}

/// Session manager for creating, validating, and managing user sessions
pub struct SessionManager {
    config: SessionConfig,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    rate_limiter: Arc<RateLimiter>,
}

impl SessionManager {
    /// Create a new SessionManager with the specified configuration
    pub fn new(config: SessionConfig, security_config: SecurityConfig) -> Self {
        let rate_limiter = Arc::new(RateLimiter::new(
            security_config.rate_limit_attempts,
            Duration::from_secs(security_config.rate_limit_window_seconds),
        ));

        let manager = Self {
            config,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            rate_limiter,
        };

        // Start background cleanup task
        manager.start_cleanup_task();

        manager
    }

    /// Generate a cryptographically secure session token with 256 bits of entropy
    fn generate_token(&self) -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let token_bytes: [u8; 32] = rng.gen(); // 256 bits of entropy
        base64::encode_config(token_bytes, base64::URL_SAFE_NO_PAD)
    }

    /// Create a new session for the specified user
    ///
    /// Returns the session token that should be stored in a cookie.
    pub async fn create_session(&self, user_info: UserInfo) -> Result<String> {
        let token = self.generate_token();
        let now = Instant::now();
        let timeout = Duration::from_secs(self.config.timeout_seconds);

        let session = Session {
            token: token.clone(),
            user_info,
            created_at: now,
            last_activity: now,
            expires_at: now + timeout,
        };

        let mut sessions = self.sessions.write().await;
        sessions.insert(token.clone(), session);

        Ok(token)
    }

    /// Validate a session token and return the associated user information
    ///
    /// This method checks if the session exists and is not expired. Depending on the
    /// renewal mode, it may extend the session expiration time.
    pub async fn validate_session(&self, token: &str) -> Result<UserInfo> {
        let mut sessions = self.sessions.write().await;

        let session = sessions
            .get_mut(token)
            .ok_or_else(|| anyhow!("Invalid session token"))?;

        let now = Instant::now();

        // Check if session is expired
        if now > session.expires_at {
            sessions.remove(token);
            return Err(anyhow!("Session expired"));
        }

        // Update session activity and expiration based on renewal mode
        match self.config.renewal_mode {
            RenewalMode::SlidingWindow => {
                // Sliding window: extend expiration on each access
                session.last_activity = now;
                session.expires_at = now + Duration::from_secs(self.config.timeout_seconds);
            }
            RenewalMode::FixedExpiration => {
                // Fixed expiration: update last activity but keep original expiration
                session.last_activity = now;
                // expires_at remains unchanged
            }
        }

        Ok(session.user_info.clone())
    }

    /// Delete a session (logout)
    pub async fn delete_session(&self, token: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(token);
        Ok(())
    }

    /// Check rate limit for the specified identifier (e.g., IP address or username)
    ///
    /// Returns an error if the rate limit is exceeded.
    pub fn check_rate_limit(&self, identifier: &str) -> Result<()> {
        self.rate_limiter.check(identifier)
    }

    /// Start a background task to periodically clean up expired sessions
    fn start_cleanup_task(&self) {
        let sessions = self.sessions.clone();
        let cleanup_interval = Duration::from_secs(60); // Clean up every minute

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(cleanup_interval);
            loop {
                interval.tick().await;

                let mut sessions = sessions.write().await;
                let now = Instant::now();

                // Remove expired sessions
                sessions.retain(|_, session| now <= session.expires_at);
            }
        });
    }
}

/// Rate limiter to prevent brute force attacks
struct RateLimiter {
    max_attempts: u32,
    window: Duration,
    attempts: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
}

impl RateLimiter {
    /// Create a new RateLimiter with the specified maximum attempts and time window
    fn new(max_attempts: u32, window: Duration) -> Self {
        Self {
            max_attempts,
            window,
            attempts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if the identifier has exceeded the rate limit
    ///
    /// Returns an error if the rate limit is exceeded.
    fn check(&self, identifier: &str) -> Result<()> {
        let mut attempts = self.attempts.blocking_write();
        let now = Instant::now();

        let entry = attempts
            .entry(identifier.to_string())
            .or_insert_with(Vec::new);

        // Remove old attempts outside the time window
        entry.retain(|&t| now.duration_since(t) < self.window);

        if entry.len() >= self.max_attempts as usize {
            return Err(anyhow!("Rate limit exceeded. Try again later."));
        }

        entry.push(now);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    fn create_test_user_info() -> UserInfo {
        UserInfo {
            id: "test-user-id".to_string(),
            username: "testuser".to_string(),
            email: Some("test@example.com".to_string()),
            roles: vec!["admin".to_string()],
            groups: vec!["developers".to_string()],
        }
    }

    #[tokio::test]
    async fn test_create_session() {
        let manager = SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        );
        let user_info = create_test_user_info();

        let token = manager.create_session(user_info.clone()).await.unwrap();
        assert!(!token.is_empty());
        assert_eq!(token.len(), 43); // Base64 encoded 32 bytes without padding
    }

    #[tokio::test]
    async fn test_validate_session() {
        let manager = SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        );
        let user_info = create_test_user_info();

        let token = manager.create_session(user_info.clone()).await.unwrap();
        let validated_user = manager.validate_session(&token).await.unwrap();

        assert_eq!(validated_user.id, user_info.id);
        assert_eq!(validated_user.username, user_info.username);
        assert_eq!(validated_user.email, user_info.email);
    }

    #[tokio::test]
    async fn test_validate_invalid_session() {
        let manager = SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        );

        let result = manager.validate_session("invalid-token").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid session token"));
    }

    #[tokio::test]
    async fn test_delete_session() {
        let manager = SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        );
        let user_info = create_test_user_info();

        let token = manager.create_session(user_info).await.unwrap();
        manager.delete_session(&token).await.unwrap();

        let result = manager.validate_session(&token).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_session_expiration_sliding_window() {
        let mut config = create_test_session_config();
        config.timeout_seconds = 1; // 1 second timeout
        config.renewal_mode = RenewalMode::SlidingWindow;

        let manager = SessionManager::new(config, create_test_security_config());
        let user_info = create_test_user_info();

        let token = manager.create_session(user_info).await.unwrap();

        // Wait for session to expire
        tokio::time::sleep(Duration::from_secs(2)).await;

        let result = manager.validate_session(&token).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Session expired"));
    }

    #[tokio::test]
    async fn test_session_renewal_sliding_window() {
        let mut config = create_test_session_config();
        config.timeout_seconds = 2; // 2 second timeout
        config.renewal_mode = RenewalMode::SlidingWindow;

        let manager = SessionManager::new(config, create_test_security_config());
        let user_info = create_test_user_info();

        let token = manager.create_session(user_info).await.unwrap();

        // Access session before expiration to renew it
        tokio::time::sleep(Duration::from_millis(1500)).await;
        let result1 = manager.validate_session(&token).await;
        assert!(result1.is_ok());

        // Wait another 1.5 seconds (total 3 seconds from creation)
        // Without renewal, session would be expired, but with sliding window it should still be valid
        tokio::time::sleep(Duration::from_millis(1500)).await;
        let result2 = manager.validate_session(&token).await;
        assert!(result2.is_ok());
    }

    #[tokio::test]
    async fn test_session_fixed_expiration() {
        let mut config = create_test_session_config();
        config.timeout_seconds = 2; // 2 second timeout
        config.renewal_mode = RenewalMode::FixedExpiration;

        let manager = SessionManager::new(config, create_test_security_config());
        let user_info = create_test_user_info();

        let token = manager.create_session(user_info).await.unwrap();

        // Access session before expiration
        tokio::time::sleep(Duration::from_millis(1500)).await;
        let result1 = manager.validate_session(&token).await;
        assert!(result1.is_ok());

        // Wait for original expiration time to pass
        tokio::time::sleep(Duration::from_millis(600)).await;
        let result2 = manager.validate_session(&token).await;
        assert!(result2.is_err());
        assert!(result2.unwrap_err().to_string().contains("Session expired"));
    }

    #[test]
    fn test_rate_limiter() {
        let limiter = RateLimiter::new(3, Duration::from_secs(60));

        // First 3 attempts should succeed
        assert!(limiter.check("user1").is_ok());
        assert!(limiter.check("user1").is_ok());
        assert!(limiter.check("user1").is_ok());

        // 4th attempt should fail
        let result = limiter.check("user1");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Rate limit exceeded"));
    }

    #[test]
    fn test_rate_limiter_different_identifiers() {
        let limiter = RateLimiter::new(2, Duration::from_secs(60));

        // Different identifiers should have separate limits
        assert!(limiter.check("user1").is_ok());
        assert!(limiter.check("user1").is_ok());
        assert!(limiter.check("user2").is_ok());
        assert!(limiter.check("user2").is_ok());

        // Both should now be at limit
        assert!(limiter.check("user1").is_err());
        assert!(limiter.check("user2").is_err());
    }

    #[test]
    fn test_generate_token_uniqueness() {
        let manager = SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        );

        let token1 = manager.generate_token();
        let token2 = manager.generate_token();

        assert_ne!(token1, token2);
        assert_eq!(token1.len(), 43); // Base64 encoded 32 bytes
        assert_eq!(token2.len(), 43);
    }

    #[test]
    fn test_generate_token_entropy() {
        let manager = SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        );

        // Generate multiple tokens and ensure they're all unique
        let mut tokens = std::collections::HashSet::new();
        for _ in 0..100 {
            let token = manager.generate_token();
            assert!(tokens.insert(token), "Generated duplicate token");
        }
    }
}
