use anyhow::Context;
use secan::auth::{SessionConfig, SessionManager};
use secan::cluster::Manager as ClusterManager;
use secan::config::Config;
use secan::telemetry;
use secan::Server;
use std::env;
use std::sync::Arc;
use tracing::info;

/// Generate bcrypt password hash
fn generate_password_hash(password: &str) -> Result<String, anyhow::Error> {
    use bcrypt::{hash, DEFAULT_COST};
    hash(password, DEFAULT_COST)
        .map_err(|e| anyhow::anyhow!("Failed to generate password hash: {}", e))
}

/// Print usage information
fn print_usage() {
    eprintln!("Secan - Elasticsearch Cluster Management Tool");
    eprintln!();
    eprintln!("Usage:");
    eprintln!("  secan [OPTIONS]              Start the server");
    eprintln!("  secan hash-password <pass>   Generate bcrypt password hash");
    eprintln!();
    eprintln!("Options:");
    eprintln!("  -h, --help    Print help");
    eprintln!("  -V, --version Print version");
    eprintln!();
    eprintln!("Examples:");
    eprintln!("  secan hash-password mypassword");
    eprintln!("  secan");
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args: Vec<String> = env::args().collect();

    // Handle subcommands
    if args.len() > 1 {
        match args[1].as_str() {
            "hash-password" => {
                if args.len() < 3 {
                    eprintln!("Error: Password required");
                    eprintln!("Usage: secan hash-password <password>");
                    std::process::exit(1);
                }

                let password = &args[2];
                let hash = generate_password_hash(password)?;

                println!("Password hash for '{password}':");
                println!("{hash}");
                println!();
                println!("Add to config.yaml:");
                println!("  local_users:");
                println!("    - username: \"your-username\"");
                println!("      password_hash: \"{hash}\"");
                println!("      groups:");
                println!("        - \"admin\"");

                return Ok(());
            }
            "-h" | "--help" => {
                print_usage();
                return Ok(());
            }
            "-V" | "--version" => {
                println!("Secan {}", env!("CARGO_PKG_VERSION"));
                return Ok(());
            }
            _ => {
                eprintln!("Unknown command: {}", args[1]);
                eprintln!("Run 'secan --help' for usage information");
                std::process::exit(1);
            }
        }
    }

    // Initialize OpenTelemetry telemetry and tracing subscriber
    // This handles both OTel tracing and JSON logging configuration
    let _telemetry_guard = telemetry::init_telemetry();

    // If telemetry is disabled, we still need to initialize the tracing subscriber
    if _telemetry_guard.is_none() {
        let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

        tracing_subscriber::fmt()
            .json()
            .with_env_filter(env_filter)
            .with_target(true)
            .with_thread_ids(true)
            .with_line_number(true)
            .init();
    }

    info!("Secan - Elasticsearch Cluster Management Tool");
    info!("Starting backend server...");

    // Load configuration
    let config = Config::load().context("Failed to load application configuration")?;
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
        let display_name = cluster.name.as_deref().unwrap_or(&cluster.id);
        info!(
            cluster_id = %cluster.id,
            cluster_name = %display_name,
            node_count = cluster.nodes.len(),
            has_auth = cluster.auth.is_some(),
            tls_verify = cluster.tls.verify,
            "Configured cluster"
        );
    }

    // Initialize cluster manager
    tracing::debug!("Initializing cluster manager...");
    let cache_duration = std::time::Duration::from_secs(config.cache.get_duration_secs());
    let cluster_manager = ClusterManager::new(config.clusters.clone(), cache_duration).await?;
    tracing::debug!("Cluster manager initialized successfully");

    // Read and validate session secret — must be set and at least 32 characters.
    // Using an env var (not config.yaml) keeps the secret out of version control.
    let session_secret = std::env::var("SECAN_SESSION_SECRET").unwrap_or_else(|_| {
        panic!(
            "SECAN_SESSION_SECRET environment variable is required. \
             Generate a strong random secret (≥32 characters) and set it before starting secan."
        )
    });
    if session_secret.len() < 32 {
        panic!(
            "SECAN_SESSION_SECRET must be at least 32 characters long (got {}). \
             Use a strong random value.",
            session_secret.len()
        );
    }

    // Initialize session manager
    tracing::debug!("Initializing session manager...");
    let session_config = SessionConfig::new(config.auth.session_timeout_minutes, session_secret);
    let session_manager = SessionManager::new(session_config);
    tracing::debug!("Session manager initialized successfully");

    // Start session cleanup task
    let cleanup_handle = Arc::new(session_manager.clone()).start_cleanup_task();
    tracing::debug!("Session cleanup task started");

    // Create and start server (async to initialize OIDC provider if configured)
    tracing::debug!("Creating server...");
    let server = Server::new(config, cluster_manager, session_manager)
        .await
        .context("Failed to create server")?;

    info!("Starting server...");

    // Run server (this will block until shutdown)
    let server_result = server.run().await;

    // Cleanup
    cleanup_handle.abort();

    server_result
}
