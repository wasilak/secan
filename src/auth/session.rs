use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ── Session configuration ─────────────────────────────────────────────────────

/// Session configuration
#[derive(Debug, Clone)]
pub struct SessionConfig {
    /// Session timeout in minutes (used for JWT `exp` and renewal threshold)
    pub timeout_minutes: u64,
    /// HMAC-SHA256 signing secret loaded from `SECAN_SESSION_SECRET`
    pub secret: String,
}

impl SessionConfig {
    pub fn new(timeout_minutes: u64, secret: String) -> Self {
        Self {
            timeout_minutes,
            secret,
        }
    }
}

// ── JWT claims (embedded in every session cookie) ─────────────────────────────

/// Claims embedded in the signed JWT stored in the `session_token` cookie.
///
/// All session state is carried inside the token; no server-side session store
/// is required for normal request validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionClaims {
    /// Subject — user ID
    pub sub: String,
    /// Human-readable username
    pub username: String,
    /// RBAC roles
    pub roles: Vec<String>,
    /// Cluster IDs accessible to this user (`"*"` means all)
    pub accessible_clusters: Vec<String>,
    /// Expiry (Unix seconds) — validated by the JWT library
    pub exp: u64,
    /// Issued-at (Unix seconds)
    pub iat: u64,
    /// JWT ID — used to revoke individual sessions on logout
    pub jti: String,
}

// ── Session (view after decoding) ─────────────────────────────────────────────

/// A decoded, validated session.  Produced by [`SessionManager::validate_session`].
#[derive(Debug, Clone)]
pub struct Session {
    /// The original JWT string (kept so the middleware can forward it or renew it)
    pub token: String,
    /// User ID (= `sub` claim)
    pub user_id: String,
    /// Username
    pub username: String,
    /// RBAC roles
    pub roles: Vec<String>,
    /// Cluster IDs accessible to this user
    pub accessible_clusters: Vec<String>,
    /// When the JWT was issued (`iat`)
    pub created_at: DateTime<Utc>,
    /// When the JWT expires (`exp`)
    pub expires_at: DateTime<Utc>,
    /// When this validation took place (= now)
    pub last_activity: DateTime<Utc>,
    /// JWT ID — forwarded for logging / revocation
    pub jti: String,
}

// ── Validation result ─────────────────────────────────────────────────────────

/// Returned by [`SessionManager::validate_session`].
///
/// When `renewed_token` is `Some`, the caller **must** update the `session_token`
/// cookie in the response so the sliding-expiry window is preserved.
#[derive(Debug)]
pub struct SessionValidation {
    /// The decoded session data
    pub session: Session,
    /// A freshly-signed JWT if the token was re-issued (TTL fell below 50 % of timeout)
    pub renewed_token: Option<String>,
}

// ── AuthUser ──────────────────────────────────────────────────────────────────

/// Authenticated user information — injected into axum request extensions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    /// User ID
    pub id: String,
    /// Username
    pub username: String,
    /// RBAC roles
    pub roles: Vec<String>,
    /// Cluster IDs accessible to this user
    #[serde(default)]
    pub accessible_clusters: Vec<String>,
}

impl AuthUser {
    pub fn new(id: String, username: String, roles: Vec<String>) -> Self {
        Self {
            id,
            username,
            roles,
            accessible_clusters: Vec::new(),
        }
    }

    /// Create an [`AuthUser`] with explicit cluster access list.
    pub fn new_with_clusters(
        id: String,
        username: String,
        roles: Vec<String>,
        accessible_clusters: Vec<String>,
    ) -> Self {
        Self {
            id,
            username,
            roles,
            accessible_clusters,
        }
    }
}

// ── Cookie helper (shared between middleware and route handlers) ───────────────

/// Build a `Set-Cookie` header value for the `session_token` cookie.
///
/// The `Secure` flag is controlled by the `SECAN_SECURE_COOKIES=true` environment
/// variable so that local HTTP development works out of the box while production
/// deployments behind an HTTPS reverse proxy can enforce it.
pub fn build_session_cookie_header(token: &str, max_age_seconds: u64) -> http::HeaderValue {
    let secure = std::env::var("SECAN_SECURE_COOKIES")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    let value = if secure {
        format!(
            "session_token={}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age={}",
            token, max_age_seconds
        )
    } else {
        format!(
            "session_token={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
            token, max_age_seconds
        )
    };

    http::HeaderValue::from_str(&value).unwrap_or_else(|e| {
        tracing::error!(error = %e, "Failed to build session cookie header");
        http::HeaderValue::from_static("session_token=invalid")
    })
}

