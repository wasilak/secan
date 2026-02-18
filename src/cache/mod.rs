use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// A simple TTL-based cache for cluster metadata
///
/// This cache stores values with a time-to-live (TTL) and automatically
/// expires entries after the TTL has elapsed.
///
/// # Requirements
///
/// Validates: Requirement 31.2 - Cache cluster metadata for configurable duration
#[derive(Clone, Debug)]
pub struct MetadataCache<T: Clone> {
    /// Internal storage with expiration times
    store: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    /// Time-to-live for cache entries
    ttl: Duration,
}

/// A cache entry with value and expiration time
#[derive(Clone, Debug)]
struct CacheEntry<T: Clone> {
    value: T,
    expires_at: Instant,
}

impl<T: Clone> MetadataCache<T> {
    /// Create a new cache with the specified TTL
    ///
    /// # Arguments
    ///
    /// * `ttl` - Time-to-live for cache entries
    ///
    /// # Returns
    ///
    /// A new MetadataCache instance
    pub fn new(ttl: Duration) -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
            ttl,
        }
    }

    /// Get a value from the cache
    ///
    /// Returns None if the key doesn't exist or the entry has expired.
    ///
    /// # Arguments
    ///
    /// * `key` - The cache key
    ///
    /// # Returns
    ///
    /// The cached value if it exists and hasn't expired, None otherwise
    pub async fn get(&self, key: &str) -> Option<T> {
        let store = self.store.read().await;

        if let Some(entry) = store.get(key) {
            if Instant::now() < entry.expires_at {
                return Some(entry.value.clone());
            }
        }

        None
    }

    /// Insert a value into the cache
    ///
    /// The value will expire after the configured TTL.
    ///
    /// # Arguments
    ///
    /// * `key` - The cache key
    /// * `value` - The value to cache
    pub async fn insert(&self, key: String, value: T) {
        let mut store = self.store.write().await;

        let entry = CacheEntry {
            value,
            expires_at: Instant::now() + self.ttl,
        };

        store.insert(key, entry);
    }

    /// Remove a value from the cache
    ///
    /// # Arguments
    ///
    /// * `key` - The cache key to remove
    pub async fn remove(&self, key: &str) {
        let mut store = self.store.write().await;
        store.remove(key);
    }

    /// Clear all entries from the cache
    pub async fn clear(&self) {
        let mut store = self.store.write().await;
        store.clear();
    }

    /// Remove expired entries from the cache
    ///
    /// This is called automatically during get operations, but can also
    /// be called manually to free memory.
    pub async fn cleanup_expired(&self) {
        let mut store = self.store.write().await;
        let now = Instant::now();

        store.retain(|_, entry| now < entry.expires_at);
    }

    /// Get the number of entries in the cache (including expired ones)
    pub async fn len(&self) -> usize {
        let store = self.store.read().await;
        store.len()
    }

    /// Check if the cache is empty
    pub async fn is_empty(&self) -> bool {
        let store = self.store.read().await;
        store.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_cache_insert_and_get() {
        let cache = MetadataCache::new(Duration::from_secs(60));

        cache.insert("key1".to_string(), "value1".to_string()).await;

        let value = cache.get("key1").await;
        assert_eq!(value, Some("value1".to_string()));
    }

    #[tokio::test]
    async fn test_cache_get_nonexistent() {
        let cache: MetadataCache<String> = MetadataCache::new(Duration::from_secs(60));

        let value = cache.get("nonexistent").await;
        assert_eq!(value, None);
    }

    #[tokio::test]
    async fn test_cache_expiration() {
        let cache = MetadataCache::new(Duration::from_millis(100));

        cache.insert("key1".to_string(), "value1".to_string()).await;

        // Value should exist immediately
        let value = cache.get("key1").await;
        assert_eq!(value, Some("value1".to_string()));

        // Wait for expiration
        sleep(Duration::from_millis(150)).await;

        // Value should be expired
        let value = cache.get("key1").await;
        assert_eq!(value, None);
    }

    #[tokio::test]
    async fn test_cache_remove() {
        let cache = MetadataCache::new(Duration::from_secs(60));

        cache.insert("key1".to_string(), "value1".to_string()).await;

        let value = cache.get("key1").await;
        assert_eq!(value, Some("value1".to_string()));

        cache.remove("key1").await;

        let value = cache.get("key1").await;
        assert_eq!(value, None);
    }

    #[tokio::test]
    async fn test_cache_clear() {
        let cache = MetadataCache::new(Duration::from_secs(60));

        cache.insert("key1".to_string(), "value1".to_string()).await;
        cache.insert("key2".to_string(), "value2".to_string()).await;

        assert_eq!(cache.len().await, 2);

        cache.clear().await;

        assert_eq!(cache.len().await, 0);
        assert!(cache.is_empty().await);
    }

    #[tokio::test]
    async fn test_cache_cleanup_expired() {
        let cache = MetadataCache::new(Duration::from_millis(100));

        cache.insert("key1".to_string(), "value1".to_string()).await;
        cache.insert("key2".to_string(), "value2".to_string()).await;

        assert_eq!(cache.len().await, 2);

        // Wait for expiration
        sleep(Duration::from_millis(150)).await;

        // Cleanup expired entries
        cache.cleanup_expired().await;

        assert_eq!(cache.len().await, 0);
    }

    #[tokio::test]
    async fn test_cache_update_value() {
        let cache = MetadataCache::new(Duration::from_secs(60));

        cache.insert("key1".to_string(), "value1".to_string()).await;

        let value = cache.get("key1").await;
        assert_eq!(value, Some("value1".to_string()));

        // Update the value
        cache.insert("key1".to_string(), "value2".to_string()).await;

        let value = cache.get("key1").await;
        assert_eq!(value, Some("value2".to_string()));
    }

    #[tokio::test]
    async fn test_cache_concurrent_access() {
        let cache = Arc::new(MetadataCache::new(Duration::from_secs(60)));

        let cache1 = cache.clone();
        let handle1 = tokio::spawn(async move {
            for i in 0..100 {
                cache1
                    .insert(format!("key{}", i), format!("value{}", i))
                    .await;
            }
        });

        let cache2 = cache.clone();
        let handle2 = tokio::spawn(async move {
            for i in 0..100 {
                let _ = cache2.get(&format!("key{}", i)).await;
            }
        });

        handle1.await.unwrap();
        handle2.await.unwrap();

        // All keys should be present
        assert_eq!(cache.len().await, 100);
    }
}
