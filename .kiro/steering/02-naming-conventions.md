# Naming Conventions and Brand Agnosticism

## Brand-Agnostic Code for Cerebro Rewrite

Whatever project name we settle on, code MUST be written in a way that is **name-agnostic**. The Cerebro rewrite codebase should follow this principle.

### ✅ Allowed Uses of Project Name

- **Documentation**: README, specs, comments, user-facing docs
- **Package/Crate name**: `cerebro` in Cargo.toml, `@cerebro/frontend` in package.json
- **Binary name**: `cerebro` executable
- **Repository name**: GitHub repo name
- **User-facing messages**: CLI help text, startup messages, log messages

### ❌ NOT Allowed in Code

- **Function names**: ❌ `fn cerebro_start()` → ✅ `fn start()`
- **Struct names**: ❌ `struct CerebroServer` → ✅ `struct Server`
- **Variable names**: ❌ `cerebro_config` → ✅ `config`
- **Trait names**: ❌ `CerebroProvider` → ✅ `AuthProvider`
- **Method names**: ❌ `init_cerebro()` → ✅ `init()`
- **Constants**: ❌ `CEREBRO_VERSION` → ✅ `VERSION`
- **Component names**: ❌ `CerebroDashboard` → ✅ `Dashboard`

## Rust Naming Conventions for Cerebro Backend

Follow standard Rust naming conventions:

### Module Names
- Short, lowercase, snake_case
- No unnecessary prefixes
- Examples: `cluster`, `auth`, `session`, `config`
- Current structure: `backend/src/cluster/`, `backend/src/auth/`

### Type Names (Structs, Enums, Traits)
- Use PascalCase for type names
- Examples: `ClusterManager`, `AuthProvider`, `SessionManager`
- Trait names: `AuthProvider`, `CacheInterface`, `ElasticsearchClient`

### Function and Method Names
- Use snake_case for functions and methods
- Examples: `parse_groups`, `validate_config`, `init_provider`

### Constants and Statics
- Use SCREAMING_SNAKE_CASE
- Examples: `DEFAULT_PORT`, `MAX_CONNECTIONS`, `SESSION_TIMEOUT`

### Avoid Stuttering
- ❌ `cluster::ClusterManager` → ✅ `cluster::Manager`
- ❌ `auth::AuthProvider` → ✅ `auth::Provider`
- ❌ `session::SessionManager` → ✅ `session::Manager`

## TypeScript/React Naming Conventions for Cerebro Frontend

Follow standard TypeScript and React conventions:

### Component Names
- Use PascalCase for React components
- Examples: `Dashboard`, `ClusterView`, `RestConsole`
- Not: `CerebroDashboard`, `CerebroClusterView`

### Hook Names
- Start with `use` prefix
- Use camelCase
- Examples: `useTheme`, `usePreferences`, `useClusterHealth`
- Not: `useCerebroTheme`, `useCerebroPreferences`

### Function Names
- Use camelCase for functions
- Examples: `parseRequest`, `validateJson`, `formatBytes`

### Interface and Type Names
- Use PascalCase for interfaces and types
- Examples: `ClusterInfo`, `UserPreferences`, `ApiClient`
- Not: `CerebroClusterInfo`, `CerebroUserPreferences`

### File Names
- Use kebab-case for file names
- Examples: `cluster-view.tsx`, `rest-console.tsx`, `api-client.ts`
- Not: `cerebro-cluster-view.tsx`, `CerebroRestConsole.tsx`

## Examples for Cerebro Rewrite

### ✅ Good - Brand Agnostic (Rust Backend)

```rust
// backend/src/auth/mod.rs
pub trait AuthProvider {
    async fn get_user(&self, ctx: Context, req: &AuthRequest) -> Result<UserInfo>;
    fn provider_type(&self) -> &str;
}

pub struct Factory {
    providers: HashMap<String, Box<dyn AuthProvider>>,
}

impl Factory {
    pub fn create(&self, provider_type: &str, config: Config) -> Result<Box<dyn AuthProvider>> {
        // ...
    }
}
```

### ❌ Bad - Brand Specific (Rust Backend)

```rust
pub trait CerebroAuthProvider {
    async fn get_cerebro_user(&self, ctx: Context, req: &CerebroRequest) -> Result<CerebroUserInfo>;
    fn get_cerebro_type(&self) -> &str;
}

pub struct CerebroProviderFactory {
    cerebro_providers: HashMap<String, Box<dyn CerebroAuthProvider>>,
}
```

### ✅ Good - Brand Agnostic (TypeScript Frontend)

```typescript
// frontend/src/components/Dashboard.tsx
interface ClusterSummary {
  id: string;
  name: string;
  health: 'green' | 'yellow' | 'red';
}

export function Dashboard(): JSX.Element {
  const clusters = useClusters();
  return <ClusterTable clusters={clusters} />;
}

// frontend/src/hooks/useTheme.ts
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context;
}
```

### ❌ Bad - Brand Specific (TypeScript Frontend)

```typescript
interface CerebroClusterSummary {
  cerebroId: string;
  cerebroName: string;
  cerebroHealth: 'green' | 'yellow' | 'red';
}

export function CerebroDashboard(): JSX.Element {
  const cerebroClusters = useCerebroClusters();
  return <CerebroClusterTable clusters={cerebroClusters} />;
}
```

## Cerebro-Specific Naming Guidelines

### Backend (Rust)
- Cluster types: `ClusterManager`, `ClusterConnection`, `ClusterHealth`
- Auth types: `AuthProvider`, `SessionManager`, `AuthUser`
- Config types: `ServerConfig`, `AuthConfig`, `ClusterConfig`
- Not: `CerebroClusterManager`, `CerebroAuthProvider`

### Frontend (TypeScript/React)
- Components: `Dashboard`, `ClusterView`, `RestConsole`, `ThemeProvider`
- Hooks: `useTheme`, `usePreferences`, `useClusters`, `useApiClient`
- Types: `ClusterInfo`, `UserPreferences`, `ApiClient`
- Not: `CerebroDashboard`, `useCerebroTheme`, `CerebroClusterInfo`

## Why This Matters for Cerebro Rewrite

1. **Reusability**: Cerebro code can be forked/reused without renaming everything
2. **Clarity**: Shorter names are easier to read and understand
3. **Language Idioms**: Follows standard Rust and TypeScript conventions
4. **Maintainability**: Less coupling to brand name
5. **Professionalism**: Shows understanding of proper design patterns
6. **Community**: Makes Cerebro more approachable for contributors

## Documentation is Different

In documentation, user-facing messages, and comments, using the project name is fine:

```rust
/// AuthProvider implements the Cerebro authentication provider interface
pub trait AuthProvider {
    // ...
}

fn main() {
    println!("Cerebro - Elasticsearch Web Admin Tool");
    // ...
}
```

```typescript
/**
 * Dashboard component displays all configured Cerebro clusters
 */
export function Dashboard(): JSX.Element {
  // ...
}
```

The key is: **code structure and naming should be generic, documentation can be branded**.