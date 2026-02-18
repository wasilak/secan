# Secan Configuration Guide

## Authentication Modes

Secan supports three authentication modes, configured in `config.yaml`:

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

## Shard Relocation Configuration

Shard relocation behavior can be controlled through Elasticsearch cluster settings. While Secan provides the UI for manual relocation, you may want to configure Elasticsearch allocation settings:

### Elasticsearch Allocation Settings

These settings control how Elasticsearch allocates and rebalances shards. You can configure them via Secan's REST Console or directly through Elasticsearch:

```json
PUT /_cluster/settings
{
  "persistent": {
    "cluster.routing.allocation.enable": "all",
    "cluster.routing.rebalance.enable": "all",
    "cluster.routing.allocation.cluster_concurrent_rebalance": 2,
    "cluster.routing.allocation.node_concurrent_recoveries": 2,
    "cluster.routing.allocation.disk.threshold_enabled": true,
    "cluster.routing.allocation.disk.watermark.low": "85%",
    "cluster.routing.allocation.disk.watermark.high": "90%"
  }
}
```

### Allocation Settings Explained

| Setting | Description | Default |
|---------|-------------|---------|
| `cluster.routing.allocation.enable` | Controls shard allocation: `all`, `primaries`, `new_primaries`, `none` | `all` |
| `cluster.routing.rebalance.enable` | Controls shard rebalancing: `all`, `primaries`, `replicas`, `none` | `all` |
| `cluster.routing.allocation.cluster_concurrent_rebalance` | Max concurrent shard rebalances | `2` |
| `cluster.routing.allocation.node_concurrent_recoveries` | Max concurrent recoveries per node | `2` |
| `cluster.routing.allocation.disk.watermark.low` | Disk usage threshold to stop allocating to node | `85%` |
| `cluster.routing.allocation.disk.watermark.high` | Disk usage threshold to relocate shards away | `90%` |

### Disabling Automatic Rebalancing

If you want to manually control all shard placement using Secan:

```json
PUT /_cluster/settings
{
  "persistent": {
    "cluster.routing.rebalance.enable": "none"
  }
}
```

This prevents Elasticsearch from automatically rebalancing shards, giving you full manual control through Secan's shard relocation feature.

### Throttling Relocations

To prevent overwhelming the cluster during manual relocations:

```json
PUT /_cluster/settings
{
  "persistent": {
    "cluster.routing.allocation.cluster_concurrent_rebalance": 1,
    "indices.recovery.max_bytes_per_sec": "40mb"
  }
}
```

This limits concurrent relocations and recovery speed.

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
2. `/etc/secan/config.yaml`
3. `~/.config/secan/config.yaml`

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
cargo run -- --config /path/to/custom-config.yaml
```

### Run with environment overrides
```bash
cd backend
AUTH_MODE=open SERVER_PORT=9000 cargo run
```

## Switching Between Modes

To switch from Open mode to Local Users mode:

1. Edit `config.yaml`
2. Change `auth.mode` from `"open"` to `"local_users"`
3. Add `local_users` and `roles` sections
4. Restart the backend: `cargo run`

To switch back to Open mode for testing:

1. Edit `config.yaml`
2. Change `auth.mode` back to `"open"`
3. Restart the backend

**No code changes needed - just configuration!**

## Summary

✅ **You're already set up for testing!**
- Copy `config.example.yaml` to `config.yaml`
- The example config has `auth.mode: "open"`
- No authentication required
- Perfect for development and testing

When you're ready for production:
- Change `auth.mode` to `"local_users"` or `"oidc"`
- Add user credentials or OIDC configuration
- Configure RBAC roles if needed
- Restart the application

**The authentication system is fully implemented and working - you just control it via configuration!**
