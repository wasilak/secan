# Configuration Quick Reference

## Most Common Use Cases

### Development (Local Elasticsearch)

```bash
# 1. Create config.yaml in project root
cat > config.yaml << 'EOF'
clusters:
  - id: local
    nodes:
      - http://localhost:9200
    es_version: 8
EOF

# 2. Run server
cargo run
```

### Docker Container

```bash
docker run \
  -e SECAN_CLUSTERS_0_ID=production \
  -e SECAN_CLUSTERS_0_NODES_0=http://elasticsearch:9200 \
  -p 27182:27182 \
  secan:latest
```

### Kubernetes Deployment

```bash
# 1. Create ConfigMap with config
kubectl create configmap secan-config --from-file=config.yaml

# 2. Create Secret for credentials
kubectl create secret generic secan-secrets \
  --from-literal=SECAN_CLUSTERS_0_AUTH_USERNAME=elastic \
  --from-literal=SECAN_CLUSTERS_0_AUTH_PASSWORD=password

# 3. Deploy (see docs/configuration.md for full manifest)
kubectl apply -f deployment.yaml
```

## Environment Variable Format

### Naming Convention
```
SECAN_<FIELD>_<SUBFIELD>_<ARRAY_INDEX>_<VALUE>
      ^     ^    ^        ^             ^
      |     |    |        |             └─ Field name
      |     |    |        └──────────────── Array index (0, 1, 2, ...)
      |     |    └───────────────────────── Nested field
      |     └──────────────────────────────── Top-level field
      └────────────────────────────────────── Prefix (always SECAN_)
```

### Examples

| Use Case | Environment Variable | Value |
|----------|---------------------|-------|
| Server hostname | `SECAN_SERVER_HOST` | `0.0.0.0` |
| Server port | `SECAN_SERVER_PORT` | `27182` |
| Auth mode | `SECAN_AUTH_MODE` | `open` \| `local_users` \| `oidc` |
| First cluster ID | `SECAN_CLUSTERS_0_ID` | `production` |
| First cluster node | `SECAN_CLUSTERS_0_NODES_0` | `http://es1:9200` |
| Second cluster node | `SECAN_CLUSTERS_0_NODES_1` | `http://es2:9200` |
| Cluster auth user | `SECAN_CLUSTERS_0_AUTH_USERNAME` | `elastic` |
| Cluster auth pass | `SECAN_CLUSTERS_0_AUTH_PASSWORD` | `secret` |

## Configuration File Format

### YAML (Recommended)

```yaml
server:
  host: "0.0.0.0"
  port: 27182

auth:
  mode: open
  session_timeout_minutes: 60

clusters:
  - id: production
    name: Production Cluster
    nodes:
      - http://es1.internal:9200
      - http://es2.internal:9200
    auth:
      type: basic
      username: elastic
      password: secret
    tls:
      verify: true
    es_version: 8

cache:
  metadata_duration_seconds: 30
```

### TOML Alternative

```toml
[server]
host = "0.0.0.0"
port = 27182

[auth]
mode = "open"

[[clusters]]
id = "production"
nodes = ["http://localhost:9200"]
```

## Precedence Rules

When multiple sources define the same setting:

```
Environment Variables (highest)
         ↓
Config Files (config.yaml, config.local.yaml, config.toml)
         ↓
Built-in Defaults (lowest)
```

**Example**: If `config.yaml` has port 8080, but `SECAN_SERVER_PORT=9999` is set, the server will use port 9999.

## Default Values

```
server.host: 0.0.0.0
server.port: 27182
auth.mode: open
auth.session_timeout_minutes: 60
cache.metadata_duration_seconds: 30
```

## File Resolution

The application looks for configuration files in this order:
1. `config.yaml` (if exists)
2. `config.local.yaml` (if exists, overrides config.yaml)
3. `config.yml` (if exists, alternative extension)
4. `config.local.yml` (if exists)
5. `config.toml` (if exists, TOML format)

> **Tip**: Use `config.local.yaml` for local development (add to .gitignore)

## Common Patterns

### Single Cluster (Most Common)
```yaml
clusters:
  - id: main
    nodes:
      - http://localhost:9200
    es_version: 8
```

### Multiple Clusters
```yaml
clusters:
  - id: production
    nodes:
      - http://prod-es:9200
  - id: staging
    nodes:
      - http://staging-es:9200
```

### With Authentication
```yaml
clusters:
  - id: secure
    nodes:
      - https://es.example.com:9200
    auth:
      type: basic
      username: elastic
      password: ${ELASTIC_PASSWORD}  # Can use env vars in YAML
    tls:
      verify: true
```

### With TLS Certificates
```yaml
clusters:
  - id: secure
    nodes:
      - https://es.example.com:9200
    tls:
      verify: true
      ca_cert_file: /etc/certs/ca.pem
      # or
      ca_cert_dir: /etc/certs/
```

## Validation on Startup

Secan validates configuration on startup and provides clear error messages:

```
Error: At least one cluster must be configured
Error: Cluster 'prod' must have at least one node
Error: TLS certificate file does not exist: /etc/certs/ca.pem
```

## Troubleshooting

### Config file not found?
Ensure `config.yaml` is in the working directory where you run Secan.

```bash
cd /app
cargo run  # Looks for config.yaml here
```

### Environment variable not working?
Check:
1. Variable name matches pattern: `SECAN_*`
2. Values with underscores use the correct format (see examples)
3. Type matches field (e.g., port is a number)

### Too many config files?
Keep it simple:
- Use `config.yaml` for base (version controlled)
- Use `config.local.yaml` for local overrides (in .gitignore)
- Use environment variables for deployment (Kubernetes/Docker)

## Field Types

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `server.port` | u16 | `27182` | 1-65535 |
| `server.host` | String | `0.0.0.0` | IP or hostname |
| `auth.mode` | String | `open` | `open`, `local_users`, `oidc` |
| `clusters[].es_version` | u8 | `8` | `7`, `8`, or `9` only |
| `cache.metadata_duration_seconds` | u64 | `30` | Seconds |

## See Also

- [docs/configuration.md](configuration.md) - Full configuration guide
- [docs/docker-deployment.md](docker-deployment.md) - Docker/Kubernetes examples
- [config.example.yaml](../config.example.yaml) - Complete example
- [.env.example](../.env.example) - Environment variable examples
