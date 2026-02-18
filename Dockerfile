# Multi-stage Dockerfile for Secan
# Stage 1: Build frontend assets
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files first for better caching
COPY frontend/package*.json ./

# Install dependencies (cached layer)
RUN npm ci --prefer-offline --no-audit

# Copy frontend source
COPY frontend/ ./

# Build frontend assets
RUN npm run build

# Stage 2: Build Rust backend
FROM rust:alpine AS backend-builder

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev

WORKDIR /app

# Copy Cargo files from root (cached layer for dependencies)
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source from root
COPY src ./src

# Copy frontend assets from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Build the backend with embedded frontend
RUN cargo build --release --locked

# Stage 3: Runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 secan && \
    adduser -D -u 1000 -G secan secan

# Create directories
RUN mkdir -p /app /config && \
    chown -R secan:secan /app /config

WORKDIR /app

# Copy binary from builder
COPY --from=backend-builder /app/target/release/secan /app/secan

# Change ownership
RUN chown secan:secan /app/secan

# Switch to non-root user
USER secan

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1

# Set default environment variables
ENV SECAN_SERVER_HOST=0.0.0.0 \
    SECAN_SERVER_PORT=9000 \
    RUST_LOG=info

# Run the application
CMD ["/app/secan"]
