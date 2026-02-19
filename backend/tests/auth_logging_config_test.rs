#[cfg(test)]
mod tests {
    use secan::auth::config::{ConfigLoader, LogLevel, LoggingConfig};
    use std::path::PathBuf;
    use std::collections::HashMap;

    #[test]
    fn test_log_level_enum_exists() {
        let _ = LogLevel::Info;
        let _ = LogLevel::Debug;
        let _ = LogLevel::Error;
        let _ = LogLevel::Warn;
        let _ = LogLevel::Trace;
    }

    #[test]
    fn test_log_level_to_tracing() {
        assert_eq!(LogLevel::Error.to_tracing_level(), tracing::Level::ERROR);
        assert_eq!(LogLevel::Info.to_tracing_level(), tracing::Level::INFO);
    }

    #[test]
    fn test_logging_config_default() {
        let config = LoggingConfig::default();
        assert_eq!(config.level, LogLevel::Info);
        assert!(config.component_levels.is_none());
    }

    #[test]
    fn test_logging_config_get_level() {
        let config = LoggingConfig {
            level: LogLevel::Debug,
            component_levels: None,
            log_successful_auth: true,
            log_failed_auth: true,
            log_session_events: true,
        };

        assert_eq!(config.get_level("local"), LogLevel::Debug);
        assert_eq!(config.get_level("oidc"), LogLevel::Debug);
    }

    #[test]
    fn test_logging_config_with_component_overrides() {
        let mut component_levels = HashMap::new();
        component_levels.insert("local".to_string(), LogLevel::Error);

        let config = LoggingConfig {
            level: LogLevel::Info,
            component_levels: Some(component_levels),
            log_successful_auth: true,
            log_failed_auth: true,
            log_session_events: true,
        };

        assert_eq!(config.get_level("local"), LogLevel::Error);
        assert_eq!(config.get_level("oidc"), LogLevel::Info);
    }

    #[test]
    fn test_validate_logging_config_valid_components() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let mut component_levels = HashMap::new();
        component_levels.insert("local".to_string(), LogLevel::Debug);
        component_levels.insert("oidc".to_string(), LogLevel::Warn);
        component_levels.insert("session".to_string(), LogLevel::Info);
        component_levels.insert("middleware".to_string(), LogLevel::Error);

        let config = LoggingConfig {
            level: LogLevel::Info,
            component_levels: Some(component_levels),
            log_successful_auth: true,
            log_failed_auth: true,
            log_session_events: true,
        };

        let result = loader.validate_logging_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_logging_config_invalid_component() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let mut component_levels = HashMap::new();
        component_levels.insert("bad_component".to_string(), LogLevel::Debug);

        let config = LoggingConfig {
            level: LogLevel::Info,
            component_levels: Some(component_levels),
            log_successful_auth: true,
            log_failed_auth: true,
            log_session_events: true,
        };

        let result = loader.validate_logging_config(&config);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("Invalid component name"));
        assert!(err_msg.contains("Allowed components are:"));
    }
}
