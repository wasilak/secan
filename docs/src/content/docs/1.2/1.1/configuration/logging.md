---
title: Logging Configuration
description: Configure logging levels and output for Secan
slug: 1.2/1.1/configuration/logging
---

## Logging Levels

Secan uses structured logging with configurable verbosity. Control logging via the `RUST_LOG` environment variable.

**Available Levels (from least to most verbose):**

* `error` - Only error messages
* `warn` - Warnings and errors
* `info` - General information, warnings, and errors (default)
* `debug` - Detailed debugging information
* `trace` - Very detailed trace-level information

## Setting Log Level

Set the global log level:

```bash
export RUST_LOG=info
./secan
```

## Module-Specific Logging

Configure different log levels for different modules:

```bash
export RUST_LOG=secan=debug,hyper=info,tokio=warn
./secan
```

This enables:

* `debug` level for secan modules
* `info` level for hyper (HTTP library)
* `warn` level for tokio (async runtime)

## Common Configurations

**Development (detailed debugging):**

```bash
export RUST_LOG=debug
./secan
```

**Production (important events only):**

```bash
export RUST_LOG=info
./secan
```

**Troubleshooting authentication issues:**

```bash
export RUST_LOG=secan::auth=debug
./secan
```

**Troubleshooting cluster connections:**

```bash
export RUST_LOG=secan::cluster=debug,hyper=debug
./secan
```

## Docker Configuration

Set logging level in Docker:

```bash
docker run -d \
  --name secan \
  -p 27182:27182 \
  -e RUST_LOG=info \
  ghcr.io/wasilak/secan:1.1
```

In `docker-compose.yml`:

```yaml
services:
  secan:
    image: ghcr.io/wasilak/secan:1.1
    ports:
      - "27182:27182"
    environment:
      - RUST_LOG=info
```

## Docker Compose Full Example

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
      - RUST_LOG=info
    restart: unless-stopped

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
```

## Viewing Logs

### Running in foreground

See logs directly in terminal:

```bash
RUST_LOG=info ./secan
```

### Docker logs

View logs from a running container:

```bash
docker logs secan
docker logs -f secan  # Follow live logs
```

### System logs

If running as a service, logs may be in system logs:

```bash
journalctl -u secan -f  # systemd
tail -f /var/log/secan.log  # Direct file logging (if configured)
```

## Performance Considerations

**Log Level Impact:**

* `error` - Minimal overhead
* `warn` - Very low overhead
* `info` - Low overhead (recommended for production)
* `debug` - Moderate overhead, suitable for troubleshooting
* `trace` - High overhead, only for deep diagnostics

For production deployments, use `info` level or higher. Use `debug` during troubleshooting and then lower the level again.

## Common Log Messages

**Successful startup:**

```
2024-02-21T10:30:45Z  INFO secan: Starting Secan
2024-02-21T10:30:45Z  INFO secan::cluster: Connected to cluster 'production'
2024-02-21T10:30:45Z  INFO secan: Server listening on 0.0.0.0:27182
```

**Authentication error:**

```
2024-02-21T10:31:00Z  WARN secan::auth: Failed login attempt for user 'admin'
```

**Cluster connection issue:**

```
2024-02-21T10:31:15Z  WARN secan::cluster: Unable to connect to cluster 'staging': Connection timeout
```

## Troubleshooting

**If Secan doesn't start:**

Increase log level to debug:

```bash
RUST_LOG=debug ./secan
```

**If cluster connections fail:**

Enable debug logging for cluster module:

```bash
RUST_LOG=secan::cluster=debug ./secan
```

**If authentication issues occur:**

Enable debug logging for auth module:

```bash
RUST_LOG=secan::auth=debug ./secan
```

## Best Practices

1. **Use info level in production** - Balances visibility and performance
2. **Enable debug during troubleshooting** - Then return to info level
3. **Monitor important events** - Set up alerts for error-level logs
4. **Rotate logs** - Use logrotate or container log drivers for management
5. **Don't enable trace in production** - Reserved for deep debugging only
