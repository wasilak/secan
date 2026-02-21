# Docker Deployment Guide

This guide shows how to run Secan in Docker with proper configuration management.

## Quick Start

### 1. Build the Docker Image

```bash
docker build -t secan:latest .
```

### 2. Run with Default Configuration

The image includes a default `config.yaml` that loads a single local cluster:

```bash
docker run -p 27182:27182 secan:latest
```

This will:
- Start Secan on `0.0.0.0:27182`
- Load configuration from `/app/config.yaml` (built-in default)
- Connect to the example cluster configuration

### 3. Run with Custom Configuration

**Option A: Mount your own config file**

```bash
docker run \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -p 27182:27182 \
  secan:latest
```

**Option B: Use environment variables to override**

```bash
docker run \
  -e SECAN_SERVER_HOST=0.0.0.0 \
  -e SECAN_SERVER_PORT=27182 \
  -e SECAN_AUTH_MODE=local_users \
  -p 27182:27182 \
  secan:latest
```

**Option C: Use .env file**

Create `.env`:

```bash
SECAN_SERVER_HOST=0.0.0.0
SECAN_SERVER_PORT=27182
SECAN_AUTH_MODE=open
RUST_LOG=debug
```

Run:

```bash
docker run --env-file=.env -p 27182:27182 secan:latest
```

## Configuration Precedence

When running Secan in Docker:

1. **Environment variables** (highest priority)
   - Set via `-e VAR=value` or `--env-file`
   - Override config file values
   
2. **Mounted config files** (medium priority)
   - Mount your own `config.yaml` at `/app/config.yaml`
   - Replaces built-in default

3. **Built-in defaults** (lowest priority)
   - Includes default `config.yaml` with single local cluster
   - Used if no custom config is mounted

## Docker Compose Example

### Simple Setup (Single Node)

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
    ports:
      - "9200:9200"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9200"]
      interval: 30s
      timeout: 10s
      retries: 3

  secan:
    build: .
    ports:
      - "27182:27182"
    environment:
      SECAN_SERVER_HOST: "0.0.0.0"
      SECAN_SERVER_PORT: "27182"
      RUST_LOG: "info"
    volumes:
      - ./config.yaml:/app/config.yaml
    depends_on:
      elasticsearch:
        condition: service_healthy
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

### Production Setup (Multiple Clusters)

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  secan:
    build: .
    ports:
      - "27182:27182"
    environment:
      SECAN_SERVER_HOST: "0.0.0.0"
      SECAN_SERVER_PORT: "27182"
      SECAN_AUTH_MODE: "local_users"
      RUST_LOG: "info"
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./certs:/etc/secan/certs:ro
    networks:
      - secan
    restart: unless-stopped

networks:
  secan:
    driver: bridge
```

**config.yaml:**

```yaml
auth:
  mode: local_users
  session_timeout_minutes: 120

clusters:
  - id: production
    name: Production
    nodes:
      - https://prod-es1.internal:9200
      - https://prod-es2.internal:9200
    auth:
      type: basic
      username: elastic
      password: ${ELASTIC_PASSWORD}  # From environment
    tls:
      verify: true
      ca_cert_file: /etc/secan/certs/ca.pem
    es_version: 8

  - id: staging
    name: Staging
    nodes:
      - https://staging-es.internal:9200
    auth:
      type: basic
      username: elastic
      password: ${ELASTIC_PASSWORD}
    es_version: 8
```

Run:

```bash
export ELASTIC_PASSWORD=your-secure-password
docker-compose up
```

## Kubernetes Deployment

### Using ConfigMaps and Secrets

**1. Create ConfigMap with configuration**

```bash
kubectl create configmap secan-config \
  --from-file=config.yaml
```

**2. Create Secret for credentials**

```bash
kubectl create secret generic secan-credentials \
  --from-literal=ELASTIC_PASSWORD=your-secret-password
```

**3. Create Deployment**

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
          
          # Mount config file from ConfigMap
          volumeMounts:
            - name: config
              mountPath: /app
            - name: certs
              mountPath: /etc/secan/certs
              readOnly: true
          
          # Set environment variables
          env:
            - name: SECAN_SERVER_HOST
              value: "0.0.0.0"
            - name: SECAN_SERVER_PORT
              value: "27182"
            - name: RUST_LOG
              value: "info"
            - name: ELASTIC_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: secan-credentials
                  key: ELASTIC_PASSWORD
          
          # Resource limits
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          
          # Health check
          livenessProbe:
            httpGet:
              path: /health
              port: 27182
            initialDelaySeconds: 10
            periodSeconds: 30
          
          readinessProbe:
            httpGet:
              path: /ready
              port: 27182
            initialDelaySeconds: 5
            periodSeconds: 10
      
      # Volume definitions
      volumes:
        - name: config
          configMap:
            name: secan-config
        - name: certs
          secret:
            secretName: secan-certs

---
apiVersion: v1
kind: Service
metadata:
  name: secan
spec:
  selector:
    app: secan
  ports:
    - protocol: TCP
      port: 27182
      targetPort: 27182
  type: LoadBalancer
```

**4. Apply to cluster**

```bash
kubectl apply -f secan-deployment.yaml
```

## Environment Variables Reference

All configuration can be overridden via environment variables:

```bash
# Server
SECAN_SERVER_HOST=0.0.0.0
SECAN_SERVER_PORT=27182

# Authentication
SECAN_AUTH_MODE=open  # open, local_users, or oidc
SECAN_AUTH_SESSION_TIMEOUT_MINUTES=60

# Cache
SECAN_CACHE_METADATA_DURATION_SECONDS=30

# Logging
RUST_LOG=info  # trace, debug, info, warn, error
```

## Troubleshooting

### Container won't start

Check logs:

```bash
docker logs <container_id>
```

Common issues:
- Missing configuration - ensure config.yaml is mounted or includes clusters
- Port already in use - change SECAN_SERVER_PORT
- Elasticsearch unreachable - verify connection in config.yaml

### Configuration not loading

1. Verify config.yaml is mounted:

```bash
docker exec <container_id> cat /app/config.yaml
```

2. Check environment variables:

```bash
docker exec <container_id> env | grep SECAN
```

3. Verify YAML syntax:

```bash
docker run --rm -v $(pwd)/config.yaml:/config.yaml alpine \
  sh -c "cat /config.yaml | od -c | head"
```

### Slow startup

Check if it's trying to connect to Elasticsearch:

```bash
docker logs <container_id> | grep -E "Initializing|error|timeout"
```

Elasticsearch must be ready before Secan starts successfully.

## Production Considerations

1. **Use reverse proxy** for TLS termination (nginx, traefik, caddy)
2. **Disable Elasticsearch security** for development, enable for production
3. **Use Secrets** for sensitive data (passwords, API keys)
4. **Configure resource limits** in Kubernetes
5. **Set up health checks** for orchestration
6. **Use ConfigMaps** for configuration management
7. **Monitor logs** for errors and issues

## See Also

- `docs/configuration.md` - Comprehensive configuration guide
- `config.example.yaml` - Example configuration file
- `.env.example` - Example environment variables
