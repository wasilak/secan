# Secan Configuration Guide

Secan uses **config-rs** for flexible configuration management. Configuration can be provided via:

1. **Configuration files** (YAML/TOML) - optional, base configuration
2. **Environment variables** - override file values
3. **Default values** - built-in fallbacks

Configuration precedence (highest to lowest):
1. Environment variables (`SECAN_*`)
2. Configuration files (`config.yaml`, `config.local.yaml`)
3. Hardcoded defaults

## Quick Start

### Development (Local Elasticsearch)

Create `config.yaml`:

```yaml
clusters:
  - id: local
    nodes:
      - http://localhost:9200
    es_version: 8
```

Run Secan:

```bash
cargo run
```

### Docker

Use environment variables to pass configuration:

```bash
docker run \
  -e SECAN_SERVER_HOST=0.0.0.0 \
  -e SECAN_SERVER_PORT=27182 \
  secan:latest
```

Or use a config file:

```bash
docker run \
  -v $(pwd)/config.yaml:/app/config.yaml \
  secan:latest
```

### Kubernetes

Use ConfigMaps for base configuration and Secrets for sensitive data.

**ConfigMap (plaintext config):**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: secan-config
data:
  config.yaml: |
    clusters:
      - id: production
        nodes:
          - http://elasticsearch.prod.svc.cluster.local:9200
        es_version: 8
```

**Secret (encrypted credentials):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: secan-secrets
type: Opaque
stringData:
  SECAN_CLUSTERS_0_AUTH_TYPE: basic
  SECAN_CLUSTERS_0_AUTH_USERNAME: elastic
  SECAN_CLUSTERS_0_AUTH_PASSWORD: "my-secret-password"
```

**Pod spec:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secan
spec:
  containers:
    - name: secan
      image: secan:latest
      envFrom:
        - configMapRef:
            name: secan-config
        - secretRef:
            name: secan-secrets
```

## Configuration File Format

### YAML Format (Recommended)

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
      - http://es1.example.com:9200
      - http://es2.example.com:9200
    auth:
      type: basic
      username: elastic
      password: secret
    tls:
      verify: true
      ca_cert_file: /etc/secan/ca.pem
    es_version: 8

cache:
  metadata_duration_seconds: 30
```

### TOML Format

```toml
[server]
host = "0.0.0.0"
port = 27182

[auth]
mode = "open"
session_timeout_minutes = 60

[[clusters]]
id = "production"
nodes = ["http://es1.example.com:9200"]
es_version = 8
```

## Configuration Options

### Server Configuration

| Option | Env Variable | Type | Default | Description |
|--------|--------------|------|---------|-------------|
| `server.host` | `SECAN_SERVER_HOST` | String | `0.0.0.0` | Server bind address |
| `server.port` | `SECAN_SERVER_PORT` | u16 | `27182` | Server port |
| `server.tls.cert_file` | N/A | String | N/A | TLS certificate file (optional) |
| `server.tls.key_file` | N/A | String | N/A | TLS key file (optional) |

### Authentication Configuration

| Option | Env Variable | Type | Default | Description |
|--------|--------------|------|---------|-------------|
| `auth.mode` | `SECAN_AUTH_MODE` | String | `open` | Auth mode: `open`, `local_users`, `oidc` |
| `auth.session_timeout_minutes` | `SECAN_AUTH_SESSION_TIMEOUT_MINUTES` | u64 | `60` | Session timeout in minutes |

### Cluster Configuration

**Required fields per cluster:**

| Option | Type | Description |
|--------|------|-------------|
| `id` | String | Unique cluster identifier |
| `nodes` | Array[String] | Elasticsearch node URLs |
| `es_version` | u8 | Elasticsearch major version (7, 8, or 9) |

**Optional fields per cluster:**

| Option | Type | Description |
|--------|------|-------------|
| `name` | String | Display name |
| `auth` | Object | Authentication config (basic, api_key, or none) |
| `tls` | Object | TLS configuration |

**Authentication Types:**

```yaml
# No authentication
auth: null

# Basic authentication
auth:
  type: basic
  username: elastic
  password: secret

# API key authentication
auth:
  type: api_key
  key: "VuaCfGcBc..."
```

**TLS Configuration:**

```yaml
tls:
  verify: true                              # Enable certificate verification
  ca_cert_file: /path/to/ca.pem           # Single CA certificate
  ca_cert_dir: /etc/secan/certs/           # Directory with CA certificates
```

### Cache Configuration

| Option | Env Variable | Type | Default | Description |
|--------|--------------|------|---------|-------------|
| `cache.metadata_duration_seconds` | `SECAN_CACHE_METADATA_DURATION_SECONDS` | u64 | `30` | Cache duration in seconds |

## Environment Variables

All configuration options can be set via environment variables using the `SECAN_` prefix with `_` as the separator.

### Simple Fields

```bash
SECAN_SERVER_HOST=127.0.0.1
SECAN_SERVER_PORT=8080
SECAN_AUTH_MODE=local_users
SECAN_AUTH_SESSION_TIMEOUT_MINUTES=120
# Note: Fields with underscores (like metadata_duration_seconds) cannot be easily overridden
# via environment variables when using _ as separator. Use config files instead.
```

