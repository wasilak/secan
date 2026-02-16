use secan::config::Config;

fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    println!("=== Testing Configuration Loading ===\n");

    // Test 1: Load from file
    println!("Test 1: Loading from config.test.yaml");
    let config = Config::load()?;
    println!("  Server: {}:{}", config.server.host, config.server.port);
    println!("  Auth mode: {:?}", config.auth.mode);
    println!("  Clusters: {}", config.clusters.len());
    if !config.clusters.is_empty() {
        println!(
            "  First cluster: {} ({})",
            config.clusters[0].name, config.clusters[0].id
        );
    }

    println!("\n✅ Configuration loaded successfully!");
    println!("\nEnvironment variables checked:");
    println!(
        "  SECAN_CONFIG_FILE: {:?}",
        std::env::var("SECAN_CONFIG_FILE").ok()
    );
    println!(
        "  SECAN_SERVER__PORT: {:?}",
        std::env::var("SECAN_SERVER__PORT").ok()
    );
    println!(
        "  SECAN_SERVER__HOST: {:?}",
        std::env::var("SECAN_SERVER__HOST").ok()
    );

    Ok(())
}
