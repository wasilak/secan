# Docker Deployment Guide

This guide covers deploying Cerebro using Docker and Docker Compose.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start Cerebro
docker-compose up -d

# View logs
docker-compose logs -f cerebro

# Stop Cerebro
docker-compose down
```

Access Cerebro at `http://localhost:9001`

### Using Docker CLI

```bash
# Build the image
docker build -t cerebro:latest .

# Run the container
docker run -d \
  --name cerebro \
  -p 9000:9000 \
  -e CEREBRO_AUTH_MODE=open \
  cerebro:latest

# View logs
docker logs -f cerebro

# Stop the container
docker stop cerebro
docker rm cerebro
```

## Configuration

### Environment Variables

Configure Cerebro using environment variables:

```yaml
# docker-compose.yml
services:
  cerebro:
    environment:
      # Server configuration
      - CEREBRO_SERVER_HOST=0.0.0.0
      - CEREBRO_SERVER_PORT=9001
      
      # Authentication
      - CEREBRO_AUTH_MODE=open  # or local_users, oidc
      - CEREBRO_AUTH_SESSION_TIMEOUT_MINUTES=60
      
      # Logging
      - RUST_LOG=info  # or debug, warn, error
```

### Configuration File

Mount a configuration file for more complex setups:

```bash
# Create config.yaml
cat > config.yaml <<EOF
server:
  host: "0.0.0.0"
  port: 9001

auth:
  mode: "local_users"
  session_timeout_minutes: 60
  local_users:
    - username: "admin"
      password_hash: "\$2b\$12\$..."
      roles: ["admin"]

clusters:
  - id: "production"
    name: "Production Cluster"
    nodes:
      - "https://es-prod.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "changeme"
    tls:
      verify: true
      ca_cert_file: "/certs/ca.pem"
EOF

# Run with config file
docker run -d \
  --name cerebro \
  -p 9000:9000 \
  -v $(pwd)/config.yaml:/config/config.yaml:ro \
  cerebro:latest
```

Or with Docker Compose:

```yaml
services:
  cerebro:
    volumes:
      - ./config.yaml:/config/config.yaml:ro
```

### TLS Certificates

Mount TLS certificates for secure cluster connections:

```yaml
services:
  cerebro:
    volumes:
      - ./config.yaml:/config/config.yaml:ro
      - ./certs:/certs:ro
```

Then reference them in your config:

```yaml
clusters:
  - id: "secure-cluster"
    name: "Secure Cluster"
    nodes:
      - "https://es.example.com:9200"
    tls:
      verify: true
      ca_cert_file: "/certs/ca.pem"
```

## Cluster Configuration Examples

### Single Cluster (Open Auth)

```yaml
services:
  cerebro:
    environment:
      - CEREBRO_AUTH_MODE=open
      - CEREBRO_CLUSTERS=[{"id":"local","name":"Local ES","nodes":["http://elasticsearch:9200"],"auth":{"type":"none"},"tls":{"verify":false}}]
```

### Multiple Clusters

Create a `config.yaml`:

```yaml
clusters:
  - id: "dev"
    name: "Development"
    nodes:
      - "http://es-dev:9200"
    auth:
      type: "none"
    tls:
      verify: false
  
  - id: "staging"
    name: "Staging"
    nodes:
      - "https://es-staging.example.com:9200"
    auth:
      type: "basic"
      username: "elastic"
      password: "changeme"
    tls:
      verify: true
  
  - id: "prod"
    name: "Production"
    nodes:
      - "https://es-prod-1.example.com:9200"
      - "https://es-prod-2.example.com:9200"
      - "https://es-prod-3.example.com:9200"
    auth:
      type: "api_key"
      key: "base64-encoded-api-key"
    tls:
      verify: true
      ca_cert_file: "/certs/prod-ca.pem"
```

## Running with Elasticsearch

### Docker Compose with Elasticsearch

Uncomment the Elasticsearch service in `docker-compose.yml`:

```yaml
services:
  cerebro:
    # ... cerebro config ...
    environment:
      - CEREBRO_CLUSTERS=[{"id":"local","name":"Local ES","nodes":["http://elasticsearch:9200"],"auth":{"type":"none"},"tls":{"verify":false}}]
  
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data
    networks:
      - cerebro-network

volumes:
  es-data:
    driver: local
```

Then start both services:

```bash
docker-compose up -d
```

### Connecting to External Elasticsearch

If Elasticsearch is running outside Docker:

```bash
# Linux/macOS: Use host.docker.internal
docker run -d \
  --name cerebro \
  -p 9000:9000 \
  -e CEREBRO_CLUSTERS='[{"id":"local","name":"Local ES","nodes":["http://host.docker.internal:9200"]}]' \
  cerebro:latest

# Or use host network mode (Linux only)
docker run -d \
  --name cerebro \
  --network host \
  -e CEREBRO_CLUSTERS='[{"id":"local","name":"Local ES","nodes":["http://localhost:9200"]}]' \
  cerebro:latest
```

## Authentication Modes

### Open Mode (No Authentication)

```yaml
services:
  cerebro:
    environment:
      - CEREBRO_AUTH_MODE=open
```

### Local Users

