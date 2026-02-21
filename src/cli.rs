use clap::Parser;

/// Elasticsearch Cluster Management Tool
#[derive(Parser, Debug)]
#[command(name = "secan")]
#[command(version)]
#[command(about, long_about = None)]
pub struct Cli {
    /// Server host to bind to
    #[arg(long, env = "SECAN_SERVER_HOST", default_value = "0.0.0.0")]
    pub server_host: String,

    /// Server port to bind to
    #[arg(long, env = "SECAN_SERVER_PORT", default_value = "27182")]
    pub server_port: u16,

    /// Authentication mode: open, local_users, or oidc
    #[arg(long, env = "SECAN_AUTH_MODE", default_value = "open")]
    pub auth_mode: String,

    /// Session timeout in minutes
    #[arg(long, env = "SECAN_AUTH_SESSION_TIMEOUT_MINUTES", default_value = "60")]
    pub auth_session_timeout_minutes: u64,

    /// Cluster configuration as JSON array
    ///
    /// Example: '[{"id":"local","name":"Local","nodes":["http://localhost:9200"],"es_version":8}]'
    #[arg(long, env = "SECAN_CLUSTERS")]
    pub clusters: String,

    /// Cache metadata duration in seconds
    #[arg(long, env = "SECAN_CACHE_METADATA_DURATION", default_value = "30")]
    pub cache_metadata_duration: u64,

    /// Log level: trace, debug, info, warn, or error
    #[arg(long, env = "RUST_LOG", default_value = "info")]
    pub log_level: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_defaults() {
        let cli = Cli::parse_from(&["secan", "--clusters", "[]"]);
        assert_eq!(cli.server_host, "0.0.0.0");
        assert_eq!(cli.server_port, 27182);
        assert_eq!(cli.auth_mode, "open");
        assert_eq!(cli.auth_session_timeout_minutes, 60);
        assert_eq!(cli.cache_metadata_duration, 30);
        assert_eq!(cli.log_level, "info");
    }

    #[test]
    fn test_cli_custom_values() {
        let cli = Cli::parse_from(&[
            "secan",
            "--server-host",
            "127.0.0.1",
            "--server-port",
            "9000",
            "--auth-mode",
            "local_users",
            "--auth-session-timeout-minutes",
            "120",
            "--clusters",
            "[{\"id\":\"test\"}]",
            "--cache-metadata-duration",
            "60",
            "--log-level",
            "debug",
        ]);
        assert_eq!(cli.server_host, "127.0.0.1");
        assert_eq!(cli.server_port, 9000);
        assert_eq!(cli.auth_mode, "local_users");
        assert_eq!(cli.auth_session_timeout_minutes, 120);
        assert_eq!(cli.log_level, "debug");
        assert_eq!(cli.cache_metadata_duration, 60);
    }

    #[test]
    fn test_cli_clusters_required() {
        let result = std::panic::catch_unwind(|| {
            Cli::parse_from(&["secan"])
        });
        assert!(result.is_err());
    }
}
