/// TTL-based cache backed by moka::future::Cache
///
/// Uses moka for automatic expiry, concurrent access, and bounded capacity.
///
/// # Requirements
///
/// Validates: Requirement 31.2 - Cache cluster metadata for configurable duration
pub type MetadataCache<T> = moka::future::Cache<String, T>;
