//! Cerebro - Elasticsearch cluster management tool
//!
//! Main entry point for the Cerebro backend server.

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    tracing::info!("Cerebro backend starting...");
    
    // TODO: Initialize authentication system (will be implemented in later tasks)
    // TODO: Initialize Axum router and middleware
    // TODO: Start server
    
    Ok(())
}
