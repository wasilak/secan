---
title: Cluster Configuration
description: Configure Elasticsearch and OpenSearch cluster connections
slug: 1.2/1.1/1.0/configuration/clusters
---

## Cluster Configuration

Clusters are Elasticsearch or OpenSearch instances that Secan connects to and manages. Configure them in `config.yaml` under the `clusters` section.

## Basic Cluster Configuration

Minimum configuration for a local cluster:

```yaml
clusters:
  - id: "local"
    name: "Local Elasticsearch"
    nodes:
      - "http://localhost:9200"
    es_version: 8
```

**Required Fields:**

* `id`: Unique identifier for the cluster (used in URLs and configs)
* `name`: Display name shown in the UI
* `nodes`: List of Elasticsearch node URLs
* `es_version`: Elasticsearch major version (7, 8, or 9)

## Multiple Clusters

Configure multiple clusters to manage them from one Secan instance:

```yaml
clusters:
  - id: "production"
    name: "Production Cluster"
    nodes:
      - "http://es1.example.com:9200"
      - "http://es2.example.com:9200"
      - "http://es3.example.com:9200"
    es_version: 8

  - id: "staging"
    name: "Staging Cluster"
    nodes:
      - "http://es-staging.internal:9200"
    es_version: 8

  - id: "development"
    name: "Development Cluster"
    nodes:
      - "http://es-dev.internal:9200"
    es_version: 7
```

## Authentication

### No Authentication

For clusters without authentication:

```yaml
clusters:
  - id: "local"
    name: "Local Elasticsearch"
    nodes:
      - "http://localhost:9200"
    es_version: 8
```

### Basic Authentication

Username and password:

```yaml
clusters:
  - id: "production"
    name: "Production Cluster"
    nodes:
      - "http://es.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "secure-password"
    es_version: 8
```

**Security Note:** Use environment variables for passwords:

```bash
export SECAN_CLUSTERS_0_AUTH_PASSWORD="actual-password"
```

Then in config.yaml, the password will be read from the environment variable.

### API Key Authentication

Use API keys (supported in Elasticsearch 7.10+):

```yaml
clusters:
  - id: "monitoring"
    name: "Monitoring Cluster"
    nodes:
      - "http://es-monitoring:9200"
    auth:
      type: "api_key"
      key: "VuaCfGcBxxx=="
    es_version: 8
```

Generate API keys in Elasticsearch:

```json
POST /_security/api_key
{
  "name": "secan-key",
  "expiration": "90d"
}
```

## TLS/HTTPS Configuration

For clusters using HTTPS with certificate verification:

```yaml
clusters:
  - id: "secure"
    name: "Secure Cluster"
    nodes:
      - "https://es.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "password"
    tls:
      verify: true
      ca_cert_file: "/etc/secan/ca.pem"
    es_version: 8
```

**TLS Configuration Fields:**

* `verify`: Enable/disable certificate verification (default: true in production)
* `ca_cert_file`: Path to CA certificate file for verification

For self-signed certificates in development:

```yaml
tls:
  verify: false  # Only for development!
```

## Node Configuration

Specify one or more nodes in a cluster. Secan will use any available node for requests:

```yaml
clusters:
  - id: "cluster1"
    name: "Multi-node Cluster"
    nodes:
      - "http://es-node1:9200"
      - "http://es-node2:9200"
      - "http://es-node3:9200"
    es_version: 8
```

## Elasticsearch Version

Set the correct Elasticsearch major version:

```yaml
clusters:
  - es_version: 7  # For 7.x releases
  - es_version: 8  # For 8.x releases
  - es_version: 9  # For 9.x releases (including OpenSearch)
```

This affects API compatibility and UI features shown.

## Environment Variable Configuration

Configure clusters via environment variables for Docker/Kubernetes deployments:

```bash
# First cluster (index 0)
export SECAN_CLUSTERS_0_ID=production
export SECAN_CLUSTERS_0_NAME="Production Cluster"
export SECAN_CLUSTERS_0_NODES_0=http://es1.example.com:9200
export SECAN_CLUSTERS_0_NODES_1=http://es2.example.com:9200
export SECAN_CLUSTERS_0_ES_VERSION=8
export SECAN_CLUSTERS_0_AUTH_TYPE=basic
export SECAN_CLUSTERS_0_AUTH_USERNAME=elastic
export SECAN_CLUSTERS_0_AUTH_PASSWORD=password

# Second cluster (index 1)
export SECAN_CLUSTERS_1_ID=staging
export SECAN_CLUSTERS_1_NODES_0=http://es-staging.internal:9200
export SECAN_CLUSTERS_1_ES_VERSION=8
```

## Docker Compose Example

```yaml

services:
  secan:
    image: ghcr.io/wasilak/secan:1.1
    ports:
      - "27182:27182"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
    environment:
      - SECAN_AUTH_MODE=open
```

With inline cluster configuration:

```yaml
services:
  secan:
    image: ghcr.io/wasilak/secan:1.1
    ports:
      - "27182:27182"
    environment:
      - SECAN_AUTH_MODE=open
      - SECAN_CLUSTERS_0_ID=local
      - SECAN_CLUSTERS_0_NAME=Local Elasticsearch
      - SECAN_CLUSTERS_0_NODES_0=http://elasticsearch:9200
      - SECAN_CLUSTERS_0_ES_VERSION=8
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"
```

## Best Practices

1. **Use environment variables for secrets** - Never commit passwords to version control
2. **Verify TLS certificates** - Use proper CA certificates in production
3. **Test cluster connection** - Verify Secan can reach all configured clusters on startup
4. **Use meaningful IDs** - Choose cluster IDs that indicate their environment (production, staging, dev)
5. **Monitor authentication** - Log and audit cluster access
6. **Use API keys over passwords** - API keys are more secure and auditable
