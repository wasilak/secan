//! Default configuration values for Secan
//! These are used as the base layer in config-rs builder

pub const DEFAULT_SERVER_HOST: &str = "0.0.0.0";
pub const DEFAULT_SERVER_PORT: u16 = 27182;
pub const DEFAULT_AUTH_MODE: &str = "open";
pub const DEFAULT_AUTH_SESSION_TIMEOUT_MINUTES: u64 = 60;
pub const DEFAULT_CACHE_METADATA_DURATION_SECONDS: u64 = 30;