// ── Opaque token generator (still used by OIDC state parameter) ───────────────

/// Generate a cryptographically secure random opaque token (256 bits, URL-safe base64).
///
/// Used for OIDC `state` parameters and other nonces — **not** for session tokens
/// (which are now signed JWTs).
pub fn generate_token() -> String {
    use base64::Engine;
    use getrandom::getrandom;

    let mut bytes = [0u8; 32];
    getrandom(&mut bytes).expect("secure RNG failed");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

// ── Session manager ───────────────────────────────────────────────────────────

/// Stateless JWT-based session manager.
///
/// Sessions are encoded as signed JWTs and stored **entirely in the client cookie**;
/// no server-side session store is needed.  This makes the application trivially
/// horizontally scalable and resilient to container restarts.
///
/// # Revocation
///
/// Logout adds the token's `jti` to an in-memory revocation set that is consulted
/// on every validation.  The set is bounded (entries are cleaned up after their
/// `exp` passes) and is intentionally per-instance: losing it on restart means
/// recently-logged-out JWTs could be accepted for their remaining TTL — an
/// acceptable trade-off for an internal tool.
///
/// # Key management
///
/// All replicas must share the same `SECAN_SESSION_SECRET`.  Rotating the secret
/// invalidates all active sessions (users must log in again).
#[derive(Clone)]
pub struct SessionManager {
    config: SessionConfig,
    /// Wrapped in Arc so Clone is O(1) and the keys are never copied
    encoding_key: Arc<EncodingKey>,
    decoding_key: Arc<DecodingKey>,
    /// jti → expiry timestamp of the revoked token
    revocation_list: Arc<RwLock<HashMap<String, DateTime<Utc>>>>,
}

impl std::fmt::Debug for SessionManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SessionManager")
            .field("timeout_minutes", &self.config.timeout_minutes)
            .finish()
    }
}

