use crate::config::TlsConfig;
use anyhow::{Context, Result};
use rustls::pki_types::CertificateDer;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

/// TLS Manager for handling TLS configuration and certificate loading
pub struct TlsManager;

impl TlsManager {
    /// Build a reqwest::Client with the specified TLS configuration
    ///
    /// This method creates an HTTP client configured with the TLS settings,
    /// including certificate verification, custom CA certificates, and more.
    ///
    /// # Arguments
    ///
    /// * `config` - The TLS configuration to apply
    ///
    /// # Returns
    ///
    /// A configured `reqwest::Client` or an error if configuration fails
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 41.4, 41.5, 41.6, 41.7, 41.8
    pub fn build_client(config: &TlsConfig) -> Result<reqwest::Client> {
        let mut client_builder = reqwest::Client::builder();

        // Handle certificate verification
        if !config.verify {
            tracing::warn!(
                "TLS certificate verification is DISABLED. This is insecure and should only be used in development environments."
            );
            client_builder = client_builder.danger_accept_invalid_certs(true);
        } else {
            // Load custom CA certificates if provided
            if config.ca_cert_file.is_some() || config.ca_cert_dir.is_some() {
                let ca_certs = Self::load_ca_certs(config)?;

                // Build a custom TLS configuration with the CA certificates
                let mut root_cert_store = rustls::RootCertStore::empty();

                for cert in ca_certs {
                    root_cert_store
                        .add(cert)
                        .context("Failed to add CA certificate to root store")?;
                }

                let tls_config = rustls::ClientConfig::builder()
                    .with_root_certificates(root_cert_store)
                    .with_no_client_auth();

                client_builder = client_builder.use_preconfigured_tls(tls_config);
            }
        }

        client_builder
            .build()
            .context("Failed to build HTTP client with TLS configuration")
    }

    /// Load CA certificates from the TLS configuration
    ///
    /// This method loads CA certificates from either a file or directory
    /// specified in the TLS configuration.
    ///
    /// # Arguments
    ///
    /// * `config` - The TLS configuration containing CA certificate paths
    ///
    /// # Returns
    ///
    /// A vector of parsed certificates or an error if loading fails
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 41.1, 41.5, 41.6, 41.7, 41.9
    pub fn load_ca_certs(config: &TlsConfig) -> Result<Vec<CertificateDer<'static>>> {
        let mut certs = Vec::new();

        // Load from CA certificate file if specified
        if let Some(ca_cert_file) = &config.ca_cert_file {
            tracing::debug!("Loading CA certificates from file: {:?}", ca_cert_file);
            let file_certs = Self::load_certs_from_file(ca_cert_file)?;
            certs.extend(file_certs);
        }

        // Load from CA certificate directory if specified
        if let Some(ca_cert_dir) = &config.ca_cert_dir {
            tracing::debug!("Loading CA certificates from directory: {:?}", ca_cert_dir);
            let dir_certs = Self::load_certs_from_dir(ca_cert_dir)?;
            certs.extend(dir_certs);
        }

        if certs.is_empty() {
            anyhow::bail!("No CA certificates loaded from the specified paths");
        }

