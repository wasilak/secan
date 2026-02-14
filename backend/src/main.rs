use cerebro_backend::auth::{SessionConfig, SessionManager};
use cerebro_backend::cluster::Manager as ClusterManager;
use cerebro_backend::config::Config;
use cerebro_backend::Server;
use std::sync::Arc;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing with JSON formatting for structured logging
    // Supports configurable log levels via RUST_LOG environment variable
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true)
        .init();

    info!("Cerebro - Elasticsearch Web Administration Tool");
    info!("Starting backend server...");

    // Load configuration
    let config = Config::load()?;
    info!("Configuration loaded successfully");

    // Log startup configuration (sanitized - no sensitive data)
    info!(
        server_host = %config.server.host,
        server_port = config.server.port,
        auth_mode = ?config.auth.mode,
        cluster_count = config.clusters.len(),
        session_timeout_minutes = config.auth.session_timeout_minutes,
        "Startup configuration"
    );

    // Log cluster configurations (sanitized)
    for cluster in &config.clusters {
        info!(
            cluster_id = %cluster.id,
            cluster_name = %cluster.name,
            node_count = cluster.nodes.len(),
            has_auth = cluster.auth.is_some(),
            tls_verify = cluster.tls.verify,
            client_type = ?cluster.client_type,
            "Configured cluster"
        );
    }

    // Initialize cluster manager
    info!("Initializing cluster manager...");
    let cache_duration = std::time::Duration::from_secs(config.cache.metadata_duration_seconds);
    let cluster_manager = ClusterManager::new(config.clusters.clone(), cache_duration).await?;
    info!("Cluster manager initialized successfully");

    // Initialize session manager
    info!("Initializing session manager...");
    let session_config = SessionConfig::new(config.auth.session_timeout_minutes);
    let session_manager = SessionManager::new(session_config);
    info!("Session manager initialized successfully");

    // Start session cleanup task
    let cleanup_handle = Arc::new(session_manager.clone()).start_cleanup_task();
    info!("Session cleanup task started");

    // Create and start server
    info!("Creating server...");
    let server = Server::new(config, cluster_manager, session_manager);

    info!("Starting server...");

    // Run server (this will block until shutdown)
    let server_result = server.run().await;

    // Cleanup
    cleanup_handle.abort();

    server_result
}
