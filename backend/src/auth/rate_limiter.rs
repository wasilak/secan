use chrono::{DateTime, Duration, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Configuration for rate limiting
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Maximum number of failed attempts allowed
    pub max_attempts: u32,
    /// Time window in seconds for tracking attempts
    pub window_seconds: u64,
    /// How long to block after exceeding limit (in seconds)
    pub block_duration_seconds: u64,
}

impl RateLimitConfig {
    pub fn new(max_attempts: u32, window_seconds: u64, block_duration_seconds: u64) -> Self {
        Self {
            max_attempts,
            window_seconds,
            block_duration_seconds,
        }
    }
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            window_seconds: 300,         // 5 minutes
            block_duration_seconds: 900, // 15 minutes
        }
    }
}

/// Tracks authentication attempts for a specific identifier (IP or username)
#[derive(Debug, Clone)]
struct AttemptRecord {
    /// List of failed attempt timestamps
    attempts: Vec<DateTime<Utc>>,
    /// When the identifier was blocked (if blocked)
    blocked_until: Option<DateTime<Utc>>,
}

impl AttemptRecord {
    fn new() -> Self {
        Self {
            attempts: Vec::new(),
            blocked_until: None,
        }
    }

    /// Check if currently blocked
    fn is_blocked(&self) -> bool {
        if let Some(blocked_until) = self.blocked_until {
            Utc::now() < blocked_until
        } else {
            false
        }
    }

    /// Add a failed attempt
    fn add_attempt(&mut self, timestamp: DateTime<Utc>) {
        self.attempts.push(timestamp);
    }

    /// Remove attempts older than the window
    fn cleanup_old_attempts(&mut self, window: Duration) {
        let cutoff = Utc::now() - window;
        self.attempts.retain(|&timestamp| timestamp > cutoff);
    }

    /// Count attempts within the window
    fn count_recent_attempts(&self, window: Duration) -> usize {
        let cutoff = Utc::now() - window;
        self.attempts.iter().filter(|&&t| t > cutoff).count()
    }

    /// Block the identifier
    fn block(&mut self, duration: Duration) {
        self.blocked_until = Some(Utc::now() + duration);
    }

    /// Clear the block
    fn unblock(&mut self) {
        self.blocked_until = None;
        self.attempts.clear();
    }
}

/// Rate limiter for authentication attempts
#[derive(Debug, Clone)]
pub struct RateLimiter {
    config: RateLimitConfig,
    records: Arc<RwLock<HashMap<String, AttemptRecord>>>,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            records: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if an identifier is currently rate limited
    ///
    /// Returns true if the identifier is blocked
    pub async fn is_rate_limited(&self, identifier: &str) -> bool {
        let records = self.records.read().await;

        if let Some(record) = records.get(identifier) {
            record.is_blocked()
        } else {
            false
        }
    }

    /// Record a failed authentication attempt
    ///
    /// Returns true if the identifier should now be blocked
    pub async fn record_failed_attempt(&self, identifier: &str) -> bool {
        let mut records = self.records.write().await;

        let record = records
            .entry(identifier.to_string())
            .or_insert_with(AttemptRecord::new);

        // Clean up old attempts
        let window = Duration::seconds(self.config.window_seconds as i64);
        record.cleanup_old_attempts(window);

        // Add new attempt
        record.add_attempt(Utc::now());

        // Check if we should block
        let recent_attempts = record.count_recent_attempts(window);
        if recent_attempts >= self.config.max_attempts as usize {
            let block_duration = Duration::seconds(self.config.block_duration_seconds as i64);
            record.block(block_duration);

            tracing::warn!(
                identifier = %identifier,
                attempts = recent_attempts,
                block_duration_seconds = self.config.block_duration_seconds,
                "Rate limit exceeded, blocking identifier"
            );

            true
        } else {
            tracing::debug!(
                identifier = %identifier,
                attempts = recent_attempts,
                max_attempts = self.config.max_attempts,
                "Failed authentication attempt recorded"
            );

            false
        }
    }

    /// Record a successful authentication attempt
    ///
    /// Clears any failed attempts for the identifier
    pub async fn record_success(&self, identifier: &str) {
        let mut records = self.records.write().await;

        if let Some(record) = records.get_mut(identifier) {
            record.unblock();
            tracing::debug!(
                identifier = %identifier,
                "Successful authentication, clearing rate limit records"
            );
        }
    }

