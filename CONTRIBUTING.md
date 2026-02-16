Contributing to Secan
=============================

You can contribute to Secan through code, documentation or bug reports.

## Bug reports

For bug reports, make sure you:
- give enough details regarding your Secan setup
- include versions for Elasticsearch and Secan
- describe steps to reproduce the error, the error itself and expected behaviour

## Pull requests

Before getting started on a pull request (be it a new feature or a bug fix), please open an issue explaining what you would like to achieve and how you would go about this.
Even though we're open to feature requests, we might not always agree on the value a feature might bring. We would hate to waste someone else's time.

Once working on a pull request, please:
- include the generated frontend assets (npm run build)
- add tests that validate your changes
- squash your development commits to keep only important commits (fix typo, wrong indent should not be part of git history)
- rebase it against main/master before submitting
- make sure all tests pass (cargo test / npm test)

## Development

You can run Secan for development using cargo:

```sh
# Terminal 1: Build and watch frontend
cd frontend
npm install
npm run dev

# Terminal 2: Run backend
cd backend
cargo run
```

The frontend dev server runs on http://localhost:5173 and proxies API requests to the backend at http://localhost:8080.

### Backend Development

```sh
cd backend

# Run in development mode
cargo run

# Run with watch mode (requires cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Run tests
cargo test

# Check code quality
cargo clippy
cargo fmt --check
```

### Frontend Development

```sh
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

### Using Task for Automation

Secan uses [Task](https://taskfile.dev) for build automation:

```sh
# Run full development workflow
task dev

# Build frontend and backend
task build-frontend
task build-backend

# Run all tests
task test

# Run linters
task lint

# Clean build artifacts
task clean
```

See [Taskfile.yml](Taskfile.yml) for all available tasks.

## Code Style

### Rust Backend
- Follow standard Rust conventions
- Run `cargo fmt` before committing
- Address all `cargo clippy` warnings
- Use meaningful variable and function names
- Add documentation comments for public APIs

### TypeScript/React Frontend
- Follow TypeScript best practices
- Use functional components with hooks
- Run `npm run lint` before committing
- Use meaningful component and variable names
- Add JSDoc comments for complex functions

## Testing

### Backend Tests
```sh
cd backend
cargo test
cargo test --all-features
```

### Frontend Tests
```sh
cd frontend
npm test
npm run test:coverage
```

## Documentation

When adding new features, please update:
- README.md - if it affects installation or basic usage
- CONFIGURATION.md - if it adds new configuration options
- DOCKER.md - if it affects Docker deployment
- Code comments - for complex logic

## Questions?

Feel free to open an issue for questions or discussions about Secan development.
