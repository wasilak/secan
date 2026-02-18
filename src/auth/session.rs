use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Session configuration
#[derive(Debug, Clone)]
pub struct SessionConfig {
    /// Session timeout in minutes
    pub timeout_minutes: u64,
}

impl SessionConfig {
    pub fn new(timeout_minutes: u64) -> Self {
        Self { timeout_minutes }
    }
}

/// Represents an authenticated user session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Unique session token
    pub token: String,
    /// User ID
    pub user_id: String,
    /// Username
    pub username: String,
    /// User roles for RBAC
    pub roles: Vec<String>,
    /// When the session was created
    pub created_at: DateTime<Utc>,
    /// When the session expires
    pub expires_at: DateTime<Utc>,
    /// Last activity timestamp (for session renewal)
    pub last_activity: DateTime<Utc>,
}

impl Session {
    /// Create a new session with the given parameters
    pub fn new(
        token: String,
        user_id: String,
        username: String,
        roles: Vec<String>,
        timeout_minutes: u64,
    ) -> Self {
        let now = Utc::now();
        let expires_at = now + Duration::minutes(timeout_minutes as i64);

        Self {
            token,
            user_id,
            username,
            roles,
            created_at: now,
            expires_at,
            last_activity: now,
        }
    }

    /// Check if the session has expired
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    /// Renew the session by extending the expiration time
    pub fn renew(&mut self, timeout_minutes: u64) {
        let now = Utc::now();
        self.last_activity = now;
        self.expires_at = now + Duration::minutes(timeout_minutes as i64);
    }
}

/// Authenticated user information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    /// User ID
    pub id: String,
    /// Username
    pub username: String,
    /// User roles for RBAC
    pub roles: Vec<String>,
}

impl AuthUser {
    pub fn new(id: String, username: String, roles: Vec<String>) -> Self {
        Self {
            id,
            username,
            roles,
        }
    }
}

