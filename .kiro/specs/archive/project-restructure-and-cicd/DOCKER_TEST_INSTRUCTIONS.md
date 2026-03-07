# Docker Build Test Instructions

## Prerequisites

Ensure Colima (or Docker Desktop) is running:

```bash
# Start Colima if not running
colima start

# Verify Docker is accessible
docker ps
```

## Test 1: Build Docker Image

Build the Docker image with the new structure:

```bash
docker build -t secan:test .
```

**Expected Result:**
- Build completes successfully
- All three stages complete (frontend-builder, backend-builder, runtime)
- No errors during frontend build
- No errors during backend build
- Final image is created

**Verification:**
```bash
# Check image was created
docker images | grep secan

# Check image size (should be reasonable, < 100MB for runtime)
docker images secan:test --format "{{.Size}}"
```

## Test 2: Run Container

Run the container and verify the application works:

```bash
# Run container
docker run -d --name secan-test -p 9000:9000 secan:test

# Check container is running
docker ps | grep secan-test

# Check logs
docker logs secan-test
```

**Expected Result:**
- Container starts successfully
- Logs show "Server listening on 0.0.0.0:9000" or similar
- No errors in logs

## Test 3: Verify Frontend Assets

Test that frontend assets are served correctly:

```bash
# Test health endpoint
curl http://localhost:9000/health

# Test frontend is accessible
curl -I http://localhost:9000/

# Open in browser
open http://localhost:9000/
```

**Expected Result:**
- Health endpoint returns 200 OK
- Frontend index.html is served
- Browser shows the Secan UI (login page or dashboard)
- No 404 errors for assets

## Test 4: Multi-Architecture Build (Optional)

Test multi-architecture build if Docker Buildx is available:

```bash
# Set up buildx
docker buildx create --use

# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t secan:multi-arch .
```

**Expected Result:**
- Build succeeds for both amd64 and arm64
- No architecture-specific errors

## Cleanup

After testing, clean up:

```bash
# Stop and remove container
docker stop secan-test
docker rm secan-test

# Remove test image
docker rmi secan:test

# Optional: Stop Colima
colima stop
```

## Verification Checklist

- [ ] Docker image builds successfully
- [ ] Frontend assets are embedded in the binary
- [ ] Container starts without errors
- [ ] Health endpoint responds
- [ ] Frontend UI loads in browser
- [ ] No 404 errors for static assets
- [ ] Image size is reasonable (< 100MB)
- [ ] Container runs as non-root user (secan)

## Troubleshooting

### Build Fails at Frontend Stage
- Ensure `frontend/package.json` and `frontend/package-lock.json` exist
- Check that `npm ci` can install dependencies
- Verify `npm run build` works locally

### Build Fails at Backend Stage
- Ensure `Cargo.toml` and `Cargo.lock` exist at root
- Check that `src/` directory exists at root
- Verify `cargo build --release` works locally
- Ensure `frontend/dist/` exists with built assets

### Container Fails to Start
- Check logs: `docker logs secan-test`
- Verify config.yaml is not required (should use defaults)
- Check port 9000 is not already in use

### Frontend Assets Not Loading
- Verify rust-embed path in `src/assets.rs` is `frontend/dist/`
- Check that frontend build created `frontend/dist/index.html`
- Verify Dockerfile copies frontend assets to correct location

## Notes

- The Dockerfile uses multi-stage builds to minimize final image size
- Dependencies are cached in separate layers for faster rebuilds
- The runtime image uses Alpine Linux for minimal size
- The application runs as a non-root user for security
- Health check is configured for Kubernetes/orchestration compatibility