impl SessionManager {
    /// Create a new session manager from the given configuration.
    ///
    /// The signing secret is derived from `config.secret` using HMAC-SHA256.
    pub fn new(config: SessionConfig) -> Self {
        let encoding_key = Arc::new(EncodingKey::from_secret(config.secret.as_bytes()));
        let decoding_key = Arc::new(DecodingKey::from_secret(config.secret.as_bytes()));
        Self {
            config,
            encoding_key,
            decoding_key,
            revocation_list: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// The configured session timeout in minutes (exposed for cookie Max-Age).
    pub fn timeout_minutes(&self) -> u64 {
        self.config.timeout_minutes
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn encode_jwt(&self, claims: &SessionClaims) -> anyhow::Result<String> {
        encode(&Header::default(), claims, &self.encoding_key)
            .map_err(|e| anyhow::anyhow!("Failed to encode JWT: {}", e))
    }

    fn decode_jwt(&self, token: &str) -> anyhow::Result<SessionClaims> {
        let mut validation = Validation::new(Algorithm::HS256);
        // No grace period — we are both issuer and verifier.
        validation.leeway = 0;
        decode::<SessionClaims>(token, &self.decoding_key, &validation)
            .map(|d| d.claims)
            .map_err(|e| anyhow::anyhow!("JWT validation failed: {}", e))
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Create a new session for `user`, using the clusters already set on the user.
    pub async fn create_session(&self, user: AuthUser) -> anyhow::Result<String> {
        let clusters = user.accessible_clusters.clone();
        self.create_session_with_clusters(user, clusters).await
    }

    /// Create a new session for `user` with an explicit cluster access list.
    pub async fn create_session_with_clusters(
        &self,
        user: AuthUser,
        accessible_clusters: Vec<String>,
    ) -> anyhow::Result<String> {
        let now = Utc::now();
        let exp = (now + Duration::minutes(self.config.timeout_minutes as i64)).timestamp() as u64;

        let claims = SessionClaims {
            sub: user.id,
            username: user.username,
            roles: user.roles,
            accessible_clusters,
            exp,
            iat: now.timestamp() as u64,
            jti: Uuid::new_v4().to_string(),
        };

        let token = self.encode_jwt(&claims)?;

        tracing::debug!(
            jti = %claims.jti,
            timeout_minutes = self.config.timeout_minutes,
            "Session created"
        );

        Ok(token)
    }

    /// Validate a session token.
    ///
    /// Returns `None` when the token is invalid, expired, or revoked.
    ///
    /// When `SessionValidation::renewed_token` is `Some`, the caller should
    /// set a new `session_token` cookie in the HTTP response to slide the
    /// expiry window forward.
    pub async fn validate_session(&self, token: &str) -> anyhow::Result<Option<SessionValidation>> {
        // Decode and verify signature + expiry
        let claims = match self.decode_jwt(token) {
            Ok(c) => c,
            Err(e) => {
                tracing::debug!(error = %e, "JWT validation failed");
                return Ok(None);
            }
        };

        // Check revocation list
        {
            let revoked = self.revocation_list.read().await;
            if revoked.contains_key(&claims.jti) {
                tracing::debug!(jti = %claims.jti, "Session is revoked");
                return Ok(None);
            }
        }

        let now = Utc::now();
        let expires_at = DateTime::from_timestamp(claims.exp as i64, 0)
            .unwrap_or_else(|| now + Duration::minutes(self.config.timeout_minutes as i64));
        let created_at = DateTime::from_timestamp(claims.iat as i64, 0).unwrap_or(now);

        let session = Session {
            token: token.to_string(),
            user_id: claims.sub.clone(),
            username: claims.username.clone(),
            roles: claims.roles.clone(),
            accessible_clusters: claims.accessible_clusters.clone(),
            created_at,
            expires_at,
            last_activity: now,
            jti: claims.jti.clone(),
        };

        // Sliding expiry: re-issue when remaining TTL < 50 % of configured timeout
        let renewal_threshold = Duration::minutes((self.config.timeout_minutes / 2).max(1) as i64);
        let renewed_token = if expires_at - now < renewal_threshold {
            let new_exp =
                (now + Duration::minutes(self.config.timeout_minutes as i64)).timestamp() as u64;
            let new_claims = SessionClaims {
                sub: claims.sub,
                username: claims.username,
                roles: claims.roles,
                accessible_clusters: claims.accessible_clusters,
                exp: new_exp,
                iat: now.timestamp() as u64,
                // Fresh jti for the renewed token
                jti: Uuid::new_v4().to_string(),
            };
            match self.encode_jwt(&new_claims) {
                Ok(new_token) => {
                    tracing::debug!("Session renewed (TTL below 50 % threshold)");
                    Some(new_token)
                }
                Err(e) => {
                    tracing::warn!(error = %e, "Failed to re-issue JWT during renewal");
                    None
                }
            }
        } else {
            None
        };

        Ok(Some(SessionValidation {
            session,
            renewed_token,
        }))
    }

    /// Revoke a session by adding its `jti` to the revocation list.
    ///
    /// If the token cannot be decoded (e.g. already expired) the call succeeds
    /// silently — an already-expired token is harmless.
    pub async fn invalidate_session(&self, token: &str) -> anyhow::Result<()> {
        match self.decode_jwt(token) {
            Ok(claims) => {
                let exp =
                    DateTime::from_timestamp(claims.exp as i64, 0).unwrap_or_else(|| Utc::now());
                let mut revoked = self.revocation_list.write().await;
                revoked.insert(claims.jti.clone(), exp);
                tracing::debug!(jti = %claims.jti, username = %claims.username, "Session revoked");
            }
            Err(e) => {
                // Token is malformed or already expired — either way it cannot
                // be used, so no revocation entry is needed.
                tracing::debug!(
                    error = %e,
                    "Could not decode token for revocation (likely already expired)"
                );
            }
        }
        Ok(())
    }

    /// Clean up revocation-list entries whose tokens have already expired.
    ///
    /// Expired tokens are rejected by signature verification before the
    /// revocation list is consulted, so stale entries are purely dead weight.
    pub async fn cleanup_expired(&self) -> usize {
        let now = Utc::now();
        let mut revoked = self.revocation_list.write().await;
        let initial = revoked.len();
        revoked.retain(|_, exp| *exp > now);
        let removed = initial - revoked.len();
        if removed > 0 {
            tracing::debug!(
                removed_count = removed,
                "Cleaned up expired revocation entries"
            );
        }
        removed
    }

    /// Number of entries currently in the revocation list.
    ///
    /// This is a proxy metric used by the health endpoint; it counts **revoked**
    /// (but not yet cleaned up) sessions, not active ones.
    pub async fn active_session_count(&self) -> usize {
        self.revocation_list.read().await.len()
    }

    /// Spawn a background task that periodically removes stale revocation entries.
    pub fn start_cleanup_task(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 min
            loop {
                interval.tick().await;
                self.cleanup_expired().await;
            }
        })
    }

    /// Create a JWT that expires in `seconds_from_now` seconds.
    ///
    /// **Test-only helper** for writing deterministic renewal / expiry tests.
    #[cfg(test)]
    pub async fn create_session_expiring_in(
        &self,
        user: AuthUser,
        seconds_from_now: i64,
    ) -> anyhow::Result<String> {
        let now = Utc::now();
        let claims = SessionClaims {
            sub: user.id,
            username: user.username,
            roles: user.roles,
            accessible_clusters: user.accessible_clusters,
            exp: (now + Duration::seconds(seconds_from_now)).timestamp() as u64,
            iat: now.timestamp() as u64,
            jti: Uuid::new_v4().to_string(),
        };
        self.encode_jwt(&claims)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// A deterministic secret for unit tests.  Must be ≥ 32 characters.
    const TEST_SECRET: &str = "test-secret-key-for-unit-tests-only-32chars!!";

    fn test_config(timeout_minutes: u64) -> SessionConfig {
        SessionConfig::new(timeout_minutes, TEST_SECRET.to_string())
    }

    fn test_user() -> AuthUser {
        AuthUser::new(
            "user123".to_string(),
            "testuser".to_string(),
            vec!["admin".to_string()],
        )
    }

    // ── generate_token ────────────────────────────────────────────────────────

    #[test]
    fn test_generate_token() {
        let t1 = generate_token();
        let t2 = generate_token();

        // 32 bytes → 43 URL-safe base64 chars (no padding)
        assert_eq!(t1.len(), 43);
        assert_eq!(t2.len(), 43);
        assert_ne!(t1, t2);

        let is_url_safe = |c: char| c.is_ascii_alphanumeric() || c == '-' || c == '_';
        assert!(t1.chars().all(is_url_safe));
        assert!(t2.chars().all(is_url_safe));
    }

    // ── AuthUser ──────────────────────────────────────────────────────────────

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
        assert!(user.accessible_clusters.is_empty());
    }

    #[test]
    fn test_auth_user_with_clusters() {
        let user = AuthUser::new_with_clusters(
            "u1".to_string(),
            "alice".to_string(),
            vec!["admin".to_string()],
            vec!["prod-1".to_string(), "*".to_string()],
        );
        assert_eq!(user.accessible_clusters.len(), 2);
    }

    // ── JWT encode / decode round-trip ────────────────────────────────────────

    #[tokio::test]
    async fn test_create_session_produces_jwt() {
        let manager = SessionManager::new(test_config(60));
        let token = manager.create_session(test_user()).await.unwrap();

        // JWTs start with "ey" (base64-encoded `{"alg":...}`)
        assert!(
            token.starts_with("ey"),
            "expected JWT, got: {}",
            &token[..10]
        );
        // Three dot-separated parts
        assert_eq!(token.split('.').count(), 3);
    }

    #[tokio::test]
    async fn test_create_and_validate_session() {
        let manager = SessionManager::new(test_config(60));
        let token = manager.create_session(test_user()).await.unwrap();

        let v = manager.validate_session(&token).await.unwrap();
        assert!(v.is_some());
        let v = v.unwrap();
        assert_eq!(v.session.username, "testuser");
        assert_eq!(v.session.user_id, "user123");
        assert_eq!(v.session.roles, vec!["admin"]);
    }

    #[tokio::test]
    async fn test_validate_invalid_token_returns_none() {
        let manager = SessionManager::new(test_config(60));

        assert!(manager
            .validate_session("not.a.jwt")
            .await
            .unwrap()
            .is_none());
        assert!(manager
            .validate_session("invalid_token")
            .await
            .unwrap()
            .is_none());
    }

    #[tokio::test]
    async fn test_validate_expired_token_returns_none() {
        let manager = SessionManager::new(test_config(60));
        // Token that expired 5 minutes ago
        let expired_token = manager
            .create_session_expiring_in(test_user(), -300)
            .await
            .unwrap();

        assert!(manager
            .validate_session(&expired_token)
            .await
            .unwrap()
            .is_none());
    }

    #[tokio::test]
    async fn test_validate_wrong_secret_returns_none() {
        let manager_a = SessionManager::new(test_config(60));
        let manager_b = SessionManager::new(SessionConfig::new(
            60,
            "completely-different-secret-xyz-32chars".to_string(),
        ));

        let token = manager_a.create_session(test_user()).await.unwrap();
        assert!(manager_b.validate_session(&token).await.unwrap().is_none());
    }

    // ── Revocation ────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_invalidate_session_blocks_further_use() {
        let manager = SessionManager::new(test_config(60));
        let token = manager.create_session(test_user()).await.unwrap();

        // Valid before revocation
        assert!(manager.validate_session(&token).await.unwrap().is_some());

        manager.invalidate_session(&token).await.unwrap();

        // Rejected after revocation
        assert!(manager.validate_session(&token).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_invalidate_expired_token_is_no_op() {
        let manager = SessionManager::new(test_config(60));
        // Silently succeeds even for tokens that are already expired/invalid
        manager
            .invalidate_session("not.a.valid.jwt")
            .await
            .expect("should not error");
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_cleanup_removes_stale_revocation_entries() {
        let manager = SessionManager::new(test_config(60));

        // Populate revocation list with already-expired entries
        {
            let mut revoked = manager.revocation_list.write().await;
            for i in 0..5 {
                revoked.insert(
                    format!("jti-expired-{}", i),
                    Utc::now() - Duration::minutes(10), // already past
                );
            }
            // One future entry (should survive cleanup)
            revoked.insert("jti-valid".to_string(), Utc::now() + Duration::hours(1));
        }

        assert_eq!(manager.active_session_count().await, 6);

        let removed = manager.cleanup_expired().await;
        assert_eq!(removed, 5);
        assert_eq!(manager.active_session_count().await, 1);
    }

    // ── Sliding expiry / renewal ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_no_renewal_for_fresh_token() {
        let manager = SessionManager::new(test_config(60));
        // TTL ≈ 60 min; threshold = 30 min → no renewal expected
        let token = manager.create_session(test_user()).await.unwrap();

        let v = manager.validate_session(&token).await.unwrap().unwrap();
        assert!(
            v.renewed_token.is_none(),
            "a fresh token should not trigger renewal"
        );
    }

    #[tokio::test]
    async fn test_renewal_triggered_when_ttl_below_threshold() {
        let manager = SessionManager::new(test_config(60));
        // Expires in 10 seconds — well below the 30-minute (50 %) threshold
        let short_lived = manager
            .create_session_expiring_in(test_user(), 10)
            .await
            .unwrap();

        let v = manager
            .validate_session(&short_lived)
            .await
            .unwrap()
            .unwrap();

        assert!(
            v.renewed_token.is_some(),
            "token close to expiry should be renewed"
        );

        // The renewed token must itself be valid
        let new_token = v.renewed_token.unwrap();
        let v2 = manager.validate_session(&new_token).await.unwrap();
        assert!(v2.is_some(), "renewed token should be valid");
    }

    // ── Accessible clusters ───────────────────────────────────────────────────

    #[tokio::test]
    async fn test_session_with_accessible_clusters() {
        let manager = SessionManager::new(test_config(60));
        let clusters = vec![
            "prod-1".to_string(),
            "prod-2".to_string(),
            "dev-1".to_string(),
        ];
        let user = AuthUser::new_with_clusters(
            "u1".to_string(),
            "alice".to_string(),
            vec!["admin".to_string()],
            clusters.clone(),
        );

        let token = manager
            .create_session_with_clusters(user, clusters.clone())
            .await
            .unwrap();

        let v = manager.validate_session(&token).await.unwrap().unwrap();
        assert_eq!(v.session.accessible_clusters, clusters);
    }

    #[tokio::test]
    async fn test_session_with_wildcard_cluster() {
        let manager = SessionManager::new(test_config(60));
        let user = AuthUser::new_with_clusters(
            "u1".to_string(),
            "admin".to_string(),
            vec!["admin".to_string()],
            vec!["*".to_string()],
        );

        let token = manager
            .create_session_with_clusters(user, vec!["*".to_string()])
            .await
            .unwrap();

        let v = manager.validate_session(&token).await.unwrap().unwrap();
        assert_eq!(v.session.accessible_clusters, vec!["*"]);
    }

    // ── Multiple sessions / isolation ─────────────────────────────────────────

    #[tokio::test]
    async fn test_multiple_sessions_are_independent() {
        let manager = SessionManager::new(test_config(60));

        let user_a = AuthUser::new("a".to_string(), "alice".to_string(), vec![]);
        let user_b = AuthUser::new("b".to_string(), "bob".to_string(), vec![]);

        let token_a = manager.create_session(user_a).await.unwrap();
        let token_b = manager.create_session(user_b).await.unwrap();

        // Revoking A does not affect B
        manager.invalidate_session(&token_a).await.unwrap();
        assert!(manager.validate_session(&token_a).await.unwrap().is_none());
        assert!(manager.validate_session(&token_b).await.unwrap().is_some());
    }
}
