# Docker Deployment Guide

This guide covers deploying Secan using Docker and Docker Compose.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start Secan
docker-compose up -d

# View logs
docker-compose logs -f secan

# Stop Secan
docker-compose down
```

Access Secan at `http://localhost:9001`

### Using Docker CLI

```bash
# Build the image
docker build -t secan:latest .

# Run the container
docker run -d \
  --name secan \
  -p 9000:9000 \
  -e SECAN_AUTH_MODE=open \
  secan:latest

# View logs
docker logs -f secan

# Stop the container
docker stop secan
docker rm secan
```

## Configuration

### Environment Variables

Configure Secan using environment variables:

```yaml
# docker-compose.yml
services:
  secan:
    environment:
      # Server configuration
      - SECAN_SERVER_HOST=0.0.0.0
      - SECAN_SERVER_PORT=9001
      
      # Authentication
      - SECAN_AUTH_MODE=open  # or local_users, oidc
      - SECAN_AUTH_SESSION_TIMEOUT_MINUTES=60
      
      # Logging
      - RUST_LOG=info  # or debug, warn, error
```

### Configuration File

Mount a configuration file for more complex setups:

```bash
# Copy example config and customize
cp config.example.yaml config.yaml
# Edit config.yaml to set:
# server:
#   host: "0.0.0.0"
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
  --name secan \
  -p 9000:9000 \
  -v $(pwd)/config.yaml:/config/config.yaml:ro \
  secan:latest
```

Or with Docker Compose:

```yaml
services:
  secan:
    volumes:
      - ./config.yaml:/config/config.yaml:ro
```

### TLS Certificates

Mount TLS certificates for secure cluster connections:

```yaml
services:
  secan:
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
  secan:
    environment:
      - SECAN_AUTH_MODE=open
      - SECAN_CLUSTERS=[{"id":"local","name":"Local ES","nodes":["http://elasticsearch:9200"],"auth":{"type":"none"},"tls":{"verify":false}}]
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
  secan:
    # ... secan config ...
    environment:
      - SECAN_CLUSTERS=[{"id":"local","name":"Local ES","nodes":["http://elasticsearch:9200"],"auth":{"type":"none"},"tls":{"verify":false}}]
  
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
      - secan-network

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
  --name secan \
  -p 9000:9000 \
  -e SECAN_CLUSTERS='[{"id":"local","name":"Local ES","nodes":["http://host.docker.internal:9200"]}]' \
  secan:latest

# Or use host network mode (Linux only)
docker run -d \
  --name secan \
  --network host \
  -e SECAN_CLUSTERS='[{"id":"local","name":"Local ES","nodes":["http://localhost:9200"]}]' \
  secan:latest
```

## Authentication Modes

### Open Mode (No Authentication)

```yaml
services:
  secan:
    environment:
      - SECAN_AUTH_MODE=open
```

### Local Users

```yaml
services:
  secan:
    environment:
      - SECAN_AUTH_MODE=local_users
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

# Or use the Secan CLI (if available)
./secan hash-password mypassword
```

### OIDC Authentication

```yaml
auth:
  mode: "oidc"
  oidc:
    discovery_url: "https://auth.example.com/.well-known/openid-configuration"
    client_id: "secan"
    client_secret: "secret"
    redirect_uri: "http://localhost:9001/api/auth/oidc/callback"
```

## Health Checks

The Docker image includes a health check endpoint:

```bash
# Check health
curl http://localhost:9001/health

# Docker health status
docker inspect --format='{{.State.Health.Status}}' secan
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
docker-compose logs -f secan

# Docker CLI
docker logs -f secan
```

### Configure Log Level

```yaml
services:
  secan:
    environment:
      - RUST_LOG=debug  # trace, debug, info, warn, error
```

### JSON Logging

For structured logging:

```yaml
services:
  secan:
    environment:
      - RUST_LOG=info
      - RUST_LOG_FORMAT=json
```

## Production Deployment

### Resource Limits

```yaml
services:
  secan:
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
  secan:
    restart: unless-stopped
```

### Security

Run as non-root user (already configured in Dockerfile):

```dockerfile
USER secan
```

Use read-only root filesystem:

```yaml
services:
  secan:
    read_only: true
    tmpfs:
      - /tmp
```

### Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name secan.example.com;
    
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
  name: secan
spec:
  replicas: 2
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
        - containerPort: 9000
        env:
        - name: SECAN_AUTH_MODE
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
  name: secan
spec:
  selector:
    app: secan
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
  name: secan-config
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
  name: secan
spec:
  template:
    spec:
      containers:
      - name: secan
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: secan-config
```

## Troubleshooting

### Container Won't Start

Check logs:

```bash
docker logs secan
```

Common issues:
- Port 9000 already in use: Change port mapping `-p 8080:9000`
- Configuration errors: Validate `config.yaml` syntax
- Permission issues: Ensure volumes are readable

### Cannot Connect to Elasticsearch

1. Check network connectivity:

```bash
docker exec secan wget -O- http://elasticsearch:9200
```

2. Verify cluster configuration:

```bash
docker exec secan cat /config/config.yaml
```

3. Check Elasticsearch is accessible from container network

### Health Check Failing

```bash
# Check health endpoint manually
docker exec secan wget -O- http://localhost:9000/health

# Check if service is listening
docker exec secan netstat -tlnp
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
docker build --build-arg RUST_VERSION=1.76 -t secan:custom .
```

### Multi-Architecture Builds

```bash
# Enable buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t secan:latest \
  --push .
```

## Maintenance

### Updating Secan

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
docker cp secan:/config/config.yaml ./backup-config.yaml

# Backup with docker-compose
docker-compose exec secan cat /config/config.yaml > backup-config.yaml
```

### Cleanup

```bash
# Remove stopped containers
docker-compose down

# Remove with volumes
docker-compose down -v

# Remove images
docker rmi secan:latest
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f secan`
- Verify configuration: `docker-compose config`
- Test health: `curl http://localhost:9000/health`
- Review documentation: [CONFIGURATION.md](CONFIGURATION.md)
