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
        let session = Session::new(
            "token".to_string(),
            "user".to_string(),
            "username".to_string(),
            vec![],
            0, // Expires immediately
        );

        // Session should be expired since timeout is 0
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
}
