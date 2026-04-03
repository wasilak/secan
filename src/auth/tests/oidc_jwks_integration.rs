use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use serde_json::json;

use std::time::Duration;

use crate::auth::oidc::OidcAuthProvider;
use crate::auth::permissions::PermissionResolver;
use crate::auth::session::{SessionConfig, SessionManager};
use crate::config::OidcConfig;

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};

/// Pre-generated RSA private key (PKCS#8 PEM). Non-production, for tests only.
const TEST_RSA_PRIVATE_PEM: &str = r#"-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQD2NV4YljGuOZnz
6gLsH40Qaapufhucq6qaO1twhucQLjoxWdmYVrzqn63WusJ+677xrEEHx8yWI6ij
U5pcK/dmemD4TXwmchdrMOLpCXOwcCK8shJ0tZip+V+VxRGS48TJvNBA/kUlnT8F
/mUA8OlOU50t5Rsezo9AEdS+Wlpn9SdcUHO3KN0DqdmfDuJrm/5V+5i5HDWtwLoi
hmywZVqgfe5dugrV0I2UomDsGP8tLXJdE/JAdMQG40eAdV6QNvGGUJwp7+kMdERw
1fcnz972nhT4Eswy7bW8Uj+m6rb4tqt6aBGPbg9mJngwdK6PQGT2UuscODsajqkZ
X4xuuQOjAgMBAAECggEAVgbRqP+ZvkmMHGjQupZPoMN69H6FwVlOE/PXgFryk3nD
hYjiedMc0VIX2KaK3PQcVK8eTcynFHLDMsY8ciY+nIT4KupQDdLhkeeT8V8HGEgm
Kw6BWlw1SnbCyj8AY/XHxcF+dqchnAH0inCX9Bs5OdAHZIjf0ATWksloL1a8rgOQ
WbDlC9me1RdR8oeiVKMlLSHZs+7H/Ls+iKwoevF0QSDnt+pZ1dPKkcU/1O5315Un
J5thqGXBPJNrtaUU5loDuM7f1axxeDvSfjjcAL8gKRJvZqBbrBUapQCUqvG8cw2B
yJxk1rkuF2wCAh8D/hc6X5ceZjdl+ywECW2BI4fGoQKBgQD8p5ZwaLwLlzHLcYTp
WdZHNCVdxkzExxbDJBFOlCRwntnmLkbA3Jwnvgspf6kyW0zhHGE4XGvpqO+m/6y2
QUzKQxklf8yzsrNFBkOypxx3xR7HxZMWp9UhOxTvm0cP4/G0gdwFDn9P9lHBabDd
/Owi8MQX5xijeW332s8HdJ8K0wKBgQD5d+36cZ84Czdv8czckdyuISpvsidYtseI
Hck1VECnnakTXexBFW/pxdLL8Qt/+KAhrCwQ1h9lH6QMQwTubr5lWC7KzojzoTiq
m5+JAQ0v2jwBtmARWD4rMUfv2ddUyn470wPxujSCl1O7H7KhakgW4cclyXSk2TFs
/+WwnxcB8QKBgQCgmP5dcZWmYHL8eKodkkdMd28RDo2Zv1tOq0x9AFmxZKfpUp0S
1qhD8t8xf75TDgnuRZXet5C4s/Ox2W81YoinQMNpPLUnvH2LcJHzq5nC3//SyFnY
2tH1D5MdQzyGc0QekzUB2dc/QrlxEfelA7It+5EKCJF2yCcIl4Nln9HAlQKBgQDV
e0cAockB+b9IIeERBBWYQbOCAC/hoBCiL/MmmuH1TlsIwsBRddnecLaSZcVUjtvh
1OekxMf7DpehEp0euVBfg5YPYa0a5+WJQkHEyUySnavqPzp4vU3+Ql7wJzg5TEu4
QDzI2HLlKkCyCk8gCMaGJlH4ySvzghXk1BuoCIx00QKBgQCNiNXNr64NCRsYHDxq
xH+cM50o5+HVEVWD+1NeidGe/Pa79fgr3NlR0r6iSUKFm55r/7MR5CcQgABFUdrx
2biqQyw415OBkOG5wyl92hQkn98EA2CD1Evyr+rgf8D9L1Ba+2r5FSzamekOnIBp
luUj/JI7NK7CMVf81hBbK3/XPQ==
-----END PRIVATE KEY-----"#;