```yaml
services:
  cerebro:
    environment:
      - CEREBRO_AUTH_MODE=local_users
    volumes:
      - ./config.yaml:/config/config.yaml:ro
```

With `config.yaml`:

```yaml
auth:
  mode: "local_users"
  local_users:
    - username: "admin"
      password_hash: "$2b$12$..."  # bcrypt hash
      roles: ["admin"]
    - username: "viewer"
      password_hash: "$2b$12$..."
      roles: ["viewer"]
```

Generate password hash:

```bash
# Using Python
python3 -c "import bcrypt; print(bcrypt.hashpw(b'password', bcrypt.gensalt()).decode())"

# Or use the Cerebro CLI (if available)
./cerebro hash-password mypassword
```

### OIDC Authentication

```yaml
auth:
  mode: "oidc"
  oidc:
    discovery_url: "https://auth.example.com/.well-known/openid-configuration"
    client_id: "cerebro"
    client_secret: "secret"
    redirect_uri: "http://localhost:9001/api/auth/oidc/callback"
```

## Health Checks

The Docker image includes a health check endpoint:

```bash
# Check health
curl http://localhost:9001/health

# Docker health status
docker inspect --format='{{.State.Health.Status}}' cerebro
```

Health check configuration in `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9001/health"]
  interval: 30s
  timeout: 3s
  start_period: 5s
  retries: 3
```

## Logging

### View Logs

```bash
# Docker Compose
docker-compose logs -f cerebro

# Docker CLI
docker logs -f cerebro
```

### Configure Log Level

```yaml
services:
  cerebro:
    environment:
      - RUST_LOG=debug  # trace, debug, info, warn, error
```

### JSON Logging

For structured logging:

```yaml
services:
  cerebro:
    environment:
      - RUST_LOG=info
      - RUST_LOG_FORMAT=json
```

## Production Deployment

### Resource Limits

```yaml
services:
  cerebro:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Restart Policy

```yaml
services:
  cerebro:
    restart: unless-stopped
```

### Security

Run as non-root user (already configured in Dockerfile):

```dockerfile
USER cerebro
```

Use read-only root filesystem:

```yaml
services:
  cerebro:
    read_only: true
    tmpfs:
      - /tmp
```

### Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name cerebro.example.com;
    
    location / {
        proxy_pass http://localhost:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Kubernetes Deployment

### Basic Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cerebro
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cerebro
  template:
    metadata:
      labels:
        app: cerebro
    spec:
      containers:
      - name: cerebro
        image: cerebro:latest
        ports:
        - containerPort: 9000
        env:
        - name: CEREBRO_AUTH_MODE
          value: "open"
        - name: RUST_LOG
          value: "info"
        livenessProbe:
          httpGet:
            path: /health
            port: 9000
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 9000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "500m"
            memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: cerebro
spec:
  selector:
    app: cerebro
  ports:
  - port: 80
    targetPort: 9000
  type: LoadBalancer
```

### ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cerebro-config
data:
  config.yaml: |
    server:
      host: "0.0.0.0"
      port: 9000
    auth:
      mode: "open"
    clusters:
      - id: "prod"
        name: "Production"
        nodes:
          - "http://elasticsearch:9200"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cerebro
spec:
  template:
    spec:
      containers:
      - name: cerebro
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: cerebro-config
```

## Troubleshooting

### Container Won't Start

Check logs:

```bash
docker logs cerebro
```

Common issues:
- Port 9000 already in use: Change port mapping `-p 8080:9000`
- Configuration errors: Validate `config.yaml` syntax
- Permission issues: Ensure volumes are readable

### Cannot Connect to Elasticsearch

1. Check network connectivity:

```bash
docker exec cerebro wget -O- http://elasticsearch:9200
```

2. Verify cluster configuration:

```bash
docker exec cerebro cat /config/config.yaml
```

3. Check Elasticsearch is accessible from container network

### Health Check Failing

```bash
# Check health endpoint manually
docker exec cerebro wget -O- http://localhost:9000/health

# Check if service is listening
docker exec cerebro netstat -tlnp
```

## Building Custom Images

### Build Arguments

```dockerfile
# Dockerfile with build args
ARG RUST_VERSION=1.75
FROM rust:${RUST_VERSION}-alpine AS backend-builder
```

Build with custom args:

```bash
docker build --build-arg RUST_VERSION=1.76 -t cerebro:custom .
```

### Multi-Architecture Builds

```bash
# Enable buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t cerebro:latest \
  --push .
```

## Maintenance

### Updating Cerebro

```bash
# Pull latest image
docker-compose pull

# Restart with new image
docker-compose up -d

# Or rebuild from source
docker-compose build
docker-compose up -d
```

### Backup Configuration

```bash
# Backup config
docker cp cerebro:/config/config.yaml ./backup-config.yaml

# Backup with docker-compose
docker-compose exec cerebro cat /config/config.yaml > backup-config.yaml
```

### Cleanup

```bash
# Remove stopped containers
docker-compose down

# Remove with volumes
docker-compose down -v

# Remove images
docker rmi cerebro:latest
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f cerebro`
- Verify configuration: `docker-compose config`
- Test health: `curl http://localhost:9000/health`
- Review documentation: [CONFIGURATION.md](CONFIGURATION.md)
