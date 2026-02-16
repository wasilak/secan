# Secan Configuration Guide

## Authentication Modes

Secan supports three authentication modes, configured in `backend/config.yaml`:

### 1. Open Mode (No Authentication) ✅ **Currently Active**

**Perfect for testing and development!**

```yaml
auth:
  mode: "open"
  session_timeout_minutes: 30
```

In Open mode:
- ✅ No login required
- ✅ All users have full access to all configured clusters
- ✅ No session management
- ✅ Perfect for local development and testing

**This is what you're currently using!**

### 2. Local Users Mode

Authenticate users with username/password defined in the config file.

```yaml
auth:
  mode: "local_users"
  session_timeout_minutes: 60
  local_users:
    - username: "admin"
      password_hash: "$2b$12$..." # bcrypt hash
      roles: ["admin"]
    - username: "viewer"
      password_hash: "$2b$12$..."
      roles: ["viewer"]
  roles:
    - name: "admin"
      cluster_patterns: ["*"]  # Access to all clusters
    - name: "viewer"
      cluster_patterns: ["dev-*", "test-*"]  # Only dev and test clusters
```

To generate a password hash:
```bash
# Using Python
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your_password', bcrypt.gensalt()).decode())"

# Or using an online bcrypt generator
```

### 3. OIDC Mode

Authenticate users via OpenID Connect (e.g., Google, Okta, Auth0).

```yaml
auth:
  mode: "oidc"
  session_timeout_minutes: 60
  oidc:
    discovery_url: "https://accounts.google.com/.well-known/openid-configuration"
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    redirect_uri: "http://localhost:8080/api/auth/oidc/callback"
  roles:
    - name: "admin"
      cluster_patterns: ["*"]
```

## Cluster Authentication (Separate from App Auth)

Each cluster can have its own authentication to Elasticsearch:

### No Authentication
```yaml
clusters:
  - id: "local"
    name: "Local Development"
    nodes:
      - "http://localhost:9200"
    auth:
      type: "none"
```

### Basic Authentication
```yaml
clusters:
  - id: "production"
    name: "Production Cluster"
    nodes:
      - "https://es-prod-1.example.com:9200"
      - "https://es-prod-2.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "your-password"
    tls:
      verify: true
```

### API Key Authentication
```yaml
clusters:
  - id: "cloud"
    name: "Elastic Cloud"
    nodes:
      - "https://my-deployment.es.cloud:9243"
    auth:
      type: "api_key"
      key: "your-base64-encoded-api-key"
    tls:
      verify: true
```

## Complete Example Configuration

### For Testing (Current Setup)

```yaml
server:
  host: "127.0.0.1"  # or "0.0.0.0" to allow external connections
  port: 8080

auth:
  mode: "open"  # No authentication required
  session_timeout_minutes: 30

clusters:
  - id: "local"
    name: "Local Development"
    nodes:
      - "http://localhost:9200"
    auth:
      type: "none"
    tls:
      verify: false
    client_type: "http"
    version_hint: "8"
```

### For Production

```yaml
server:
  host: "0.0.0.0"
  port: 8080

auth:
  mode: "local_users"
  session_timeout_minutes: 60
  local_users:
    - username: "admin"
      password_hash: "$2b$12$..."
      roles: ["admin"]
  roles:
    - name: "admin"
      cluster_patterns: ["*"]

clusters:
  - id: "prod"
    name: "Production"
    nodes:
      - "https://es-prod-1.example.com:9200"
      - "https://es-prod-2.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "secure-password"
    tls:
      verify: true
      ca_cert_file: "/path/to/ca.crt"
    client_type: "http"
    version_hint: "8"
```

## Environment Variable Overrides

You can override any configuration value with environment variables:

```bash
# Override server port
export SERVER_PORT=9000

# Override auth mode
export AUTH_MODE=open

# Override cluster nodes
export CLUSTERS_0_NODES_0=http://elasticsearch:9200

# Run the application
cargo run
```

## Configuration File Locations

Secan looks for configuration in this order:

1. `./config.yaml` (current directory)
2. `./backend/config.yaml`
3. `/etc/secan/config.yaml`
4. `~/.config/secan/config.yaml`

You can also specify a custom config file:

```bash
cargo run -- --config /path/to/config.yaml
```

## Quick Start Commands

### Run with no authentication (testing)
```bash
# Your current setup - already configured!
cd backend
cargo run
```

### Run with custom config
```bash
cd backend
cargo run -- --config /path/to/custom-config.yaml
```

### Run with environment overrides
```bash
cd backend
AUTH_MODE=open SERVER_PORT=9000 cargo run
```

## Switching Between Modes

To switch from Open mode to Local Users mode:

1. Edit `backend/config.yaml`
2. Change `auth.mode` from `"open"` to `"local_users"`
3. Add `local_users` and `roles` sections
4. Restart the backend: `cargo run`

To switch back to Open mode for testing:

1. Edit `backend/config.yaml`
2. Change `auth.mode` back to `"open"`
3. Restart the backend

**No code changes needed - just configuration!**

## Summary

✅ **You're already set up for testing!**
- Your `config.yaml` has `auth.mode: "open"`
- No authentication required
- Perfect for development and testing

When you're ready for production:
- Change `auth.mode` to `"local_users"` or `"oidc"`
- Add user credentials or OIDC configuration
- Configure RBAC roles if needed
- Restart the application

**The authentication system is fully implemented and working - you just control it via configuration!**