    /// Get the number of recent failed attempts for an identifier
    pub async fn get_attempt_count(&self, identifier: &str) -> usize {
        let records = self.records.read().await;

        if let Some(record) = records.get(identifier) {
            let window = Duration::seconds(self.config.window_seconds as i64);
            record.count_recent_attempts(window)
        } else {
            0
        }
    }

    /// Get the time remaining until an identifier is unblocked
    ///
    /// Returns None if not blocked
    pub async fn get_block_remaining(&self, identifier: &str) -> Option<i64> {
        let records = self.records.read().await;

        if let Some(record) = records.get(identifier) {
            if let Some(blocked_until) = record.blocked_until {
                let now = Utc::now();
                if blocked_until > now {
                    return Some((blocked_until - now).num_seconds());
                }
            }
        }

        None
    }

    /// Manually unblock an identifier (for admin purposes)
    pub async fn unblock(&self, identifier: &str) {
        let mut records = self.records.write().await;

        if let Some(record) = records.get_mut(identifier) {
            record.unblock();
            tracing::info!(
                identifier = %identifier,
                "Manually unblocked identifier"
            );
        }
    }

    /// Clean up expired blocks and old attempts
    pub async fn cleanup(&self) {
        let mut records = self.records.write().await;

        let window = Duration::seconds(self.config.window_seconds as i64);
        let now = Utc::now();

        // Remove records that are no longer blocked and have no recent attempts
        records.retain(|_, record| {
            // Keep if blocked
            if let Some(blocked_until) = record.blocked_until {
                if blocked_until > now {
                    return true;
                }
            }

            // Keep if has recent attempts
            let cutoff = now - window;
            record.attempts.iter().any(|&t| t > cutoff)
        });

        tracing::debug!(
            remaining_records = records.len(),
            "Cleaned up rate limiter records"
        );
    }

