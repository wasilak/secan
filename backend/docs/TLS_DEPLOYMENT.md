# TLS/HTTPS Deployment Guide

## Overview

Secan backend is designed to run behind a reverse proxy that handles TLS termination. This is the recommended approach for production deployments of Rust web applications.

## Why Use a Reverse Proxy?

1. **Security**: Reverse proxies like nginx, traefik, and caddy are battle-tested for TLS handling
2. **Performance**: They are optimized for TLS termination and static file serving
3. **Flexibility**: Easy to update TLS certificates without restarting the application
4. **Features**: Load balancing, rate limiting, caching, and more
5. **Best Practice**: Industry standard for production deployments

## Recommended Reverse Proxies

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name secan.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers (in addition to those set by Secan)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name secan.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Traefik (Docker Compose)

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"

  secan:
    image: secan:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.secan.rule=Host(`secan.example.com`)"
      - "traefik.http.routers.secan.entrypoints=websecure"
      - "traefik.http.routers.secan.tls.certresolver=letsencrypt"
      - "traefik.http.services.secan.loadbalancer.server.port=9000"
```

### Caddy

Caddy automatically handles TLS certificates via Let's Encrypt:

```caddyfile
secan.example.com {
    reverse_proxy localhost:9000
    
    # Caddy automatically adds security headers
    # and handles TLS certificate management
}
```

## Docker Deployment with TLS

### Using Nginx Sidecar

```yaml
version: '3.8'

services:
  secan:
    image: secan:latest
    environment:
      - SECAN_SERVER__HOST=0.0.0.0
      - SECAN_SERVER__PORT=9000
    networks:
      - secan-network

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - secan
    networks:
      - secan-network

networks:
  secan-network:
    driver: bridge
```

## Kubernetes Deployment with Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secan-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - secan.example.com
    secretName: secan-tls
  rules:
  - host: secan.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secan-service
            port:
              number: 9000
```

## Security Considerations

### 1. Security Headers

Secan sets the following security headers automatically:
- `Content-Security-Policy`
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Permissions-Policy`

Your reverse proxy should preserve these headers.

### 2. TLS Configuration

Use modern TLS configuration:
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS with preload
- OCSP stapling (if supported)

### 3. Certificate Management

Options for certificate management:
- **Let's Encrypt**: Free, automated certificates (recommended)
- **Commercial CA**: For enterprise requirements
- **Self-signed**: For development/testing only

### 4. Network Security

- Run Secan on localhost (127.0.0.1) if reverse proxy is on same host
- Use internal network if reverse proxy is on different host
- Never expose Secan directly to the internet without TLS

## Configuration Example

### Secan Configuration (config.yaml)

```yaml
server:
  host: "127.0.0.1"  # Only accessible from localhost
  port: 9000

auth:
  mode: local_users
  session_timeout_minutes: 60
  local_users:
    - username: admin
      password_hash: "$2b$12$..."
      roles: ["admin"]

clusters:
  - id: "production"
    name: "Production Cluster"
    nodes:
      - "https://es-node1.internal:9200"
      - "https://es-node2.internal:9200"
    tls:
      verify: true
      ca_cert_file: "/path/to/es-ca.pem"
```

## Testing TLS Setup

### 1. Test TLS Configuration

```bash
# Test TLS handshake
openssl s_client -connect secan.example.com:443 -servername secan.example.com

# Check certificate
curl -vI https://secan.example.com

# Test security headers
curl -I https://secan.example.com
```

### 2. SSL Labs Test

Visit https://www.ssllabs.com/ssltest/ and test your domain for TLS configuration quality.

### 3. Security Headers Test

Visit https://securityheaders.com/ to verify security headers are properly set.

## Troubleshooting

### Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates

# Verify certificate chain
openssl verify -CAfile /path/to/ca.pem /path/to/cert.pem
```

### Connection Issues

```bash
# Test backend directly (should work)
curl http://localhost:9000/health

# Test through reverse proxy (should work with TLS)
curl https://secan.example.com/health
```

### Header Issues

```bash
# Check if security headers are present
curl -I https://secan.example.com | grep -i "strict-transport-security\|content-security-policy\|x-frame-options"
```

## Requirements Validation

This deployment approach validates the following requirements:

- **Requirement 30.1**: HTTPS by default (via reverse proxy)
- **Requirement 30.2**: Secure HTTP headers (set by Secan)
- **Requirement 30.8**: Secure defaults (authentication required, HTTPS recommended)

## Additional Resources

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
