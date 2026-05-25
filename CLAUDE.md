# Claude Code Instructions

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**secan — Templates & Aliases Milestone**

secan is a self-hosted Elasticsearch/OpenSearch cluster management UI built with Rust (Axum) backend and React (Mantine, Tanstack Query) frontend. This milestone completes the `templates-and-aliases` branch: adding full CRUD support for index templates, component templates, and index aliases — the three main cluster-level configuration objects that ES operators manage daily.

**Core Value:** Operators can view, create, edit, and delete index templates, component templates, and aliases through a consistent UI — eliminating the need to drop into curl or Kibana for routine template management.

### Constraints

- **Tech stack**: Must use Mantine 8 components — no new UI libraries beyond approved additions
- **Pattern conformance**: New pages must follow the established page/modal/form patterns in the codebase
- **Branch**: All work stays on `templates-and-aliases` until milestone complete, then PR to main
- **Build gates**: `cargo build` and `npm run build` must pass clean before any commit
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Core Language(s)
- **Rust** (edition 2021, version 0.1.7 binary) — backend server, HTTP API, all business logic (`src/`)
- **TypeScript** 5.7.x — frontend React application (`frontend/src/`)
## Runtime / Platform
- **Tokio** 1.x — async Rust runtime (`features = ["full"]`), used for all I/O and concurrency
- **Node.js** 24 — frontend build toolchain only (not a runtime for production)
- Production binary: native compiled Rust executable, no JVM or interpreter required
- Container runtime: Alpine Linux 3.23 (final image, non-root user `secan`)
## Key Frameworks & Libraries
### Backend (Rust)
- **axum** 0.8 — HTTP web framework with macro-based routing
- **tower** / **tower-http** 0.5/0.6 — middleware stack (CORS, gzip compression, static file serving, request tracing)
- **serde** / **serde_json** / **serde_yaml** 1.x — serialization for all config and API payloads
- **utoipa** 5 — OpenAPI 3.x spec generation (spec written to `openapi.json` during tests)
- **reqwest** 0.13 — HTTP client for Elasticsearch and Prometheus communication (rustls TLS, no OpenSSL at runtime)
- **config** 0.15 — layered configuration loading (YAML + env vars)
- **openidconnect** 4 — OIDC authentication provider
- **ldap3** 0.12 — LDAP/Active Directory authentication
- **jsonwebtoken** 10 — JWT session tokens (rust_crypto backend)
- **bcrypt** 0.19 / **argon2** 0.5 — password hashing for local user auth
- **moka** 0.12 — async LRU+TTL in-memory cache (topology tile caching)
- **dashmap** 6 — concurrent hashmap (CSRF state, JWKS cache)
- **indexmap** 2 — order-preserving map (cluster list preserves config order)
- **tracing** / **tracing-subscriber** 0.1/0.3 — structured logging with JSON output and env-filter
### Frontend (TypeScript/React)
- **React** 19.x — UI framework
- **Vite** 8.x — build tool and dev server
- **Mantine** 8.x — component library (core, form, hooks, notifications, spotlight)
- **@tanstack/react-query** 5.x — server state management and data fetching
- **zustand** 5.x — client-side state management
- **react-router-dom** 7.x — client-side routing
- **@xyflow/react** 12.x — topology graph visualization (node/edge diagrams)
- **@nivo** 0.88 — charting (line, pie, radar, sankey, treemap, waffle)
- **@dagrejs/dagre** 0.8 — graph layout algorithm
- **@monaco-editor/react** 4.6 — embedded code editor
- **axios** 1.7 — HTTP client for API calls
- **framer-motion** 12.x — animations
### Testing
- **Backend:** `cargo test` with `wiremock` 0.6 (HTTP mocking), `proptest` 1 (property-based), `serial_test` 3, `tokio-test` 0.4, `tempfile` 3
- **Frontend:** `vitest` 4.x, `@testing-library/react` 16.x, `msw` 2.x (API mocking), `fast-check` 4.x (property-based)
## Build System
- **Task** (Taskfile.yml) — primary developer task runner for all build, test, lint, and release workflows
- **Cargo** — Rust build, test, and dependency management
- **npm** — frontend build via `npm ci` + `npm run build` (Vite)
- **Docker** multi-stage build — stage 1: Node 24 Alpine (frontend), stage 2: Rust Alpine (backend + embedded frontend), stage 3: Alpine 3.23 runtime
- **cross** — cross-compilation for `aarch64-unknown-linux-gnu` and `aarch64-unknown-linux-musl` targets
- Frontend assets are embedded directly into the Rust binary via `rust-embed` 8 (with gzip compression)
## Package Manager
- **Cargo** — Rust packages; `Cargo.lock` committed (present)
- **npm** — frontend; `frontend/package-lock.json` committed (present)
- `frontend/.npmrc` present for npm configuration
## Configuration Format
- **YAML** — primary application config (`config.yaml`, `config.example.yaml`)
- **Environment variables** — override any config value; prefixed `SECAN_` for app settings, standard `OTEL_` for telemetry, `RUST_LOG` for log level
- **TOML** — Cargo.toml only (not used for runtime config)
- Config loaded via the `config` crate with layered precedence: defaults → YAML file → env vars
## Notable Dependencies
- **rust-embed** 8 with compression — embeds built frontend `dist/` into the Rust binary; means the frontend must be built before `cargo build`
- **opentelemetry** / **opentelemetry-otlp** / **tracing-opentelemetry** 0.29/0.30 — full OTLP trace export pipeline (HTTP protobuf by default, gRPC optional); disabled by default via `OTEL_SDK_DISABLED`
- **metrics-exporter-prometheus** 0.18 — exposes `/metrics` endpoint on `:9090` for Prometheus scraping; metric recording stubs exist but most are unimplemented TODOs
- **rustls** 0.23 / **tokio-rustls** 0.26 — pure-Rust TLS stack; no OpenSSL in production binary
- **Clippy lint:** `unwrap_used = "deny"` enforced across all production code
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Conventions
- `snake_case` for all Rust source files: `cluster_manager.rs`, `rate_limiter.rs`, `app_metrics.rs`
- Test files in `tests/` named descriptively: `health_integration_test.rs`, `topology_concurrency.rs`
- Backup/scratch files present that should be removed: `src/server.rs.bak2`, `src/server.rs.bak3`
- PascalCase for React component files: `ShardGrid.tsx`, `AppShell.tsx`, `MasterIndicator.tsx`
- camelCase for hooks and utilities, kebab-case for stores: `useClusterName.tsx`, `shard-grid-store.ts`
- Test files use `.test.tsx` / `.test.ts` suffix; integration tests: `.integration.test.tsx`
- `snake_case` throughout (enforced by toolchain): `cluster_id`, `session_manager`, `cache_duration`
- Types and enums: PascalCase: `AppError`, `ClusterManager`, `AuthError`, `SessionConfig`
- camelCase for variables/functions, PascalCase for components/types
- `_`-prefixed parameters to suppress unused warnings (enforced by ESLint)
- All public modules in `src/lib.rs` have `///` doc comments
- `mod.rs` used for submodule organisation: `src/routes/mod.rs`, `src/auth/mod.rs`
## Code Style
- `edition = "2021"`, `max_width = 100`, `tab_spaces = 4`, `newline_style = "Unix"`
- `reorder_imports = true`, `reorder_modules = true`
- Clippy with `cargo clippy -- -D warnings` (warnings-as-errors in CI)
- `unwrap_used = "deny"` — `.unwrap()` is forbidden; use `.expect("reason")` or `?`
- `warn-on-all-wildcard-imports = true` via `.clippy.toml`
- `RUSTFLAGS="-D warnings"` set during `task backend:test`
- `semi: true`, `singleQuote: true`, `printWidth: 100`, `tabWidth: 2`, `trailingComma: "es5"`, `arrowParens: "always"`
- ESLint with `--max-warnings 0` enforced in CI
- `@typescript-eslint/no-explicit-any: "error"` — `any` is banned
- `@typescript-eslint/no-unused-vars: ["error", { argsIgnorePattern: "^_" }]`
- react-hooks plugin with recommended rules enabled
## Error Handling
- Central error enum in `src/errors.rs` using `thiserror`
- `AppError` wraps `ClusterError`, `AuthError`, `ConfigError` plus `Validation(String)` and `Internal(String)`
- `From<anyhow::Error> for AppError` converts anyhow errors to `AppError::Internal`
- `AppError` implements `IntoResponse` (axum) — auto-serialised to JSON `{ "error": "...", "message": "..." }`
- Route handlers return `Result<_, AppError>` — `?` propagates errors up through axum
- `anyhow` + `.context("…")` used in `main.rs` for startup (not hot path)
- Custom `ApiClientError` type in `src/types/api.ts`
- 401 errors trigger redirect to login via `ApiClient`
## Logging Patterns
- Structured JSON format via `tracing-subscriber`, env-filter (default `info`)
- Levels used (most → least common): `info`, `debug`, `warn`, `error`
- Structured field syntax: `tracing::warn!(cluster_id = %cluster_id, reason = %e, "message")`
- `#[instrument]` macro on async methods; sensitive fields skipped with `skip(self, body)`
- OpenTelemetry tracing via `tracing-opentelemetry`; OTLP export via `OTEL_*` env vars
- Audit logging via `tracing::info!` in `src/audit.rs` for proxied Elasticsearch calls
## Documentation Style
- All public modules have `///` doc comments explaining purpose and capabilities
- Route handler structs and error enum variants have `///` doc comments on every field/variant
- Module-level rustdoc (`//!`) used in error-heavy files
- Inline `// comments` for non-obvious logic
- `// Safety: ...` comment expected on any `#[allow(clippy::unwrap_used)]` block
- Minimal inline comments; types in `src/types/api.ts` serve as self-documenting API contracts
- No JSDoc/TSDoc style used
## Patterns & Idioms
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Style
## Key Architectural Patterns
- **Layered middleware stack**: compression → CORS → OTel → logging → security → auth → permissions
- **Arc-based shared state**: `Arc<RwLock<T>>` for cluster manager and config, `DashMap` for sessions/JWKS
- **Pluggable auth**: local / OIDC / LDAP backends selected via config
- **TTL caching**: custom `MetadataCache` + `moka` async cache for Elasticsearch metadata
- **ES proxy catch-all**: raw Elasticsearch passthrough route for proxied requests
- **Fan-out concurrency limiting**: semaphores (limit 6 for fan-out, limit 4 for topology)
## Data Flow
## Module Boundaries
- `auth` — local, OIDC, LDAP authentication backends
- `cache` — TTL metadata cache (`MetadataCache`)
- `cluster` — `ClusterManager`, Elasticsearch client pooling
- `config` — config loading and validation (config-first, static cluster list)
- `middleware` — security, CORS, auth, permissions, logging middleware
- `metrics` / `prometheus` / `app_metrics` — metrics collection and exposition
- `routes` — REST API route handlers
- `telemetry` — OTLP proxy endpoint, tracing setup
- `tls` — TLS configuration
- `errors` / `audit` / `assets` — cross-cutting concerns
## Concurrency Model
## Notable Design Decisions
- **Embedded frontend**: React SPA built with Vite and embedded into the binary via `rust-embed` — single-binary deployment
- **No ORM**: direct `reqwest`-based Elasticsearch HTTP calls
- **Dual error strategy**: `thiserror` for typed library errors, `anyhow` for application-level error propagation
- **Config-first architecture**: all clusters defined statically in config, no dynamic registration
- **OTLP proxy**: built-in OpenTelemetry proxy endpoint
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
