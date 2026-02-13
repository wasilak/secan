use cerebro_backend::config::Config;
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
    info!("Server will listen on {}:{}", config.server.host, config.server.port);
    info!("Authentication mode: {:?}", config.auth.mode);
    info!("Configured clusters: {}", config.clusters.len());

    // TODO: Initialize server
    // TODO: Start server

    Ok(())
}
