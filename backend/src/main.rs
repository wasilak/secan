use cerebro_backend::auth::{SessionConfig, SessionManager};
use cerebro_backend::cluster::Manager as ClusterManager;
use cerebro_backend::config::Config;
use cerebro_backend::Server;
use std::sync::Arc;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    info!("Cerebro - Elasticsearch Web Administration Tool");
    info!("Starting backend server...");

    // Load configuration
    let config = Config::load()?;
    info!("Configuration loaded successfully");
    info!(
        "Server will listen on {}:{}",
        config.server.host, config.server.port
    );
    info!("Authentication mode: {:?}", config.auth.mode);
    info!("Configured clusters: {}", config.clusters.len());

    // Initialize cluster manager
    info!("Initializing cluster manager...");
    let cluster_manager = ClusterManager::new(config.clusters.clone()).await?;
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
