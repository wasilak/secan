# Task Completion Requirements

When implementing tasks from Cerebro rewrite specs, you MUST follow these completion criteria:

## Critical Thinking After Implementation

- After completing any task implementation, ALWAYS critically evaluate whether the code is functional or dead code
- Ask yourself: "Is this code actually being used anywhere in the Cerebro application?"
- Verify integration points: Check if the implemented functionality is imported and called
- Search the Cerebro codebase for actual usage of new structs, functions, or modules
- If code is not integrated, identify ALL places where it should be used and integrate it fully
- Don't just implement infrastructure - ensure it's wired into the application flow
- Reference your steering rules to ensure you're following Rust and TypeScript best practices
- Ensure new components are properly registered and can be accessed via the API or UI

## Build Verification for Cerebro Backend (Rust)

- Always run `cargo build` after implementing Rust code changes
- Fix ALL build errors before marking a task as complete
- Address ALL clippy warnings (`cargo clippy`) before marking a task as complete
- Run `cargo fmt` to ensure code formatting is consistent
- A task is NOT complete if the build fails or produces warnings
- Verify that the Cerebro backend binary builds successfully with new changes
- Test that configuration loading works with new settings

## Build Verification for Cerebro Frontend (TypeScript/React)

- Always run `npm run build` or `yarn build` after implementing frontend code changes
- Fix ALL TypeScript compilation errors before marking a task as complete
- Address ALL ESLint warnings before marking a task as complete
- Run `npm run lint` or `yarn lint` to check code quality
- A task is NOT complete if the build fails or produces warnings
- Verify that the frontend builds successfully and assets are generated
- Test that the frontend integrates correctly with the backend API

## Test Verification

### Backend Tests (Rust)
- Run `cargo test` to verify unit tests pass
- Run `cargo test --all-features` to test all feature combinations
- Fix any failing tests before marking task complete
- Add unit tests for new functionality where appropriate
- Test new Elasticsearch client functionality with mock responses
- Verify session management and authentication flows

### Frontend Tests (TypeScript/React)
- Run `npm test` or `yarn test` to verify unit tests pass
- Fix any failing tests before marking task complete
- Add tests for new components and hooks
- Test API client methods with mocked responses
- Verify theme switching and preferences persistence

## Git Commit Requirement

- After each task is successfully implemented and verified, AUTOMATICALLY commit the changes
- Use a descriptive commit message that includes:
  - Type prefix (feat:, fix:, refactor:, test:, docs:, etc.)
  - Brief description of what was implemented
  - Reference to the task number or name
- Stage all relevant files before committing
- Example: `feat: implement cluster manager with connection pooling\n\nTask: 6.3 Implement ClusterManager`
- Commit immediately after verification steps pass, do not wait for user approval

## Verification Steps for Cerebro Backend

1. Implement the Rust code changes
2. Run `cargo fmt` to format code
3. Run `cargo clippy` to check for warnings
4. Run `cargo build` to verify the build succeeds
5. Run `cargo test` to verify tests pass
6. Test configuration loading with new options
7. Verify Cerebro backend starts successfully with new configuration
8. Fix any errors or warnings that appear
9. Re-run build and tests to confirm all issues are resolved
10. Mark the task as complete
11. AUTOMATICALLY commit the changes with a descriptive message

## Verification Steps for Cerebro Frontend

1. Implement the TypeScript/React code changes
2. Run `npm run lint` or `yarn lint` to check code quality
3. Run `npm run build` or `yarn build` to verify the build succeeds
4. Run `npm test` or `yarn test` to verify tests pass
5. Test the UI in development mode (`npm run dev`)
6. Verify API integration works correctly
7. Fix any errors or warnings that appear
8. Re-run build and tests to confirm all issues are resolved
9. Mark the task as complete
10. AUTOMATICALLY commit the changes with a descriptive message

## Cerebro-Specific Integration Points

### Backend Integration
- Ensure new routes integrate with Axum router in `backend/src/main.rs`
- Verify cluster manager integrates with Elasticsearch client
- Test session manager integrates with authentication middleware
- Ensure configuration loading works with `config-rs` and environment variables
- Verify logging integration with `tracing` or `slog`
- Test that embedded frontend assets are served correctly via `rust-embed`

### Frontend Integration
- Ensure new components integrate with React Router
- Verify API client methods are used in components
- Test state management with Zustand or TanStack Query
- Ensure Mantine UI components are styled consistently
- Verify theme provider wraps the application
- Test that preferences are persisted to localStorage

## Why This Matters

- Ensures code integrates properly with the Cerebro rewrite codebase
- Catches Rust compilation errors, TypeScript errors, and configuration problems early
- Maintains production-ready code quality for Cerebro
- Prevents broken builds from being committed
- Creates a clear history of Cerebro development progress
- Makes it easy to track progress and revert changes if needed
- Ensures the single binary distribution works correctly with embedded assets