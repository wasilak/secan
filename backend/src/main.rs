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

    // TODO: Load configuration
    // TODO: Initialize server
    // TODO: Start server

    Ok(())
}