// Public JWK 'n' value for the private key above (base64url, no padding)
const TEST_RSA_PUBLIC_N: &str = "APY1XhiWMa45mfPqAuwfjRBpqm5-G5yrqpo7W3CG5xAuOjFZ2ZhWvOqfrda6wn7rvvGsQQfHzJYjqKNTmlwr92Z6YPhNfCZyF2sw4ukJc7BwIryyEnS1mKn5X5XFEZLjxMm80ED-RSWdPwX-ZQDw6U5TnS3lGx7Oj0AR1L5aWmf1J1xQc7co3QOp2Z8O4mub_lX7mLkcNa3AuiKGbLBlWqB97l26CtXQjZSiYOwY_y0tcl0T8kB0xAbjR4B1XpA28YZQnCnv6Qx0RHDV9yfP3vaeFPgSzDLttbxSP6bqtvi2q3poEY9uD2YmeDB0ro9AZPZS6xw4OxqOqRlfjG65A6M";
const TEST_RSA_PUBLIC_E: &str = "AQAB";

/// Helper to wait until the mock server has received at least `count` requests
/// for the given path.
async fn wait_for_path_requests(
    server: &MockServer,
    path_match: &str,
    count: usize,
    timeout: Duration,
) {
    let start = std::time::Instant::now();
    loop {
        let rec = server.received_requests().await.unwrap_or_default();
        let matched = rec.iter().filter(|r| r.url.path() == path_match).count();
        if matched >= count {
            return;
        }
        if start.elapsed() > timeout {
            panic!(
                "Timed out waiting for {} requests to {} (got {})",
                count, path_match, matched
            );
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

#[tokio::test]
async fn jwks_kid_miss_triggers_immediate_refresh() {
    let mock = MockServer::start().await;

    // Discovery document pointing to our JWKS endpoint
    let discovery = json!({
        "issuer": mock.uri(),
        "authorization_endpoint": format!("{}/auth", mock.uri()),
        "token_endpoint": format!("{}/token", mock.uri()),
        "jwks_uri": format!("{}/jwks", mock.uri())
    });

    Mock::given(method("GET"))
        .and(path("/.well-known/openid-configuration"))
        .respond_with(ResponseTemplate::new(200).set_body_json(discovery))
        .mount(&mock)
        .await;

    // JWKS A - initial background fetch (contains a dummy key with kid 'kidA')
    let jwks_a = json!({
        "keys": [
            { "kty": "RSA", "kid": "kidA", "n": "ZmFrZV9u", "e": "AQAB" }
        ]
    });

    // JWKS B - second response contains our real public key with kid 'kidB'
    let jwks_b = json!({
        "keys": [
            { "kty": "RSA", "kid": "kidB", "n": TEST_RSA_PUBLIC_N, "e": TEST_RSA_PUBLIC_E }
        ]
    });

    // Register a single mock for the initial background fetch (jwks_a).
    Mock::given(method("GET"))
        .and(path("/jwks"))
        .respond_with(ResponseTemplate::new(200).set_body_json(jwks_a.clone()))
        .expect(1)
        .mount(&mock)
        .await;

    // Build OIDC config pointing at the mock discovery document
    let oidc_config = OidcConfig {
        discovery_url: format!("{}/.well-known/openid-configuration", mock.uri()),
        client_id: "test-client".to_string(),
        client_secret: "secret".to_string(),
        redirect_uri: "http://localhost/callback".to_string(),
        groups_claim_key: "groups".to_string(),
        redirect_delay_seconds: 1,
        jwks_ttl_seconds: 600,
        jwks_ttl: None,
    };

    let session_mgr = SessionManager::new(SessionConfig::new(60, "test-secret".to_string()));
    let permission_resolver = PermissionResolver::empty();

    // Create provider (this spawns the background refresher which will perform
    // an initial JWKS fetch that will consume the first JWKS mock)
    let provider = OidcAuthProvider::new(
        oidc_config,
        std::sync::Arc::new(session_mgr),
        permission_resolver,
        Vec::new(),
    )
    .await
    .expect("failed to create provider");

    // Wait for the initial background fetch to happen (JWKS path called)
    wait_for_path_requests(&mock, "/jwks", 1, Duration::from_secs(2)).await;

    // Ensure the background task has written the JWKS into the provider cache
    // (received_requests only guarantees the request arrived, not that the
    // response was parsed and stored). Wait up to 2s for the cache to show
    // the initial key (kidA).
    let start = std::time::Instant::now();
    loop {
        if let Some(cached) = provider.get_cached_jwks() {
            if let Some(keys) = cached.get("keys").and_then(|v| v.as_array()) {
                if keys
                    .iter()
                    .any(|k| k.get("kid").and_then(|v| v.as_str()) == Some("kidA"))
                {
                    break;
                }
            }
        }
        if start.elapsed() > Duration::from_secs(2) {
            panic!("Timed out waiting for provider cache to contain initial JWKS (kidA)");
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    // Build an ID token signed with our private key using kid 'kidB' (so initial cache lacks it)
    #[derive(serde::Serialize)]
    struct Claims<'a> {
        sub: &'a str,
        aud: &'a str,
        exp: usize,
        iat: usize,
    }

    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: "user-1",
        aud: "test-client",
        exp: now + 3600,
        iat: now,
    };

    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some("kidB".to_string());
    let encoding_key = EncodingKey::from_rsa_pem(TEST_RSA_PRIVATE_PEM.as_bytes()).unwrap();
    let token = encode(&header, &claims, &encoding_key).expect("failed to encode token");

    // Mount JWKS B at a different path so we can switch the provider to it
    // dynamically in the test (simulates a rotated JWKS appearing at a new
    // URL). We'll point the provider at this URL before calling validate_id_token
    // so the immediate refresh fetches jwks_b.
    Mock::given(method("GET"))
        .and(path("/jwks_b"))
        .respond_with(ResponseTemplate::new(200).set_body_json(jwks_b.clone()))
        .expect(1)
        .mount(&mock)
        .await;

    // Point the provider's JWKS URI at the alternate path for the immediate refresh.
    {
        let new_uri = format!("{}/jwks_b", mock.uri());
        // provider is owned here; get a mutable reference by re-binding
        let mut provider = provider;
        provider.set_jwks_uri_for_tests(new_uri);

        // Replace provider variable so the rest of the test uses the modified one
        let provider = provider;

        // Validate ID token - provider should detect missing kid, perform immediate
        // refresh (consuming second mock) and then succeed.
        match provider.validate_id_token(&token).await {
            Ok(decoded) => assert_eq!(decoded.sub, "user-1"),
            Err(e) => {
                // Dump received requests for debugging
                let recs = mock.received_requests().await.unwrap_or_default();
                eprintln!("Validation failed: {}", e);
                eprintln!("Received {} requests:", recs.len());
                for r in &recs {
                    eprintln!("  -> {} {}", r.method, r.url);
                }
                // Inspect provider's cached JWKS (test helper)
                let cached = provider.get_cached_jwks();
                eprintln!("Cached JWKS after refresh: {:?}", cached);
                panic!("validate_id_token failed: {}", e);
            }
        }

        // Ensure both JWKS calls were received (initial + immediate refresh)
        wait_for_path_requests(&mock, "/jwks", 1, Duration::from_secs(2)).await;
        wait_for_path_requests(&mock, "/jwks_b", 1, Duration::from_secs(2)).await;
        return;
    }
}

#[tokio::test]
async fn background_refresher_initial_fetch_populates_cache() {
    let mock = MockServer::start().await;

    let discovery = json!({
        "issuer": mock.uri(),
        "authorization_endpoint": format!("{}/auth", mock.uri()),
        "token_endpoint": format!("{}/token", mock.uri()),
        "jwks_uri": format!("{}/jwks", mock.uri())
    });

    Mock::given(method("GET"))
        .and(path("/.well-known/openid-configuration"))
        .respond_with(ResponseTemplate::new(200).set_body_json(discovery))
        .mount(&mock)
        .await;

    // JWKS contains the key we'll use to sign tokens (kid 'kidB') and we expect
    // exactly one request (the initial background fetch). validate_id_token
    // should succeed without issuing another JWKS fetch.
    let jwks = json!({
        "keys": [
            { "kty": "RSA", "kid": "kidB", "n": TEST_RSA_PUBLIC_N, "e": TEST_RSA_PUBLIC_E }
        ]
    });

    Mock::given(method("GET"))
        .and(path("/jwks"))
        .respond_with(ResponseTemplate::new(200).set_body_json(jwks.clone()))
        .expect(1)
        .mount(&mock)
        .await;

    let oidc_config = OidcConfig {
        discovery_url: format!("{}/.well-known/openid-configuration", mock.uri()),
        client_id: "test-client".to_string(),
        client_secret: "secret".to_string(),
        redirect_uri: "http://localhost/callback".to_string(),
        groups_claim_key: "groups".to_string(),
        redirect_delay_seconds: 1,
        jwks_ttl_seconds: 600,
        jwks_ttl: None,
    };

    let session_mgr = SessionManager::new(SessionConfig::new(60, "test-secret".to_string()));
    let permission_resolver = PermissionResolver::empty();

    let provider = OidcAuthProvider::new(
        oidc_config,
        std::sync::Arc::new(session_mgr),
        permission_resolver,
        Vec::new(),
    )
    .await
    .expect("failed to create provider");

    // Wait for initial background fetch to complete (jwks path called)
    wait_for_path_requests(&mock, "/jwks", 1, Duration::from_secs(2)).await;

    // Ensure the background task has written the JWKS into the provider cache
    // so validation will use the cached key without issuing another fetch.
    let start = std::time::Instant::now();
    loop {
        if let Some(cached) = provider.get_cached_jwks() {
            if let Some(keys) = cached.get("keys").and_then(|v| v.as_array()) {
                if keys
                    .iter()
                    .any(|k| k.get("kid").and_then(|v| v.as_str()) == Some("kidB"))
                {
                    break;
                }
            }
        }
        if start.elapsed() > Duration::from_secs(2) {
            panic!("Timed out waiting for provider cache to contain initial JWKS (kidB)");
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    // Sign a token with kid 'kidB' which should validate using cached JWKS
    #[derive(serde::Serialize)]
    struct Claims<'a> {
        sub: &'a str,
        aud: &'a str,
        exp: usize,
        iat: usize,
    }

    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: "user-2",
        aud: "test-client",
        exp: now + 3600,
        iat: now,
    };

    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some("kidB".to_string());
    let encoding_key = EncodingKey::from_rsa_pem(TEST_RSA_PRIVATE_PEM.as_bytes()).unwrap();
    let token = encode(&header, &claims, &encoding_key).expect("failed to encode token");

    // Validation should succeed and should NOT trigger an extra JWKS fetch
    let decoded = provider
        .validate_id_token(&token)
        .await
        .expect("validation failed");
    assert_eq!(decoded.sub, "user-2");

    // Ensure only one JWKS request was made (the background initial fetch)
    let rec = mock.received_requests().await.unwrap_or_default();
    let jwks_count = rec.iter().filter(|r| r.url.path() == "/jwks").count();
    assert_eq!(jwks_count, 1, "expected exactly one JWKS fetch");
}