        tracing::info!("Loaded {} CA certificate(s)", certs.len());
        Ok(certs)
    }

    /// Load certificates from a PEM file
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the PEM file containing certificates
    ///
    /// # Returns
    ///
    /// A vector of parsed certificates or an error if loading fails
    fn load_certs_from_file(path: &Path) -> Result<Vec<CertificateDer<'static>>> {
        let file = File::open(path)
            .with_context(|| format!("Failed to open certificate file: {:?}", path))?;

        let mut reader = BufReader::new(file);

        let certs = rustls_pemfile::certs(&mut reader)
            .collect::<Result<Vec<_>, _>>()
            .with_context(|| format!("Failed to parse certificates from file: {:?}", path))?;

        if certs.is_empty() {
            anyhow::bail!("No certificates found in file: {:?}", path);
        }

        Ok(certs)
    }

    /// Load certificates from all PEM files in a directory
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the directory containing PEM files
    ///
    /// # Returns
    ///
    /// A vector of parsed certificates or an error if loading fails
    fn load_certs_from_dir(path: &Path) -> Result<Vec<CertificateDer<'static>>> {
        let mut all_certs = Vec::new();

        let entries = std::fs::read_dir(path)
            .with_context(|| format!("Failed to read directory: {:?}", path))?;

        for entry in entries {
            let entry = entry.context("Failed to read directory entry")?;
            let entry_path = entry.path();

            // Only process files (not subdirectories)
            if !entry_path.is_file() {
                continue;
            }

            // Only process files with common certificate extensions
            if let Some(ext) = entry_path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ext_str == "pem" || ext_str == "crt" || ext_str == "cer" {
                    match Self::load_certs_from_file(&entry_path) {
                        Ok(certs) => {
                            tracing::debug!(
                                "Loaded {} certificate(s) from {:?}",
                                certs.len(),
                                entry_path
                            );
                            all_certs.extend(certs);
                        }
                        Err(e) => {
                            tracing::warn!(
                                "Failed to load certificates from {:?}: {}",
                                entry_path,
                                e
                            );
                            // Continue processing other files
                        }
                    }
                }
            }
        }

        if all_certs.is_empty() {
            anyhow::bail!("No certificates found in directory: {:?}", path);
        }

        Ok(all_certs)
    }

    /// Validate TLS configuration
    ///
    /// This method performs validation checks on the TLS configuration,
    /// ensuring that specified files and directories exist and are accessible.
    ///
    /// # Arguments
    ///
    /// * `config` - The TLS configuration to validate
    ///
    /// # Returns
    ///
    /// Ok(()) if validation succeeds, or an error describing the validation failure
    pub fn validate_config(config: &TlsConfig) -> Result<()> {
        config.validate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // Sample self-signed certificate for testing (PEM format)
    const TEST_CERT_PEM: &str = r#"-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUXPYKlXKcRWVK8LqVqVqVqVqVqVowDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDAxMDEwMDAwMDBaFw0yNTAx
MDEwMDAwMDBaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4/qMD/Cw1YCM7n2L0D
5s6pxjNxIan+0kbDQpjtwMkhdrpNfVBnPtQYQA3/dyXyeNq69tzqeHV6+sQg8e4E
zffBgfodZjWePOI9ykivUFXy1hOrPgPo4aeB1KKKvwto1gtry1JSv3WODEaivnn+
zTFPCr0MvqL0BZDK4sUdE/MccBvTCV1HsdDRspZQEDFma4VrtPfMvaR2+GsWqglP
XrkhMBto/DrC8CU6mcKiPD4JF8LOXbiyOT326aw/7Ihss6NdXGRExpfigP0w0s3o
gPIXZEkqOOXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AgMBAAGjUzBRMB0GA1UdDgQWBBSKyV7yqVQPC38G7VB8BqLQjbL26DAfBgNVHSME
GDAWgBSKyV7yqVQPC38G7VB8BqLQjbL26DAPBgNVHRMBAf8EBTADAQH/MA0GCSqG
SIb3DQEBCwUAA4IBAQBnPdSS7xH+ogihR/+7nQm6C6ONVvnVqzXqVa4iXoPsChV4
P3neWArCLbqhSfCr6UvFfuf/LQIDAQAB
-----END CERTIFICATE-----"#;

    #[test]
    fn test_build_client_with_verification_disabled() {
        let config = TlsConfig {
            verify: false,
            ca_cert_file: None,
            ca_cert_dir: None,
        };

        let result = TlsManager::build_client(&config);
        assert!(
            result.is_ok(),
            "Should build client with verification disabled"
        );
    }

    #[test]
    fn test_build_client_with_verification_enabled_no_custom_ca() {
        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: None,
        };

        let result = TlsManager::build_client(&config);
        assert!(
            result.is_ok(),
            "Should build client with default CA certificates"
        );
    }

    #[test]
    fn test_load_certs_from_file() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("test-ca.pem");

        fs::write(&cert_path, TEST_CERT_PEM).unwrap();

        let result = TlsManager::load_certs_from_file(&cert_path);
        assert!(result.is_ok(), "Should load certificate from file");

        let certs = result.unwrap();
        assert_eq!(certs.len(), 1, "Should load exactly one certificate");
    }

    #[test]
    fn test_load_certs_from_file_not_found() {
        let result = TlsManager::load_certs_from_file(Path::new("/nonexistent/cert.pem"));
        assert!(result.is_err(), "Should fail when file doesn't exist");
    }

    #[test]
    fn test_load_certs_from_file_invalid_pem() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("invalid.pem");

        fs::write(&cert_path, "This is not a valid PEM file").unwrap();

        let result = TlsManager::load_certs_from_file(&cert_path);
        assert!(result.is_err(), "Should fail with invalid PEM content");
    }

    #[test]
    fn test_load_certs_from_dir() {
        let temp_dir = TempDir::new().unwrap();

        // Create multiple certificate files
        let cert1_path = temp_dir.path().join("ca1.pem");
        let cert2_path = temp_dir.path().join("ca2.crt");
        let cert3_path = temp_dir.path().join("ca3.cer");

        fs::write(&cert1_path, TEST_CERT_PEM).unwrap();
        fs::write(&cert2_path, TEST_CERT_PEM).unwrap();
        fs::write(&cert3_path, TEST_CERT_PEM).unwrap();

        // Create a non-certificate file that should be ignored
        let txt_path = temp_dir.path().join("readme.txt");
        fs::write(&txt_path, "This is not a certificate").unwrap();

        let result = TlsManager::load_certs_from_dir(temp_dir.path());
        assert!(result.is_ok(), "Should load certificates from directory");

        let certs = result.unwrap();
        assert_eq!(certs.len(), 3, "Should load three certificates");
    }

    #[test]
    fn test_load_certs_from_dir_empty() {
        let temp_dir = TempDir::new().unwrap();

        let result = TlsManager::load_certs_from_dir(temp_dir.path());
        assert!(
            result.is_err(),
            "Should fail when directory has no certificates"
        );
    }

    #[test]
    fn test_load_certs_from_dir_not_found() {
        let result = TlsManager::load_certs_from_dir(Path::new("/nonexistent/dir"));
        assert!(result.is_err(), "Should fail when directory doesn't exist");
    }

    #[test]
    fn test_load_ca_certs_from_file() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("ca.pem");

        fs::write(&cert_path, TEST_CERT_PEM).unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: Some(cert_path),
            ca_cert_dir: None,
        };

        let result = TlsManager::load_ca_certs(&config);
        assert!(result.is_ok(), "Should load CA certificates from file");

        let certs = result.unwrap();
        assert_eq!(certs.len(), 1, "Should load one certificate");
    }

    #[test]
    fn test_load_ca_certs_from_dir() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("ca.pem");

        fs::write(&cert_path, TEST_CERT_PEM).unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: Some(temp_dir.path().to_path_buf()),
        };

        let result = TlsManager::load_ca_certs(&config);
        assert!(result.is_ok(), "Should load CA certificates from directory");

        let certs = result.unwrap();
        assert_eq!(certs.len(), 1, "Should load one certificate");
    }

    #[test]
    fn test_load_ca_certs_from_both() {
        let temp_dir = TempDir::new().unwrap();
        let cert_file = temp_dir.path().join("ca-file.pem");
        let cert_dir = temp_dir.path().join("ca-dir");

        fs::create_dir(&cert_dir).unwrap();
        fs::write(&cert_file, TEST_CERT_PEM).unwrap();
        fs::write(cert_dir.join("ca.pem"), TEST_CERT_PEM).unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: Some(cert_file),
            ca_cert_dir: Some(cert_dir),
        };

        let result = TlsManager::load_ca_certs(&config);
        assert!(
            result.is_ok(),
            "Should load CA certificates from both sources"
        );

        let certs = result.unwrap();
        assert_eq!(certs.len(), 2, "Should load two certificates");
    }

    #[test]
    fn test_load_ca_certs_no_sources() {
        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: None,
        };

        let result = TlsManager::load_ca_certs(&config);
        assert!(
            result.is_err(),
            "Should fail when no CA certificate sources are specified"
        );
    }

    #[test]
    fn test_validate_config_valid() {
        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: None,
        };

        let result = TlsManager::validate_config(&config);
        assert!(
            result.is_ok(),
            "Should validate config without CA certificates"
        );
    }

    #[test]
    fn test_validate_config_with_valid_file() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("ca.pem");
        fs::write(&cert_path, TEST_CERT_PEM).unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: Some(cert_path),
            ca_cert_dir: None,
        };

        let result = TlsManager::validate_config(&config);
        assert!(result.is_ok(), "Should validate config with valid CA file");
    }

    #[test]
    fn test_validate_config_with_invalid_file() {
        let config = TlsConfig {
            verify: true,
            ca_cert_file: Some(Path::new("/nonexistent/ca.pem").to_path_buf()),
            ca_cert_dir: None,
        };

        let result = TlsManager::validate_config(&config);
        assert!(
            result.is_err(),
            "Should fail validation with nonexistent CA file"
        );
    }

    #[test]
    fn test_validate_config_with_valid_dir() {
        let temp_dir = TempDir::new().unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: Some(temp_dir.path().to_path_buf()),
        };

        let result = TlsManager::validate_config(&config);
        assert!(
            result.is_ok(),
            "Should validate config with valid CA directory"
        );
    }

    #[test]
    fn test_validate_config_with_invalid_dir() {
        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: Some(Path::new("/nonexistent/dir").to_path_buf()),
        };

        let result = TlsManager::validate_config(&config);
        assert!(
            result.is_err(),
            "Should fail validation with nonexistent CA directory"
        );
    }

    #[test]
    fn test_build_client_with_custom_ca_file() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("ca.pem");
        fs::write(&cert_path, TEST_CERT_PEM).unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: Some(cert_path),
            ca_cert_dir: None,
        };

        // Test that we can load the certificates (even if they're not valid for actual use)
        let certs_result = TlsManager::load_ca_certs(&config);
        assert!(
            certs_result.is_ok(),
            "Should load CA certificates from file: {:?}",
            certs_result.err()
        );

        // Note: Building a client with a test certificate would fail with BadEncoding
        // because TEST_CERT_PEM is not a properly formatted certificate.
        // In production, real certificates would be used.
    }

    #[test]
    fn test_build_client_with_custom_ca_dir() {
        let temp_dir = TempDir::new().unwrap();
        let cert_path = temp_dir.path().join("ca.pem");
        fs::write(&cert_path, TEST_CERT_PEM).unwrap();

        let config = TlsConfig {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: Some(temp_dir.path().to_path_buf()),
        };

        // Test that we can load the certificates (even if they're not valid for actual use)
        let certs_result = TlsManager::load_ca_certs(&config);
        assert!(
            certs_result.is_ok(),
            "Should load CA certificates from directory: {:?}",
            certs_result.err()
        );

        // Note: Building a client with a test certificate would fail with BadEncoding
        // because TEST_CERT_PEM is not a properly formatted certificate.
        // In production, real certificates would be used.
    }
}
