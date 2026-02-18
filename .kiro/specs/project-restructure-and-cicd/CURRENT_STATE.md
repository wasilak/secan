# Current State Documentation - Before Restructuring

**Date:** 2026-02-18
**Branch:** main
**Commit:** 9d58610 - docs: update README with Phase 5 UI/UX improvements
**Backup Branch:** backup-before-restructure

## Current Project Structure

```
secan/
├── backend/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── server.rs
│   │   ├── assets.rs
│   │   ├── auth/
│   │   ├── cache/
│   │   ├── cluster/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── tls/
│   ├── assets/          # Built frontend assets
│   ├── tests/
│   ├── examples/
│   ├── docs/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── config.yaml      # Configuration file (to be moved)
│   ├── .clippy.toml
│   └── rustfmt.toml
├── frontend/
│   ├── src/
│   ├── public/
│   ├── node_modules/
│   ├── package.json
│   └── package-lock.json
├── .kiro/
│   ├── specs/
│   └── steering/
├── README.md
├── API.md
├── CONFIGURATION.md
├── CONTRIBUTING.md
├── DOCKER.md
├── SHARD_RELOCATION.md
├── LICENSE (MIT)
├── Dockerfile
├── Taskfile.yml
└── .gitignore
```

## Key Files and Locations

### Backend (Rust)
- **Source Code:** `backend/src/`
- **Build Config:** `backend/Cargo.toml`, `backend/Cargo.lock`
- **Configuration:** `backend/config.yaml`
- **Formatting:** `backend/.clippy.toml`, `backend/rustfmt.toml`
- **Tests:** `backend/tests/`
- **Examples:** `backend/examples/`
- **Docs:** `backend/docs/`

### Frontend (TypeScript/React)
- **Source Code:** `frontend/src/`
- **Build Config:** `frontend/package.json`
- **Built Assets:** `backend/assets/` (embedded by rust-embed)

### Documentation
- Main: `README.md`
- API: `API.md`
- Configuration: `CONFIGURATION.md`
- Contributing: `CONTRIBUTING.md`
- Docker: `DOCKER.md`
- Features: `SHARD_RELOCATION.md`

### License
- Current: MIT License in `LICENSE` file

## Current Build Process

### Backend Build
```bash
cd backend
cargo build --release
```

### Frontend Build
```bash
cd frontend
npm install
npm run build
# Output: backend/assets/
```

### Docker Build
```bash
docker build -t secan .
```

## Current Configuration

### Backend Config Location
- Primary: `backend/config.yaml`
- Loaded by: `backend/src/config/mod.rs`

### Frontend Asset Embedding
- Assets built to: `backend/assets/`
- Embedded via: `rust-embed` in `backend/src/assets.rs`
- Asset path reference: `#[folder = "assets/"]`

## Current Git Ignore Patterns

Key ignored items:
- `/target/`
- `backend/target/`
- `frontend/node_modules/`
- `frontend/dist/`
- `.kiro/`
- `.DS_Store`

## Dependencies

### Backend (Rust)
- Web framework: Axum
- Async runtime: Tokio
- Elasticsearch client: elasticsearch crate
- Asset embedding: rust-embed
- Configuration: config-rs
- Authentication: Custom implementation with OIDC support

### Frontend (TypeScript/React)
- UI Framework: Mantine
- Build tool: Vite
- State management: Zustand, TanStack Query
- Routing: React Router

## Known Issues Before Restructuring

None identified. Project builds and runs successfully in current structure.

## Test Status Before Restructuring

### Backend Tests (Rust)
**Status:** ✅ All tests passing
- Total: 187 tests
- Passed: 187
- Failed: 0
- Command: `cargo test` in backend/
- Duration: ~7.19s

Test breakdown:
- Unit tests: 183 passed
- Integration tests: 4 passed
- Doc tests: 0

### Frontend Tests (TypeScript/React)
**Status:** ✅ All tests passing
- Total: 241 tests
- Passed: 239
- Skipped: 2
- Failed: 0
- Command: `npm test` in frontend/
- Duration: ~3.50s

Test files: 22 passed

Note: React testing warnings about `act()` wrapping are present but don't affect test success. These are common with Mantine UI components.

## Conclusion

Project is in a healthy state with all tests passing. Ready to proceed with restructuring.
