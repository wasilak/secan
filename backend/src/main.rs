//! Cerebro - Elasticsearch cluster management tool
//!
//! Main entry point for the Cerebro backend server.

use anyhow::{Context, Result};
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use cerebro::{
    auth::{AuthConfig, AuthMiddleware, AuthProviderFactory, ConfigLoader, SessionManager, LoggingConfig},
    routes,
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialize tracing with configured log levels
fn initialize_tracing(logging_config: &LoggingConfig) -> Result<()> {
    // Convert global log level to filter string
    let level_str = match logging_config.level {
        cerebro::auth::LogLevel::Error => "error",
        cerebro::auth::LogLevel::Warn => "warn",
        cerebro::auth::LogLevel::Info => "info",
        cerebro::auth::LogLevel::Debug => "debug",
        cerebro::auth::LogLevel::Trace => "trace",
    };

    // Build the filter with component-level overrides
    let mut filter_string = format!("cerebro={}", level_str);

    if let Some(component_levels) = &logging_config.component_levels {
        for (component, level) in component_levels {
            let component_level_str = match level {
                cerebro::auth::LogLevel::Error => "error",
                cerebro::auth::LogLevel::Warn => "warn",
                cerebro::auth::LogLevel::Info => "info",
                cerebro::auth::LogLevel::Debug => "debug",
                cerebro::auth::LogLevel::Trace => "trace",
            };
            filter_string.push_str(&format!(",cerebro::auth::{}={}", component, component_level_str));
        }
    }

    // Build the subscriber with configured levels
    let env_filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(&filter_string))
        .context("Failed to parse filter string")?;

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(env_filter)
        .init();

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load authentication configuration first (needed for tracing setup)
    let config_path = PathBuf::from("config.yaml");
    let config_loader = ConfigLoader::new(config_path);

    let auth_config = config_loader
        .load()
        .context("Failed to load authentication configuration")?;

    // Initialize tracing with configured log levels
    initialize_tracing(&auth_config.logging)
        .context("Failed to initialize tracing")?;

    tracing::info!("Cerebro backend starting...");
    tracing::info!("Authentication mode: {:?}", auth_config.mode);
    tracing::debug!("Logging level: {:?}", auth_config.logging.level);
    if let Some(component_levels) = &auth_config.logging.component_levels {
        tracing::debug!("Component log levels configured: {} overrides", component_levels.len());
    }

    // Initialize authentication components
    let session_manager = Arc::new(SessionManager::new(
        auth_config.session.clone(),
        auth_config.security.clone(),
    ));

    let auth_factory = AuthProviderFactory::new(auth_config.clone(), session_manager.clone());

    let auth_provider = auth_factory
        .create()
        .context("Failed to create authentication provider")?;

    tracing::info!(
        "Authentication provider initialized: {}",
        auth_provider.provider_type()
    );

    // Create OIDC provider if needed (for authorization URL generation)
    let oidc_provider = if matches!(auth_config.mode, cerebro::auth::AuthMode::Oidc) {
        use cerebro::auth::oidc::OidcAuthProvider;
        let oidc_config = auth_config
            .oidc
            .as_ref()
            .expect("OIDC config should exist for OIDC mode");
        Some(Arc::new(
            OidcAuthProvider::new(oidc_config.clone(), session_manager.clone())
                .context("Failed to create OIDC provider")?,
        ))
    } else {
        None
    };

    // Create authentication middleware
    let auth_middleware = AuthMiddleware::new(session_manager.clone(), auth_config.clone());

    // Build the router with authentication routes
    let auth_routes = Router::new()
        .route("/login", post(routes::auth::login))
        .route("/oidc/login", get(routes::auth::oidc_login))
        .route("/oidc/callback", get(routes::auth::oidc_callback))
        .route("/logout", post(routes::auth::logout))
        .with_state(routes::auth::AuthState {
            provider: auth_provider,
            oidc_provider,
            session_manager: session_manager.clone(),
            auth_config: auth_config.clone(),
        });

    // Build the main application router
    let app = Router::new()
        .nest("/api/auth", auth_routes)
        // Protected routes would be added here with authentication middleware
        // .route("/api/clusters", get(clusters::list))
        // .layer(middleware::from_fn(move |req, next| {
        //     auth_middleware.authenticate(req, next)
        // }))
        .layer(TraceLayer::new_for_http());

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    tracing::info!("Server listening on {}", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .context("Server error")?;

    Ok(())
}