### Nested Fields

```bash
SECAN_CLUSTERS_0_ID=production
SECAN_CLUSTERS_0_NODES_0=http://es1:9200
SECAN_CLUSTERS_0_NODES_1=http://es2:9200
SECAN_CLUSTERS_0_ES_VERSION=8
SECAN_CLUSTERS_0_AUTH_TYPE=basic
SECAN_CLUSTERS_0_AUTH_USERNAME=elastic
SECAN_CLUSTERS_0_AUTH_PASSWORD=secret
SECAN_CLUSTERS_0_TLS_VERIFY=true
```

### Important Notes

- **Separator**: Uses `_` (single underscore) to separate nested levels
- **Array indices**: Numeric values between field names represent array indices (e.g., `CLUSTERS_0_` for first cluster)
- **Underscore in field names**: Fields containing underscores (like `metadata_duration_seconds`) cannot be reliably overridden via environment variables due to the `_` separator. Use configuration files for these fields.

## Examples

### Local Development

**config.yaml:**

```yaml
clusters:
  - id: local
    nodes:
      - http://localhost:9200
    es_version: 8
```

### Production with Multiple Clusters

**config.yaml:**

```yaml
server:
  host: "0.0.0.0"
  port: 27182

auth:
  mode: local_users

clusters:
  - id: prod1
    name: Production - Region 1
    nodes:
      - http://prod-es1.internal:9200
      - http://prod-es2.internal:9200
    auth:
      type: basic
      username: elastic
      password: ${ELASTIC_PASSWORD}  # Use env var
    es_version: 8

  - id: prod2
    name: Production - Region 2
    nodes:
      - http://prod-es3.internal:9200
    auth:
      type: basic
      username: elastic
      password: ${ELASTIC_PASSWORD}
    es_version: 8

  - id: staging
    nodes:
      - http://staging-es.internal:9200
    es_version: 8
```

### Docker Compose

**docker-compose.yml:**

```yaml
version: '3'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    environment:
      discovery.type: single-node
    ports:
      - "9200:9200"

  secan:
    image: secan:latest
    ports:
      - "27182:27182"
    volumes:
      - ./config.yaml:/app/config.yaml
    environment:
      SECAN_SERVER_HOST: "0.0.0.0"
      RUST_LOG: info
    depends_on:
      - elasticsearch
```

**config.yaml:**

```yaml
clusters:
  - id: local
    nodes:
      - http://elasticsearch:9200
    es_version: 8
```

Run:

```bash
docker-compose up
```

### Kubernetes Deployment

**ConfigMap (config.yaml):**

```bash
kubectl create configmap secan-config --from-file=config.yaml
```

**Secret (credentials):**

```bash
kubectl create secret generic secan-secrets \
  --from-literal=SECAN_CLUSTERS_0_AUTH_USERNAME=elastic \
  --from-literal=SECAN_CLUSTERS_0_AUTH_PASSWORD=kubernetes-secret
```

**Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secan
spec:
  replicas: 1
  selector:
    matchLabels:
      app: secan
  template:
    metadata:
      labels:
        app: secan
    spec:
      containers:
        - name: secan
          image: secan:latest
          ports:
            - containerPort: 27182
          envFrom:
            - configMapRef:
                name: secan-config
            - secretRef:
                name: secan-secrets
          env:
            - name: RUST_LOG
              value: info
```

## Troubleshooting

### Configuration File Not Found

Secan looks for `config.yaml` or `config.toml` in the current working directory.

**Solution:**
- Use `-v $(pwd)/config.yaml:/app/config.yaml` in Docker
- Change to the directory containing config.yaml before running
- Use environment variables instead of config files

### Cluster Connection Fails

**Check:**
1. Cluster nodes are reachable: `curl http://es:9200`
2. Port is correct (default 9200)
3. Authentication credentials are correct
4. TLS verification settings match server certificate

### Invalid Configuration Error

Config-rs will report which field has an error. Check:
1. YAML/TOML syntax is valid
2. All required fields are present
3. Data types match (numbers, strings, booleans)
4. File permissions allow reading

### Slow Configuration Load

If config-rs takes a long time:
1. Check if it's trying to connect to network resources
2. Verify file paths are correct
3. Ensure network connectivity for OIDC discovery URLs

## Configuration File Best Practices

1. **Use config.yaml for base configuration** - version control friendly
2. **Use config.local.yaml for local overrides** - add to .gitignore
3. **Use environment variables for secrets** - never commit passwords
4. **Use environment variables in container environments** - ConfigMaps + Secrets
5. **Validate configuration on startup** - Secan validates all settings

## Environment Variable Format

For environment variables, use `_` as the separator:

```
SECAN_CLUSTERS_0_AUTH_PASSWD_HASH  (nested object with underscore in field name)
SECAN_CLUSTERS_0_NODES_0           (array indices)
SECAN_SERVER_PORT                  (nested field)
SECAN_CLUSTERS_0_ID                (nested field in array element)
```

## See Also

- `.env.example` - Example environment variables
- `config.example.yaml` - Example configuration file
- `config.toml.example` - Example TOML configuration (if available)