/// Session storage using in-memory HashMap
#[derive(Debug, Clone)]
pub struct SessionStore {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

impl SessionStore {
    /// Create a new session store
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Insert a session into the store
    pub async fn insert(&self, session: Session) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.token.clone(), session);
    }

    /// Get a session by token
    pub async fn get(&self, token: &str) -> Option<Session> {
        let sessions = self.sessions.read().await;
        sessions.get(token).cloned()
    }

    /// Remove a session by token
    pub async fn remove(&self, token: &str) -> Option<Session> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(token)
    }

    /// Remove all expired sessions
    pub async fn cleanup_expired(&self) -> usize {
        let mut sessions = self.sessions.write().await;
        let initial_count = sessions.len();
        sessions.retain(|_, session| !session.is_expired());
        initial_count - sessions.len()
    }

    /// Get the number of active sessions
    pub async fn count(&self) -> usize {
        let sessions = self.sessions.read().await;
        sessions.len()
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate a cryptographically secure random session token
pub fn generate_token() -> String {
    use rand::Rng;
    const TOKEN_LENGTH: usize = 32;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let mut rng = rand::thread_rng();
    let token: String = (0..TOKEN_LENGTH)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();

    token
}

/// Session manager for handling user sessions
#[derive(Debug, Clone)]
pub struct SessionManager {
    store: SessionStore,
    config: SessionConfig,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new(config: SessionConfig) -> Self {
        Self {
            store: SessionStore::new(),
            config,
        }
    }

    /// Create a new session for a user
    pub async fn create_session(&self, user: AuthUser) -> anyhow::Result<String> {
        let token = generate_token();
        let session = Session::new(
            token.clone(),
            user.id,
            user.username,
            user.roles,
            self.config.timeout_minutes,
        );

        self.store.insert(session).await;

        tracing::info!(
            token = %token,
            timeout_minutes = self.config.timeout_minutes,
            "Session created"
        );

        Ok(token)
    }

    /// Validate a session token and return the session if valid
    pub async fn validate_session(&self, token: &str) -> anyhow::Result<Option<Session>> {
        let session = self.store.get(token).await;

        match session {
            Some(mut session) => {
                if session.is_expired() {
                    // Remove expired session
                    self.store.remove(token).await;
                    tracing::debug!(token = %token, "Session expired and removed");
                    Ok(None)
                } else {
                    // Renew session on activity
                    session.renew(self.config.timeout_minutes);
                    self.store.insert(session.clone()).await;
                    tracing::debug!(token = %token, "Session validated and renewed");
                    Ok(Some(session))
                }
            }
            None => {
                tracing::debug!(token = %token, "Session not found");
                Ok(None)
            }
        }
    }

    /// Invalidate a session (logout)
    pub async fn invalidate_session(&self, token: &str) -> anyhow::Result<()> {
        if let Some(session) = self.store.remove(token).await {
            tracing::info!(
                token = %token,
                username = %session.username,
                "Session invalidated"
            );
        } else {
            tracing::debug!(token = %token, "Session not found for invalidation");
        }
        Ok(())
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired(&self) -> usize {
        let removed_count = self.store.cleanup_expired().await;
        if removed_count > 0 {
            tracing::info!(removed_count = removed_count, "Cleaned up expired sessions");
        }
        removed_count
    }

    /// Get the number of active sessions
    pub async fn active_session_count(&self) -> usize {
        self.store.count().await
    }

    /// Start a background task to periodically clean up expired sessions
    pub fn start_cleanup_task(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
            loop {
                interval.tick().await;
                self.cleanup_expired().await;
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_creation() {
        let token = "test_token".to_string();
        let user_id = "user123".to_string();
        let username = "testuser".to_string();
        let roles = vec!["admin".to_string()];
        let timeout_minutes = 60;

        let session = Session::new(
            token.clone(),
            user_id.clone(),
            username.clone(),
            roles.clone(),
            timeout_minutes,
        );

        assert_eq!(session.token, token);
        assert_eq!(session.user_id, user_id);
        assert_eq!(session.username, username);
        assert_eq!(session.roles, roles);
        assert!(!session.is_expired());
    }

    #[test]
    fn test_session_expiration() {
        let now = Utc::now();
        let past_time = now - Duration::minutes(10);

        let mut session = Session::new(
            "token".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec![],
            60,
        );

        // Manually set expiration to the past
        session.expires_at = past_time;

        // Session should be expired
        assert!(session.is_expired());
    }

    #[test]
    fn test_session_renewal() {
        let mut session = Session::new(
            "token".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec![],
            60,
        );

        let original_expires_at = session.expires_at;

        // Wait a tiny bit to ensure time difference
        std::thread::sleep(std::time::Duration::from_millis(10));

        session.renew(60);

        // Expiration should be extended
        assert!(session.expires_at > original_expires_at);
        assert!(session.last_activity > session.created_at);
    }

    #[tokio::test]
    async fn test_session_store_insert_and_get() {
        let store = SessionStore::new();
        let session = Session::new(
            "token123".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec!["admin".to_string()],
            60,
        );

        store.insert(session.clone()).await;

        let retrieved = store.get("token123").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().token, "token123");
    }

    #[tokio::test]
    async fn test_session_store_remove() {
        let store = SessionStore::new();
        let session = Session::new(
            "token123".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec![],
            60,
        );

        store.insert(session).await;
        assert_eq!(store.count().await, 1);

        let removed = store.remove("token123").await;
        assert!(removed.is_some());
        assert_eq!(store.count().await, 0);
    }

    #[tokio::test]
    async fn test_session_store_cleanup_expired() {
        let store = SessionStore::new();

        // Insert expired session
        let expired_session = Session::new(
            "expired".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec![],
            0, // Expires immediately
        );
        store.insert(expired_session).await;

        // Insert valid session
        let valid_session = Session::new(
            "valid".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec![],
            60,
        );
        store.insert(valid_session).await;

        assert_eq!(store.count().await, 2);

        let removed_count = store.cleanup_expired().await;
        assert_eq!(removed_count, 1);
        assert_eq!(store.count().await, 1);

        // Valid session should still be there
        assert!(store.get("valid").await.is_some());
        assert!(store.get("expired").await.is_none());
    }

    #[test]
    fn test_generate_token() {
        let token1 = generate_token();
        let token2 = generate_token();

        // Tokens should be 32 characters long
        assert_eq!(token1.len(), 32);
        assert_eq!(token2.len(), 32);

        // Tokens should be different (extremely unlikely to be the same)
        assert_ne!(token1, token2);

        // Tokens should only contain alphanumeric characters
        assert!(token1.chars().all(|c| c.is_alphanumeric()));
        assert!(token2.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn test_auth_user_creation() {
        let user = AuthUser::new(
            "user123".to_string(),
            "testuser".to_string(),
            vec!["admin".to_string(), "developer".to_string()],
        );

        assert_eq!(user.id, "user123");
        assert_eq!(user.username, "testuser");
        assert_eq!(user.roles.len(), 2);
    }

    #[tokio::test]
    async fn test_session_manager_create_session() {
        let config = SessionConfig::new(60);
        let manager = SessionManager::new(config);

        let user = AuthUser::new(
            "user123".to_string(),
            "testuser".to_string(),
            vec!["admin".to_string()],
        );

        let token = manager.create_session(user).await.unwrap();
        assert!(!token.is_empty());
        assert_eq!(token.len(), 32);

        // Verify session was created
        let session = manager.validate_session(&token).await.unwrap();
        assert!(session.is_some());
        assert_eq!(session.unwrap().username, "testuser");
    }

    #[tokio::test]
    async fn test_session_manager_validate_session() {
        let config = SessionConfig::new(60);
        let manager = SessionManager::new(config);

        let user = AuthUser::new(
            "user123".to_string(),
            "testuser".to_string(),
            vec!["admin".to_string()],
        );

        let token = manager.create_session(user).await.unwrap();

        // Valid session should be returned
        let session = manager.validate_session(&token).await.unwrap();
        assert!(session.is_some());

        // Invalid token should return None
        let session = manager.validate_session("invalid_token").await.unwrap();
        assert!(session.is_none());
    }

    #[tokio::test]
    async fn test_session_manager_validate_expired_session() {
        let config = SessionConfig::new(0); // Expires immediately
        let manager = SessionManager::new(config);

        let user = AuthUser::new("user123".to_string(), "testuser".to_string(), vec![]);

        let token = manager.create_session(user).await.unwrap();

        // Session should be expired and removed
        let session = manager.validate_session(&token).await.unwrap();
        assert!(session.is_none());

        // Session should no longer exist in store
        let session = manager.validate_session(&token).await.unwrap();
        assert!(session.is_none());
    }

    #[tokio::test]
    async fn test_session_manager_invalidate_session() {
        let config = SessionConfig::new(60);
        let manager = SessionManager::new(config);

        let user = AuthUser::new("user123".to_string(), "testuser".to_string(), vec![]);

        let token = manager.create_session(user).await.unwrap();

        // Session should exist
        assert!(manager.validate_session(&token).await.unwrap().is_some());

        // Invalidate session
        manager.invalidate_session(&token).await.unwrap();

        // Session should no longer exist
        assert!(manager.validate_session(&token).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_session_manager_cleanup_expired() {
        let config = SessionConfig::new(0); // Expires immediately
        let manager = SessionManager::new(config);

        // Create multiple expired sessions
        for i in 0..5 {
            let user = AuthUser::new(format!("user{}", i), format!("username{}", i), vec![]);
            manager.create_session(user).await.unwrap();
        }

        assert_eq!(manager.active_session_count().await, 5);

        // Cleanup expired sessions
        let removed = manager.cleanup_expired().await;
        assert_eq!(removed, 5);
        assert_eq!(manager.active_session_count().await, 0);
    }

    #[tokio::test]
    async fn test_session_manager_session_renewal() {
        let config = SessionConfig::new(60);
        let manager = SessionManager::new(config);

        let user = AuthUser::new("user123".to_string(), "testuser".to_string(), vec![]);

        let token = manager.create_session(user).await.unwrap();

        // Get initial session
        let session1 = manager.validate_session(&token).await.unwrap().unwrap();
        let expires_at1 = session1.expires_at;

        // Wait a bit
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        // Validate again (should renew)
        let session2 = manager.validate_session(&token).await.unwrap().unwrap();
        let expires_at2 = session2.expires_at;

        // Expiration should be extended
        assert!(expires_at2 > expires_at1);
    }

    #[tokio::test]
    async fn test_session_manager_active_session_count() {
        let config = SessionConfig::new(60);
        let manager = SessionManager::new(config);

        assert_eq!(manager.active_session_count().await, 0);

        // Create sessions
        for i in 0..3 {
            let user = AuthUser::new(format!("user{}", i), format!("username{}", i), vec![]);
            manager.create_session(user).await.unwrap();
        }

        assert_eq!(manager.active_session_count().await, 3);
    }
}
