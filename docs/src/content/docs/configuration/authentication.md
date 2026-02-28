---
title: Authentication
description: Configure authentication modes for Secan
---

## Authentication Modes

Secan supports three authentication modes, configured via the `auth.mode` setting:

### Open Mode

**Default mode.** No authentication required. All users access Secan without credentials.

```yaml
auth:
  mode: open
```

Use this mode for:
- Local development and testing
- Internal networks with existing network-level security
- Quick setup without authentication overhead

### Local Users Mode

Authenticate users with locally managed credentials. Users are stored in the configuration with bcrypt-hashed passwords.

```yaml
auth:
  mode: local_users
  session_timeout_minutes: 60
  local_users:
    - username: "admin"
      password_hash: "$2b$12$..." # bcrypt hash
      roles:
        - "admin"
    - username: "viewer"
      password_hash: "$2b$12$..."
      roles:
        - "viewer"
```

**Generating Password Hashes:**

To create a bcrypt password hash, use the `htpasswd` utility or online bcrypt generator:

```bash
# Using htpasswd (requires Apache tools)
htpasswd -nbB admin password123

# Output will look like: admin:$2b$12$...
# Use the hash part after the colon
```

**Users and Roles:**

Users have roles that can be used for access control. Define roles and their permissions:

```yaml
auth:
  roles:
    - name: "admin"
      cluster_patterns:
        - "*"  # Full access to all clusters
    - name: "viewer"
      cluster_patterns:
        - "production"  # Access only to production cluster
        - "staging"
```

Use local_users mode for:
- Small teams with simple user management
- Self-contained deployments without external auth services
- Organizations with minimal compliance requirements

### OIDC Mode

Authenticate users through an OpenID Connect provider (Keycloak, Auth0, Okta, etc.).

```yaml
auth:
  mode: oidc
  session_timeout_minutes: 60
  oidc:
    discovery_url: "https://auth.example.com/.well-known/openid-configuration"
    client_id: "secan"
    client_secret: "secret123"
    redirect_uri: "https://secan.example.com/api/auth/oidc/redirect"
```

**OIDC Configuration Fields:**

- `discovery_url`: OpenID Connect discovery endpoint URL
- `client_id`: OAuth2 client ID from your provider
- `client_secret`: OAuth2 client secret (use environment variables for security)
- `redirect_uri`: Callback URL where users are redirected after authentication

**Environment Variables for Secrets:**

Store sensitive values in environment variables:

```bash
export SECAN_AUTH_OIDC_CLIENT_SECRET="your-secret-here"
```

The configuration system reads environment variables automatically.

Use OIDC mode for:
- Enterprise deployments with centralized authentication
- Integration with existing identity providers
- Teams requiring SSO (Single Sign-On)
- Organizations with compliance and audit requirements

## Session Configuration

All modes support session timeout configuration:

```yaml
auth:
  mode: open
  session_timeout_minutes: 60  # Default: 60 minutes
```

Sessions expire after the configured duration of inactivity.

## Configuration via Environment Variables

Use placeholder syntax `${ENV_VAR_NAME}` directly in your `config.yaml` file. These will be replaced with the corresponding environment variables at startup.

### Basic Example

```yaml
auth:
  mode: open
  session_timeout_minutes: 60
```

### OIDC with Placeholders

```yaml
auth:
  mode: oidc
  session_timeout_minutes: 60
  oidc:
    discovery_url: "${AUTH_DISCOVERY_URL}"
    client_id: "${AUTH_CLIENT_ID}"
    client_secret: "${AUTH_CLIENT_SECRET}"
    redirect_uri: "${AUTH_REDIRECT_URI}"
```

Then set the environment variables:

```bash
export AUTH_DISCOVERY_URL="https://auth.example.com/.well-known/openid-configuration"
export AUTH_CLIENT_ID="secan"
export AUTH_CLIENT_SECRET="secret123"
export AUTH_REDIRECT_URI="https://secan.example.com/api/auth/oidc/redirect"
```

### Best Practices

- **Placeholder syntax**: Use `${VARIABLE_NAME}` in the config file (case-sensitive)
- **Secrets**: Use placeholders for sensitive values like passwords and secrets instead of committing them to version control
- **No hardcoding**: Avoid hardcoding passwords or tokens in config files

## Best Practices

1. **Never commit secrets** - Use environment variables or secure vaults for passwords and tokens
2. **Use TLS in production** - Always access Secan over HTTPS
3. **Set appropriate timeouts** - Balance security with user experience
4. **Use OIDC for enterprises** - Centralized auth is easier to manage and audit
5. **Rotate credentials regularly** - Update passwords and secrets periodically