    /// Start a background task to periodically clean up expired records
    pub fn start_cleanup_task(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
            loop {
                interval.tick().await;
                self.cleanup().await;
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_config_default() {
        let config = RateLimitConfig::default();
        assert_eq!(config.max_attempts, 5);
        assert_eq!(config.window_seconds, 300);
        assert_eq!(config.block_duration_seconds, 900);
    }

    #[test]
    fn test_attempt_record_is_blocked() {
        let mut record = AttemptRecord::new();
        assert!(!record.is_blocked());

        record.blocked_until = Some(Utc::now() + Duration::seconds(60));
        assert!(record.is_blocked());

        record.blocked_until = Some(Utc::now() - Duration::seconds(60));
        assert!(!record.is_blocked());
    }

    #[test]
    fn test_attempt_record_cleanup() {
        let mut record = AttemptRecord::new();

        // Add old and recent attempts
        record.add_attempt(Utc::now() - Duration::seconds(400));
        record.add_attempt(Utc::now() - Duration::seconds(200));
        record.add_attempt(Utc::now() - Duration::seconds(100));

        assert_eq!(record.attempts.len(), 3);

        // Clean up attempts older than 5 minutes (300 seconds)
        record.cleanup_old_attempts(Duration::seconds(300));

        // Only the two recent attempts should remain
        assert_eq!(record.attempts.len(), 2);
    }

    #[test]
    fn test_attempt_record_count_recent() {
        let mut record = AttemptRecord::new();

        record.add_attempt(Utc::now() - Duration::seconds(400));
        record.add_attempt(Utc::now() - Duration::seconds(200));
        record.add_attempt(Utc::now() - Duration::seconds(100));

        let count = record.count_recent_attempts(Duration::seconds(300));
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn test_rate_limiter_not_blocked_initially() {
        let config = RateLimitConfig::new(3, 300, 900);
        let limiter = RateLimiter::new(config);

        assert!(!limiter.is_rate_limited("test_user").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_blocks_after_max_attempts() {
        let config = RateLimitConfig::new(3, 300, 900);
        let limiter = RateLimiter::new(config);

        // First two attempts should not block
        assert!(!limiter.record_failed_attempt("test_user").await);
        assert!(!limiter.record_failed_attempt("test_user").await);

        // Third attempt should trigger block
        assert!(limiter.record_failed_attempt("test_user").await);

        // Should now be rate limited
        assert!(limiter.is_rate_limited("test_user").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_different_identifiers() {
        let config = RateLimitConfig::new(3, 300, 900);
        let limiter = RateLimiter::new(config);

        // Block user1
        limiter.record_failed_attempt("user1").await;
        limiter.record_failed_attempt("user1").await;
        limiter.record_failed_attempt("user1").await;

        // user1 should be blocked
        assert!(limiter.is_rate_limited("user1").await);

        // user2 should not be blocked
        assert!(!limiter.is_rate_limited("user2").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_success_clears_attempts() {
        let config = RateLimitConfig::new(3, 300, 900);
        let limiter = RateLimiter::new(config);

        // Record some failed attempts
        limiter.record_failed_attempt("test_user").await;
        limiter.record_failed_attempt("test_user").await;

        assert_eq!(limiter.get_attempt_count("test_user").await, 2);

        // Record success
        limiter.record_success("test_user").await;

        // Attempts should be cleared
        assert_eq!(limiter.get_attempt_count("test_user").await, 0);
        assert!(!limiter.is_rate_limited("test_user").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_get_attempt_count() {
        let config = RateLimitConfig::new(5, 300, 900);
        let limiter = RateLimiter::new(config);

        assert_eq!(limiter.get_attempt_count("test_user").await, 0);

        limiter.record_failed_attempt("test_user").await;
        assert_eq!(limiter.get_attempt_count("test_user").await, 1);

        limiter.record_failed_attempt("test_user").await;
        assert_eq!(limiter.get_attempt_count("test_user").await, 2);
    }

    #[tokio::test]
    async fn test_rate_limiter_get_block_remaining() {
        let config = RateLimitConfig::new(2, 300, 60); // 60 second block
        let limiter = RateLimiter::new(config);

        // Not blocked initially
        assert!(limiter.get_block_remaining("test_user").await.is_none());

        // Trigger block
        limiter.record_failed_attempt("test_user").await;
        limiter.record_failed_attempt("test_user").await;

        // Should have block time remaining
        let remaining = limiter.get_block_remaining("test_user").await;
        assert!(remaining.is_some());
        assert!(remaining.unwrap() > 0);
        assert!(remaining.unwrap() <= 60);
    }

    #[tokio::test]
    async fn test_rate_limiter_manual_unblock() {
        let config = RateLimitConfig::new(2, 300, 900);
        let limiter = RateLimiter::new(config);

        // Trigger block
        limiter.record_failed_attempt("test_user").await;
        limiter.record_failed_attempt("test_user").await;

        assert!(limiter.is_rate_limited("test_user").await);

        // Manually unblock
        limiter.unblock("test_user").await;

        assert!(!limiter.is_rate_limited("test_user").await);
        assert_eq!(limiter.get_attempt_count("test_user").await, 0);
    }

    #[tokio::test]
    async fn test_rate_limiter_cleanup() {
        let config = RateLimitConfig::new(5, 1, 1); // 1 second window and block
        let limiter = RateLimiter::new(config);

        // Add some attempts
        limiter.record_failed_attempt("user1").await;
        limiter.record_failed_attempt("user2").await;

        // Wait for window to expire
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Cleanup should remove old records
        limiter.cleanup().await;

        // Attempts should be gone
        assert_eq!(limiter.get_attempt_count("user1").await, 0);
        assert_eq!(limiter.get_attempt_count("user2").await, 0);
    }

    #[tokio::test]
    async fn test_rate_limiter_window_expiration() {
        let config = RateLimitConfig::new(3, 1, 900); // 1 second window
        let limiter = RateLimiter::new(config);

        // Add two attempts
        limiter.record_failed_attempt("test_user").await;
        limiter.record_failed_attempt("test_user").await;

        assert_eq!(limiter.get_attempt_count("test_user").await, 2);

        // Wait for window to expire
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Old attempts should not count
        assert_eq!(limiter.get_attempt_count("test_user").await, 0);

        // Should be able to make new attempts without blocking
        assert!(!limiter.record_failed_attempt("test_user").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_ip_based() {
        let config = RateLimitConfig::new(3, 300, 900);
        let limiter = RateLimiter::new(config);

        let ip = "192.168.1.100";

        // Simulate failed attempts from IP
        limiter.record_failed_attempt(ip).await;
        limiter.record_failed_attempt(ip).await;
        limiter.record_failed_attempt(ip).await;

        assert!(limiter.is_rate_limited(ip).await);
    }

    #[tokio::test]
    async fn test_rate_limiter_username_based() {
        let config = RateLimitConfig::new(3, 300, 900);
        let limiter = RateLimiter::new(config);

        let username = "admin";

        // Simulate failed attempts for username
        limiter.record_failed_attempt(username).await;
        limiter.record_failed_attempt(username).await;
        limiter.record_failed_attempt(username).await;

        assert!(limiter.is_rate_limited(username).await);
    }
}
