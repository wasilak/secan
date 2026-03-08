# Design Document: AI Assistant Integration

## Overview

This design document specifies the technical architecture for integrating AI capabilities throughout the Elasticsearch web admin tool (Cerebro). The AI assistant will provide context-aware assistance for cluster management, troubleshooting, and operations by leveraging multiple AI providers through a unified interface.

### Goals

- Provide intelligent, context-aware assistance for Elasticsearch cluster management
- Support multiple AI providers (OpenAI-compatible APIs and Anthropic) through a unified interface
- Embed Elasticsearch knowledge to provide expert-level guidance without hallucinations
- Deliver real-time streaming responses for better user experience
- Maintain comprehensive error handling with transparent error messages from providers
- Enable user personalization for response style and detail level

### Non-Goals

- Per-cluster AI configuration (AI is configured globally)
- Training custom AI models
- Storing conversation history on the server (client-side only)
- Real-time collaboration on AI conversations between users
- AI-driven automated cluster operations without user approval

### Key Design Principles

1. **Context Awareness**: AI prompts automatically include relevant cluster data based on current view
2. **Provider Agnosticism**: Support multiple AI providers through a trait-based abstraction
3. **Graceful Degradation**: Core cluster management functionality works even when AI is unavailable
4. **Transparent Errors**: Display actual provider error messages to users for troubleshooting
5. **Streaming First**: Prioritize streaming responses for better perceived performance
6. **Security**: Sanitize user input to prevent prompt injection attacks

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TypeScript)              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Global Assistant │  │  View Assistant  │                │
│  │   Component      │  │   Component      │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                      │                           │
│           └──────────┬───────────┘                           │
│                      │                                       │
│              ┌───────▼────────┐                             │
│              │  AI API Client │                             │
│              │  (SSE Handler) │                             │
│              └───────┬────────┘                             │
└──────────────────────┼──────────────────────────────────────┘
                       │ HTTP/SSE
┌──────────────────────▼──────────────────────────────────────┐
│                  Backend (Rust/Axum)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              AI Routes (REST + SSE)                    │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────────┐ │
│  │            Context Builder                             │ │
│  │  - View Type Detection                                 │ │
│  │  - Data Extraction & Formatting                        │ │
│  │  - Knowledge Base Integration                          │ │
│  │  - Token Budget Management                             │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────────┐ │
│  │         AI Provider Abstraction (Trait)                │ │
│  └────────┬───────────────────────┬───────────────────────┘ │
│           │                       │                          │
│  ┌────────▼────────┐    ┌────────▼────────┐                │
│  │ OpenAI Client   │    │ Anthropic Client│                │
│  │ (HTTP + SSE)    │    │ (HTTP + SSE)    │                │
│  └────────┬────────┘    └────────┬────────┘                │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
            │ HTTPS                │ HTTPS
            │                      │
┌───────────▼────────┐   ┌─────────▼────────┐
│  OpenAI-Compatible │   │  Anthropic API   │
│  API (GPT, Llama,  │   │  (Claude)        │
│  Mistral, etc.)    │   │                  │
└────────────────────┘   └──────────────────┘
```

### Component Responsibilities

#### Frontend Components

**Global Assistant Component**
- Renders below cluster health bar on all pages
- Displays context-appropriate hint text based on current view
- Handles user input and Magic Wand button clicks
- Manages conversation history in browser state
- Displays streaming responses token-by-token
- Shows error messages with copy functionality

**View Assistant Component**
- Renders within specific views (indices, shards, nodes, tasks)
- Collapsible to save screen space
- Populates with view-specific description requests
- Maintains separate conversation history per view
- Displays example questions as hints

**AI API Client**
- Handles HTTP requests to backend AI endpoints
- Manages SSE connections for streaming responses
- Implements retry logic for failed requests
- Parses and emits tokens as they arrive
- Handles connection interruptions gracefully

#### Backend Components

**AI Routes Module** (`backend/src/ai/routes.rs`)
- `/api/ai/chat` - POST endpoint for AI chat requests with SSE streaming
- `/api/ai/summary` - POST endpoint for generating view summaries
- `/api/ai/status` - GET endpoint for checking AI feature availability
- `/api/ai/stats` - GET endpoint for AI usage statistics

**Context Builder** (`backend/src/ai/context.rs`)
- Identifies current view type from request parameters
- Extracts relevant cluster data based on view
- Queries knowledge base for relevant documentation
- Formats context as structured JSON
- Enforces token budget limits with intelligent truncation
- Selects appropriate prompt templates

**AI Provider Trait** (`backend/src/ai/provider.rs`)
- Defines interface for AI interactions
- `async fn stream_completion(&self, prompt: Prompt) -> Result<Stream<Token>>`
- `async fn complete(&self, prompt: Prompt) -> Result<String>`
- `fn provider_type(&self) -> &str`
- `fn validate_config(&self) -> Result<()>`

**OpenAI Client** (`backend/src/ai/openai.rs`)
- Wraps `async-openai` crate for OpenAI-compatible APIs
- Implements AI Provider trait as adapter
- Supports custom endpoint URLs for local models (Ollama, etc.)
- Leverages built-in SSE streaming from `async-openai`
- Uses built-in retry logic with exponential backoff
- Sanitizes user input before sending

**Anthropic Client** (`backend/src/ai/anthropic.rs`)
- Wraps `anthropic-sdk` crate for Anthropic API
- Implements AI Provider trait as adapter
- Handles Claude-specific message format via SDK
- Leverages built-in streaming support
- Uses SDK's error handling
- Sanitizes user input before sending

**Knowledge Base** (`backend/src/ai/knowledge.rs`)
- Embeds Elasticsearch documentation using `rust-embed`
- Documents stored as markdown files in `knowledge_base/` directory
- Provides keyword-based search (simple and fast)
- Returns relevant excerpts based on context
- Handles multiple Elasticsearch versions

**Knowledge Base Content Strategy:**
1. **Manual Curation**: Extract key sections from official Elasticsearch docs
2. **Markdown Format**: Store as `.md` files with frontmatter metadata
3. **Categories**: Organize by topic (api/, troubleshooting/, best_practices/, etc.)
4. **Versioning**: Tag documents with applicable ES versions (7.x, 8.x, 9.x, all)
5. **Embedding**: Use `rust-embed` to compile docs into binary at build time
6. **Search**: Simple keyword matching with category-based relevance scoring
7. **Future Enhancement**: Could add vector embeddings for semantic search later

**Prompt Template Library** (`backend/src/ai/templates.rs`)
- Stores pre-defined prompt templates for common scenarios
- Supports template selection based on context
- Handles placeholder replacement with dynamic data
- Allows administrator customization via configuration

## Components and Interfaces

### Backend Rust Components

#### Configuration Structure

```rust
// backend/src/config/types.rs

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AiConfig {
    /// Enable or disable AI features globally
    #[serde(default)]
    pub enabled: bool,
    
    /// AI provider configuration
    pub provider: AiProviderConfig,
    
    /// Token budget for requests (prompt + response)
    #[serde(default = "default_token_budget")]
    pub token_budget: usize,
    
    /// Request timeout in seconds
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    
    /// Temperature for AI responses (0.0 - 2.0)
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    
    /// Optional path to custom knowledge base directory
    /// Users can add cluster-specific documentation here
    #[serde(default)]
    pub custom_knowledge_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum AiProviderConfig {
    OpenAiCompatible {
        endpoint: String,
        api_key: String,
        model: String,
    },
    Anthropic {
        api_key: String,
        model: String,
    },
}

fn default_token_budget() -> usize { 4096 }
fn default_timeout() -> u64 { 60 }
fn default_temperature() -> f32 { 0.7 }
```

#### AI Provider Trait

```rust
// backend/src/ai/provider.rs

use async_trait::async_trait;
use futures::Stream;
use anyhow::Result;

/// Represents a single token from the AI provider
#[derive(Debug, Clone)]
pub struct Token {
    pub content: String,
    pub finish_reason: Option<String>,
}

/// Represents a complete AI prompt with context
#[derive(Debug, Clone)]
pub struct Prompt {
    pub system: String,
    pub user_message: String,
    pub context: serde_json::Value,
    pub temperature: f32,
    pub max_tokens: usize,
}

/// Trait for AI provider implementations
#[async_trait]
pub trait Provider: Send + Sync {
    /// Stream completion tokens as they arrive
    async fn stream_completion(
        &self,
        prompt: Prompt,
    ) -> Result<Box<dyn Stream<Item = Result<Token>> + Send + Unpin>>;
    
    /// Get complete response (non-streaming)
    async fn complete(&self, prompt: Prompt) -> Result<String>;
    
    /// Get provider type identifier
    fn provider_type(&self) -> &str;
    
    /// Validate provider configuration
    fn validate_config(&self) -> Result<()>;
    
    /// Test connectivity to provider
    async fn test_connection(&self) -> Result<()>;
}

/// Factory for creating AI providers
pub struct Factory {
    config: AiConfig,
}

impl Factory {
    pub fn new(config: AiConfig) -> Self {
        Self { config }
    }
    
    pub fn create(&self) -> Result<Box<dyn Provider>> {
        match &self.config.provider {
            AiProviderConfig::OpenAiCompatible { .. } => {
                Ok(Box::new(openai::Client::new(self.config.clone())?))
            }
            AiProviderConfig::Anthropic { .. } => {
                Ok(Box::new(anthropic::Client::new(self.config.clone())?))
            }
        }
    }
}
```

#### Context Builder

```rust
// backend/src/ai/context.rs

use serde::{Deserialize, Serialize};
use anyhow::Result;

/// Represents the current view context
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "view_type", rename_all = "snake_case")]
pub enum ViewContext {
    Dashboard {
        cluster_id: String,
        cluster_health: serde_json::Value,
        cluster_stats: serde_json::Value,
    },
    Indices {
        cluster_id: String,
        indices: Vec<serde_json::Value>,
        filters: Option<IndexFilters>,
        grouping: Option<String>,
    },
    Shards {
        cluster_id: String,
        shards: Vec<serde_json::Value>,
        filters: Option<ShardFilters>,
    },
    Nodes {
        cluster_id: String,
        nodes: Vec<serde_json::Value>,
        filters: Option<NodeFilters>,
    },
    Tasks {
        cluster_id: String,
        tasks: Vec<serde_json::Value>,
        filters: Option<TaskFilters>,
    },
}

#[derive(Debug, Clone, Deserialize)]
pub struct IndexFilters {
    pub status: Option<String>,
    pub name_pattern: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShardFilters {
    pub state: Option<String>,
    pub index: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NodeFilters {
    pub role: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TaskFilters {
    pub action: Option<String>,
}

/// User preferences for AI responses
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UserPreferences {
    pub verbosity: Verbosity,
    pub format: ResponseFormat,
    pub include_code_examples: bool,
    pub include_doc_links: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Verbosity {
    Concise,
    Normal,
    Detailed,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ResponseFormat {
    PlainText,
    Markdown,
    Structured,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            verbosity: Verbosity::Normal,
            format: ResponseFormat::Markdown,
            include_code_examples: true,
            include_doc_links: true,
        }
    }
}

/// Builds context-aware prompts
pub struct Builder {
    knowledge_base: knowledge::Base,
    templates: templates::Library,
    token_budget: usize,
}

impl Builder {
    pub fn new(
        knowledge_base: knowledge::Base,
        templates: templates::Library,
        token_budget: usize,
    ) -> Self {
        Self {
            knowledge_base,
            templates,
            token_budget,
        }
    }
    
    /// Build a prompt from user message and view context
    pub async fn build_prompt(
        &self,
        user_message: &str,
        view_context: ViewContext,
        preferences: UserPreferences,
    ) -> Result<Prompt> {
        // 1. Identify view type and extract relevant data
        let view_type = self.identify_view_type(&view_context);
        let cluster_id = self.extract_cluster_id(&view_context);
        
        // 2. Query knowledge base for relevant documentation
        // Pass cluster_id to prioritize cluster-specific custom docs
        let kb_excerpts = self.knowledge_base
            .search(&user_message, &view_type, cluster_id.as_deref(), 3)
            .await?;
        
        // 3. Select appropriate prompt template
        let template = self.templates
            .select_template(&user_message, &view_type)?;
        
        // 4. Format context data
        let context_data = self.format_context(&view_context)?;
        
        // 5. Build system prompt with preferences
        let system_prompt = self.build_system_prompt(
            &template,
            &kb_excerpts,
            &preferences,
        )?;
        
        // 6. Enforce token budget
        let (final_system, final_context) = self.enforce_token_budget(
            system_prompt,
            context_data,
            user_message,
        )?;
        
        Ok(Prompt {
            system: final_system,
            user_message: user_message.to_string(),
            context: final_context,
            temperature: 0.7,
            max_tokens: self.token_budget / 2, // Reserve half for response
        })
    }
    
    fn identify_view_type(&self, context: &ViewContext) -> &str {
        match context {
            ViewContext::Dashboard { .. } => "dashboard",
            ViewContext::Indices { .. } => "indices",
            ViewContext::Shards { .. } => "shards",
            ViewContext::Nodes { .. } => "nodes",
            ViewContext::Tasks { .. } => "tasks",
        }
    }
    
    fn extract_cluster_id(&self, context: &ViewContext) -> Option<String> {
        match context {
            ViewContext::Dashboard { cluster_id, .. } => Some(cluster_id.clone()),
            ViewContext::Indices { cluster_id, .. } => Some(cluster_id.clone()),
            ViewContext::Shards { cluster_id, .. } => Some(cluster_id.clone()),
            ViewContext::Nodes { cluster_id, .. } => Some(cluster_id.clone()),
            ViewContext::Tasks { cluster_id, .. } => Some(cluster_id.clone()),
        }
    }
    
    fn format_context(&self, context: &ViewContext) -> Result<serde_json::Value> {
        // Format context as structured JSON
        Ok(serde_json::to_value(context)?)
    }
    
    fn build_system_prompt(
        &self,
        template: &str,
        kb_excerpts: &[String],
        preferences: &UserPreferences,
    ) -> Result<String> {
        let mut prompt = template.to_string();
        
        // Add knowledge base excerpts
        if !kb_excerpts.is_empty() {
            prompt.push_str("\n\n## Elasticsearch Documentation\n\n");
            for excerpt in kb_excerpts {
                prompt.push_str(excerpt);
                prompt.push_str("\n\n");
            }
        }
        
        // Add user preferences
        prompt.push_str(&format!(
            "\n\n## Response Guidelines\n\n\
             - Verbosity: {:?}\n\
             - Format: {:?}\n\
             - Include code examples: {}\n\
             - Include documentation links: {}\n",
            preferences.verbosity,
            preferences.format,
            preferences.include_code_examples,
            preferences.include_doc_links,
        ));
        
        Ok(prompt)
    }
    
    fn enforce_token_budget(
        &self,
        system: String,
        context: serde_json::Value,
        user_message: &str,
    ) -> Result<(String, serde_json::Value)> {
        // Estimate token count (rough approximation: 1 token ≈ 4 chars)
        let estimate_tokens = |s: &str| s.len() / 4;
        
        let system_tokens = estimate_tokens(&system);
        let user_tokens = estimate_tokens(user_message);
        let context_str = serde_json::to_string(&context)?;
        let context_tokens = estimate_tokens(&context_str);
        
        let total_tokens = system_tokens + user_tokens + context_tokens;
        let max_prompt_tokens = self.token_budget / 2; // Reserve half for response
        
        if total_tokens <= max_prompt_tokens {
            return Ok((system, context));
        }
        
        // Truncate context to fit budget
        // Priority: system prompt > user message > context
        let available_for_context = max_prompt_tokens
            .saturating_sub(system_tokens)
            .saturating_sub(user_tokens);
        
        let truncated_context = self.truncate_context(
            context,
            available_for_context * 4, // Convert back to chars
        )?;
        
        Ok((system, truncated_context))
    }
    
    fn truncate_context(
        &self,
        context: serde_json::Value,
        max_chars: usize,
    ) -> Result<serde_json::Value> {
        // Implement intelligent truncation based on view type
        // Keep most important fields, truncate arrays, etc.
        // This is a simplified version
        let context_str = serde_json::to_string(&context)?;
        if context_str.len() <= max_chars {
            return Ok(context);
        }
        
        // Truncate and add indicator
        let truncated = format!(
            "{}... [truncated to fit token budget]",
            &context_str[..max_chars.saturating_sub(50)]
        );
        
        Ok(serde_json::json!({
            "truncated": true,
            "data": truncated
        }))
    }
}
```


#### Knowledge Base

```rust
// backend/src/ai/knowledge.rs

use rust_embed::RustEmbed;
use anyhow::Result;

#[derive(RustEmbed)]
#[folder = "knowledge_base/"]
struct EmbeddedDocs;

/// Elasticsearch knowledge base
pub struct Base {
    /// In-memory index for fast lookup
    index: Vec<Document>,
    /// Optional path to custom knowledge base directory
    custom_knowledge_path: Option<PathBuf>,
}

#[derive(Debug, Clone)]
struct Document {
    id: String,
    title: String,
    content: String,
    version: String, // "7.x", "8.x", "9.x", "all"
    category: Category,
    keywords: Vec<String>,
    source: DocumentSource,
    cluster_id: Option<String>, // For cluster-specific custom docs
}

#[derive(Debug, Clone)]
enum DocumentSource {
    BuiltIn,
    CustomGeneral,
    CustomClusterSpecific,
}

#[derive(Debug, Clone)]
enum Category {
    Api,
    BestPractices,
    Troubleshooting,
    IndexManagement,
    ClusterHealth,
    Performance,
}

impl Base {
    pub fn new(custom_knowledge_path: Option<PathBuf>) -> Result<Self> {
        let mut index = Vec::new();
        
        // Load embedded documentation
        for file in EmbeddedDocs::iter() {
            let content = EmbeddedDocs::get(&file)
                .ok_or_else(|| anyhow::anyhow!("Failed to load {}", file))?;
            
            let mut doc = Self::parse_document(&file, &content.data)?;
            doc.source = DocumentSource::BuiltIn;
            index.push(doc);
        }
        
        // Load custom documentation if path is configured
        if let Some(ref path) = custom_knowledge_path {
            Self::load_custom_docs(&mut index, path)?;
        }
        
        Ok(Self { 
            index,
            custom_knowledge_path,
        })
    }
    
    /// Load custom documentation from filesystem
    fn load_custom_docs(index: &mut Vec<Document>, base_path: &Path) -> Result<()> {
        if !base_path.exists() {
            tracing::warn!(
                path = %base_path.display(),
                "Custom knowledge base path does not exist, skipping"
            );
            return Ok(());
        }
        
        // Walk the custom knowledge directory
        for entry in std::fs::read_dir(base_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                // Check if this is a cluster ID folder
                let folder_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                
                // Load cluster-specific docs
                Self::load_cluster_docs(index, &path, folder_name)?;
            } else if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                // Load general custom doc
                let content = std::fs::read(&path)?;
                let filename = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown");
                
                let mut doc = Self::parse_document(filename, &content)?;
                doc.source = DocumentSource::CustomGeneral;
                doc.cluster_id = None;
                index.push(doc);
            }
        }
        
        Ok(())
    }
    
    /// Load cluster-specific documentation
    fn load_cluster_docs(index: &mut Vec<Document>, cluster_path: &Path, cluster_id: &str) -> Result<()> {
        for entry in std::fs::read_dir(cluster_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                let content = std::fs::read(&path)?;
                let filename = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown");
                
                let mut doc = Self::parse_document(filename, &content)?;
                doc.source = DocumentSource::CustomClusterSpecific;
                doc.cluster_id = Some(cluster_id.to_string());
                index.push(doc);
            }
        }
        
        Ok(())
    }
    
    /// Search for relevant documentation
    /// If cluster_id is provided, prioritizes cluster-specific custom docs
    pub async fn search(
        &self,
        query: &str,
        view_type: &str,
        cluster_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<String>> {
        // Simple keyword-based search
        // In production, could use more sophisticated semantic search
        let query_lower = query.to_lowercase();
        let keywords: Vec<&str> = query_lower.split_whitespace().collect();
        
        let mut scored_docs: Vec<(f32, &Document)> = self.index
            .iter()
            .map(|doc| {
                let score = Self::score_document(doc, &keywords, view_type, cluster_id);
                (score, doc)
            })
            .filter(|(score, _)| *score > 0.0)
            .collect();
        
        scored_docs.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        
        Ok(scored_docs
            .into_iter()
            .take(limit)
            .map(|(_, doc)| doc.content.clone())
            .collect())
    }
    
    fn score_document(doc: &Document, keywords: &[&str], view_type: &str, cluster_id: Option<&str>) -> f32 {
        let mut score = 0.0;
        
        // Keyword matching
        for keyword in keywords {
            if doc.title.to_lowercase().contains(keyword) {
                score += 2.0;
            }
            if doc.content.to_lowercase().contains(keyword) {
                score += 1.0;
            }
            if doc.keywords.iter().any(|k| k.contains(keyword)) {
                score += 1.5;
            }
        }
        
        // Category relevance boost
        let category_match = match view_type {
            "dashboard" => matches!(doc.category, Category::ClusterHealth),
            "indices" => matches!(doc.category, Category::IndexManagement),
            "shards" => matches!(doc.category, Category::ClusterHealth),
            "nodes" => matches!(doc.category, Category::Performance),
            "tasks" => matches!(doc.category, Category::Performance),
            _ => false,
        };
        
        if category_match {
            score *= 1.5;
        }
        
        // Prioritize documentation by source
        // Cluster-specific custom docs > General custom docs > Built-in docs
        match (&doc.source, &doc.cluster_id, cluster_id) {
            // Cluster-specific doc for the current cluster - highest priority
            (DocumentSource::CustomClusterSpecific, Some(doc_cluster), Some(current_cluster)) 
                if doc_cluster == current_cluster => {
                score *= 3.0;
            }
            // General custom doc - medium priority
            (DocumentSource::CustomGeneral, _, _) => {
                score *= 2.0;
            }
            // Built-in doc - base priority (no multiplier)
            (DocumentSource::BuiltIn, _, _) => {
                // No multiplier - base score
            }
            // Cluster-specific doc for different cluster - lower priority
            (DocumentSource::CustomClusterSpecific, _, _) => {
                score *= 0.5;
            }
        }
        
        score
    }
    
    fn parse_document(filename: &str, content: &[u8]) -> Result<Document> {
        // Parse markdown or JSON document format
        // This is simplified - actual implementation would parse frontmatter
        let content_str = String::from_utf8(content.to_vec())?;
        
        Ok(Document {
            id: filename.to_string(),
            title: filename.to_string(),
            content: content_str,
            version: "all".to_string(),
            category: Category::Api,
            keywords: vec![],
        })
    }
}
```

#### Prompt Template Library

```rust
// backend/src/ai/templates.rs

use std::collections::HashMap;
use anyhow::Result;

pub struct Library {
    templates: HashMap<String, String>,
}

impl Library {
    pub fn new() -> Self {
        let mut templates = HashMap::new();
        
        // Dashboard template
        templates.insert(
            "dashboard".to_string(),
            include_str!("templates/dashboard.txt").to_string(),
        );
        
        // Indices template
        templates.insert(
            "indices".to_string(),
            include_str!("templates/indices.txt").to_string(),
        );
        
        // Shards template
        templates.insert(
            "shards".to_string(),
            include_str!("templates/shards.txt").to_string(),
        );
        
        // Nodes template
        templates.insert(
            "nodes".to_string(),
            include_str!("templates/nodes.txt").to_string(),
        );
        
        // Tasks template
        templates.insert(
            "tasks".to_string(),
            include_str!("templates/tasks.txt").to_string(),
        );
        
        Self { templates }
    }
    
    pub fn select_template(
        &self,
        user_message: &str,
        view_type: &str,
    ) -> Result<String> {
        // Select template based on view type
        // Could be enhanced with keyword matching for more specific templates
        self.templates
            .get(view_type)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("No template for view type: {}", view_type))
    }
    
    pub fn load_custom_templates(&mut self, custom: HashMap<String, String>) {
        self.templates.extend(custom);
    }
}
```

Example template file (`backend/src/ai/templates/dashboard.txt`):

```
You are an expert Elasticsearch administrator assistant. You are helping a user understand their Elasticsearch cluster's health and status.

The user is currently viewing the cluster dashboard, which shows overall cluster health metrics, node count, index count, and other high-level statistics.

Your role is to:
- Analyze cluster health status and explain any issues
- Identify potential problems or anomalies
- Provide actionable recommendations for improving cluster health
- Explain Elasticsearch concepts in clear, practical terms
- Reference official Elasticsearch documentation when appropriate

When analyzing cluster health:
- Green status means all primary and replica shards are allocated
- Yellow status means all primary shards are allocated but some replicas are not
- Red status means some primary shards are not allocated (data loss risk)

Be concise but thorough. Focus on actionable insights.
```

#### AI Routes

```rust
// backend/src/ai/routes.rs

use axum::{
    extract::{State, Json},
    response::{sse::{Event, Sse}, IntoResponse},
    http::StatusCode,
};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;

#[derive(Clone)]
pub struct AiState {
    provider: Arc<Box<dyn provider::Provider>>,
    context_builder: Arc<context::Builder>,
    enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    message: String,
    view_context: context::ViewContext,
    #[serde(default)]
    preferences: context::UserPreferences,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    response: String,
}

#[derive(Debug, Serialize)]
pub struct StatusResponse {
    enabled: bool,
    provider_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    error: String,
    details: Option<String>,
}

/// POST /api/ai/chat - Stream AI chat response
pub async fn chat_stream(
    State(state): State<AiState>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, Json<ErrorResponse>)> {
    if !state.enabled {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "AI features are disabled".to_string(),
                details: Some("Check server configuration".to_string()),
            }),
        ));
    }
    
    // Sanitize user input
    let sanitized_message = sanitize_input(&req.message);
    
    // Build prompt with context
    let prompt = state.context_builder
        .build_prompt(&sanitized_message, req.view_context, req.preferences)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to build prompt".to_string(),
                    details: Some(e.to_string()),
                }),
            )
        })?;
    
    // Stream completion from provider
    let token_stream = state.provider
        .stream_completion(prompt)
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "AI provider error".to_string(),
                    details: Some(e.to_string()),
                }),
            )
        })?;
    
    // Convert token stream to SSE events
    let event_stream = token_stream.map(|result| {
        match result {
            Ok(token) => {
                let data = serde_json::json!({
                    "content": token.content,
                    "finish_reason": token.finish_reason,
                });
                Ok(Event::default().data(data.to_string()))
            }
            Err(e) => {
                let error_data = serde_json::json!({
                    "error": e.to_string(),
                });
                Ok(Event::default().event("error").data(error_data.to_string()))
            }
        }
    });
    
    Ok(Sse::new(event_stream))
}

/// POST /api/ai/summary - Generate view summary
pub async fn generate_summary(
    State(state): State<AiState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, (StatusCode, Json<ErrorResponse>)> {
    if !state.enabled {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "AI features are disabled".to_string(),
                details: None,
            }),
        ));
    }
    
    // Build summary prompt
    let summary_message = format!(
        "Provide a concise summary of the current view. {}",
        req.message
    );
    
    let prompt = state.context_builder
        .build_prompt(&summary_message, req.view_context, req.preferences)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to build prompt".to_string(),
                    details: Some(e.to_string()),
                }),
            )
        })?;
    
    // Get complete response
    let response = state.provider
        .complete(prompt)
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: "AI provider error".to_string(),
                    details: Some(e.to_string()),
                }),
            )
        })?;
    
    Ok(Json(ChatResponse { response }))
}

/// GET /api/ai/status - Check AI feature availability
pub async fn status(
    State(state): State<AiState>,
) -> Json<StatusResponse> {
    Json(StatusResponse {
        enabled: state.enabled,
        provider_type: if state.enabled {
            Some(state.provider.provider_type().to_string())
        } else {
            None
        },
    })
}

/// Sanitize user input to prevent prompt injection
fn sanitize_input(input: &str) -> String {
    // Remove potential prompt injection patterns
    input
        .replace("</s>", "")
        .replace("<|im_end|>", "")
        .replace("<|endoftext|>", "")
        .replace("###", "")
        .trim()
        .to_string()
}

pub fn routes() -> axum::Router<AiState> {
    axum::Router::new()
        .route("/chat", axum::routing::post(chat_stream))
        .route("/summary", axum::routing::post(generate_summary))
        .route("/status", axum::routing::get(status))
}
```

### Frontend TypeScript Components

#### AI API Client

```typescript
// frontend/src/api/ai-client.ts

export interface ChatRequest {
  message: string;
  viewContext: ViewContext;
  preferences?: UserPreferences;
}

export interface ViewContext {
  clusterId: string;
  viewType: 'dashboard' | 'indices' | 'shards' | 'nodes' | 'tasks';
  data: any;
  filters?: any;
  grouping?: string;
}

export interface UserPreferences {
  verbosity: 'concise' | 'normal' | 'detailed';
  format: 'plain_text' | 'markdown' | 'structured';
  includeCodeExamples: boolean;
  includeDocLinks: boolean;
}

export interface Token {
  content: string;
  finishReason?: string;
}

export interface AiStatus {
  enabled: boolean;
  providerType?: string;
}

export class AiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = '/api/ai') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Stream chat response with SSE
   */
  async *streamChat(request: ChatRequest): AsyncGenerator<Token, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI request failed');
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const token = JSON.parse(data);
              if (token.error) {
                throw new Error(token.error);
              }
              yield token as Token;
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * Generate view summary (non-streaming)
   */
  async generateSummary(request: ChatRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Summary generation failed');
    }
    
    const data = await response.json();
    return data.response;
  }
  
  /**
   * Check AI feature availability
   */
  async getStatus(): Promise<AiStatus> {
    const response = await fetch(`${this.baseUrl}/status`);
    
    if (!response.ok) {
      throw new Error('Failed to check AI status');
    }
    
    return response.json();
  }
}
```

#### Global Assistant Component

```typescript
// frontend/src/components/GlobalAssistant.tsx

import React, { useState, useEffect, useRef } from 'react';
import { Textarea, Button, Stack, Text, ActionIcon, Loader } from '@mantine/core';
import { IconWand, IconX, IconCopy } from '@tabler/icons-react';
import { AiClient, ViewContext, Token } from '../api/ai-client';
import { useViewContext } from '../hooks/useViewContext';
import { useAiPreferences } from '../hooks/useAiPreferences';

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export function GlobalAssistant(): JSX.Element | null {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  
  const viewContext = useViewContext();
  const preferences = useAiPreferences();
  const aiClient = useRef(new AiClient());
  const abortController = useRef<AbortController | null>(null);
  
  // Check AI availability on mount
  useEffect(() => {
    aiClient.current.getStatus().then(status => {
      setAiEnabled(status.enabled);
    }).catch(() => {
      setAiEnabled(false);
    });
  }, []);
  
  // Update hint text based on view
  useEffect(() => {
    if (messages.length === 0) {
      setInput(getHintText(viewContext.viewType));
    }
  }, [viewContext.viewType, messages.length]);
  
  if (!aiEnabled) {
    return null;
  }
  
  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // Add user message to history
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Start streaming
    setIsStreaming(true);
    abortController.current = new AbortController();
    
    let assistantMessage = '';
    
    try {
      const stream = aiClient.current.streamChat({
        message: userMessage,
        viewContext,
        preferences,
      });
      
      for await (const token of stream) {
        assistantMessage += token.content;
        
        // Update assistant message in real-time
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { role: 'assistant', content: assistantMessage },
            ];
          } else {
            return [...prev, { role: 'assistant', content: assistantMessage }];
          }
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'error', content: errorMessage }]);
    } finally {
      setIsStreaming(false);
      abortController.current = null;
    }
  };
  
  const handleStop = () => {
    abortController.current?.abort();
    setIsStreaming(false);
  };
  
  const handleClear = () => {
    setMessages([]);
    setError(null);
    setInput(getHintText(viewContext.viewType));
  };
  
  const handleCopyError = () => {
    if (error) {
      navigator.clipboard.writeText(error);
    }
  };
  
  return (
    <Stack spacing="sm" style={{ padding: '1rem', borderTop: '1px solid #e0e0e0' }}>
      {messages.length > 0 && (
        <Stack spacing="xs" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} />
          ))}
        </Stack>
      )}
      
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={getHintText(viewContext.viewType)}
          minRows={2}
          maxRows={4}
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {isStreaming ? (
            <Button
              onClick={handleStop}
              color="red"
              leftIcon={<IconX size={16} />}
            >
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!input.trim()}
              leftIcon={<IconWand size={16} />}
            >
              Ask
            </Button>
          )}
          
          {messages.length > 0 && (
            <Button
              onClick={handleClear}
              variant="subtle"
              size="sm"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Text color="red" size="sm">{error}</Text>
          <ActionIcon onClick={handleCopyError} size="sm">
            <IconCopy size={14} />
          </ActionIcon>
        </div>
      )}
      
      {isStreaming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Loader size="sm" />
          <Text size="sm" color="dimmed">Thinking...</Text>
        </div>
      )}
    </Stack>
  );
}

function MessageBubble({ message }: { message: Message }): JSX.Element {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        backgroundColor: isError ? '#fee' : isUser ? '#e3f2fd' : '#f5f5f5',
        color: isError ? '#c00' : '#000',
      }}
    >
      <Text size="sm">{message.content}</Text>
    </div>
  );
}

function getHintText(viewType: string): string {
  switch (viewType) {
    case 'dashboard':
      return "Describe this cluster's health and any issues...";
    case 'indices':
      return "Summarize these indices and highlight any issues...";
    case 'shards':
      return "Explain the shard allocation status...";
    case 'nodes':
      return "Analyze these nodes and their resource usage...";
    case 'tasks':
      return "Summarize the running tasks...";
    default:
      return "Ask me anything about your Elasticsearch cluster...";
  }
}
```


#### View Assistant Component

```typescript
// frontend/src/components/ViewAssistant.tsx

import React, { useState } from 'react';
import { Collapse, Textarea, Button, Stack, Text } from '@mantine/core';
import { IconWand, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { AiClient, ViewContext } from '../api/ai-client';
import { useAiPreferences } from '../hooks/useAiPreferences';

interface ViewAssistantProps {
  viewContext: ViewContext;
  defaultPrompt?: string;
}

export function ViewAssistant({ viewContext, defaultPrompt }: ViewAssistantProps): JSX.Element {
  const [opened, setOpened] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const preferences = useAiPreferences();
  const aiClient = new AiClient();
  
  const handleMagicWand = () => {
    const prompt = defaultPrompt || getDefaultPrompt(viewContext);
    setInput(prompt);
    setOpened(true);
    // Focus textarea after state update
    setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('.view-assistant-input')?.focus();
    }, 100);
  };
  
  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);
    
    let assistantMessage = '';
    
    try {
      const stream = aiClient.streamChat({
        message: userMessage,
        viewContext,
        preferences,
      });
      
      for await (const token of stream) {
        assistantMessage += token.content;
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { role: 'assistant', content: assistantMessage },
            ];
          } else {
            return [...prev, { role: 'assistant', content: assistantMessage }];
          }
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, { role: 'error', content: errorMessage }]);
    } finally {
      setIsStreaming(false);
    }
  };
  
  return (
    <Stack spacing="sm">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="subtle"
          leftIcon={<IconWand size={16} />}
          onClick={handleMagicWand}
        >
          AI Summary
        </Button>
        
        <Button
          variant="subtle"
          size="xs"
          rightIcon={opened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          onClick={() => setOpened(!opened)}
        >
          {opened ? 'Hide' : 'Show'} AI Assistant
        </Button>
      </div>
      
      <Collapse in={opened}>
        <Stack spacing="sm">
          {messages.length > 0 && (
            <Stack spacing="xs" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                  }}
                >
                  <Text size="sm">{msg.content}</Text>
                </div>
              ))}
            </Stack>
          )}
          
          <Textarea
            className="view-assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={getPlaceholder(viewContext.viewType)}
            minRows={2}
          />
          
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            loading={isStreaming}
          >
            Ask
          </Button>
        </Stack>
      </Collapse>
    </Stack>
  );
}

function getDefaultPrompt(context: ViewContext): string {
  const hasFilters = context.filters && Object.keys(context.filters).length > 0;
  const hasGrouping = !!context.grouping;
  
  let prompt = '';
  
  switch (context.viewType) {
    case 'indices':
      prompt = hasFilters
        ? 'Describe these filtered indices and highlight any issues...'
        : 'Summarize these indices and highlight any issues...';
      if (hasGrouping) {
        prompt = `Summarize indices grouped by ${context.grouping}...`;
      }
      break;
    case 'shards':
      prompt = hasFilters
        ? 'Explain the shard allocation status for these filtered shards...'
        : 'Explain the shard allocation status...';
      break;
    case 'nodes':
      prompt = 'Analyze these nodes and their resource usage...';
      break;
    case 'tasks':
      prompt = 'Summarize the running tasks and identify any long-running operations...';
      break;
    default:
      prompt = 'Describe what you see in this view...';
  }
  
  return prompt;
}

function getPlaceholder(viewType: string): string {
  switch (viewType) {
    case 'indices':
      return 'Ask about these indices... (e.g., "Why is index X red?")';
    case 'shards':
      return 'Ask about shard allocation... (e.g., "Why are shards unassigned?")';
    case 'nodes':
      return 'Ask about nodes... (e.g., "Compare node A and node B")';
    case 'tasks':
      return 'Ask about tasks... (e.g., "Why is this task taking so long?")';
    default:
      return 'Ask a question about this view...';
  }
}
```

#### Custom Hooks

```typescript
// frontend/src/hooks/useViewContext.ts

import { useLocation } from 'react-router-dom';
import { ViewContext } from '../api/ai-client';
import { useClusterData } from './useClusterData';

export function useViewContext(): ViewContext {
  const location = useLocation();
  const clusterData = useClusterData();
  
  // Determine view type from route
  const viewType = getViewTypeFromPath(location.pathname);
  
  // Extract cluster ID from route or cluster data
  // Cluster ID is stable (from config), cluster name is just an alias
  const clusterId = extractClusterId(location.pathname, clusterData);
  
  // Extract relevant data based on view type
  const data = extractViewData(viewType, clusterData);
  
  // Extract filters and grouping from URL params
  const params = new URLSearchParams(location.search);
  const filters = extractFilters(params);
  const grouping = params.get('groupBy') || undefined;
  
  return {
    clusterId,
    viewType,
    data,
    filters,
    grouping,
  };
}

function extractClusterId(path: string, clusterData: any): string {
  // Extract cluster ID from URL path (e.g., /cluster/prod-search-01/indices)
  const match = path.match(/\/cluster\/([^\/]+)/);
  if (match) {
    return match[1];
  }
  
  // Fallback to cluster data if available
  return clusterData?.clusterId || 'unknown';
}

function getViewTypeFromPath(path: string): ViewContext['viewType'] {
  if (path.includes('/indices')) return 'indices';
  if (path.includes('/shards')) return 'shards';
  if (path.includes('/nodes')) return 'nodes';
  if (path.includes('/tasks')) return 'tasks';
  return 'dashboard';
}

function extractViewData(viewType: string, clusterData: any): any {
  switch (viewType) {
    case 'dashboard':
      return {
        clusterHealth: clusterData.health,
        clusterStats: clusterData.stats,
      };
    case 'indices':
      return clusterData.indices || [];
    case 'shards':
      return clusterData.shards || [];
    case 'nodes':
      return clusterData.nodes || [];
    case 'tasks':
      return clusterData.tasks || [];
    default:
      return {};
  }
}

function extractFilters(params: URLSearchParams): any {
  const filters: any = {};
  
  for (const [key, value] of params.entries()) {
    if (key.startsWith('filter_')) {
      const filterName = key.replace('filter_', '');
      filters[filterName] = value;
    }
  }
  
  return Object.keys(filters).length > 0 ? filters : undefined;
}
```

```typescript
// frontend/src/hooks/useAiPreferences.ts

import { useState, useEffect } from 'react';
import { UserPreferences } from '../api/ai-client';

const STORAGE_KEY = 'ai_preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  verbosity: 'normal',
  format: 'markdown',
  includeCodeExamples: true,
  includeDocLinks: true,
};

export function useAiPreferences(): UserPreferences {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  
  useEffect(() => {
    // Load preferences from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse AI preferences:', e);
      }
    }
  }, []);
  
  return preferences;
}

export function updateAiPreferences(preferences: Partial<UserPreferences>): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const current = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
  const updated = { ...current, ...preferences };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  
  // Dispatch event to notify other components
  window.dispatchEvent(new CustomEvent('ai-preferences-updated', { detail: updated }));
}
```

## Data Models

### Configuration Schema

```yaml
# config.yaml

ai:
  enabled: true
  
  provider:
    type: openai-compatible
    endpoint: https://api.openai.com/v1
    api_key: sk-...
    model: gpt-4
    
    # Alternative: Anthropic
    # type: anthropic
    # api_key: sk-ant-...
    # model: claude-3-opus-20240229
  
  token_budget: 4096
  timeout_secs: 60
  temperature: 0.7
  
  # Optional: Path to custom knowledge base directory
  # Users can add cluster-specific documentation here
  # Structure: custom_knowledge_path/{cluster_id}/*.md
  custom_knowledge_path: /data/cerebro/custom_knowledge
  
  # Optional: Custom prompt templates
  custom_templates:
    dashboard: |
      You are an Elasticsearch expert...
```

**Custom Knowledge Base Directory Structure:**

```
/data/cerebro/custom_knowledge/
├── prod-search-01/              # Cluster-specific docs (by cluster ID)
│   ├── architecture.md          # Custom architecture decisions
│   ├── index-patterns.md        # Cluster-specific index patterns
│   └── troubleshooting.md       # Known issues for this cluster
├── prod-logs-02/                # Another cluster's docs
│   ├── retention-policy.md
│   └── hot-warm-architecture.md
└── general-guidelines.md        # General custom docs (not cluster-specific)
```

**Custom Documentation Format:**

Custom documentation files should use the same markdown format with frontmatter as built-in docs:

```markdown
---
id: prod-search-architecture
title: Production Search Cluster Architecture
version: all
category: best_practices
keywords: [architecture, search, production, sharding]
---

# Production Search Cluster Architecture

This cluster uses a specific sharding strategy optimized for search workloads...

## Index Design

- Primary shards: 5 per index
- Replicas: 2 (for high availability)
- Refresh interval: 30s (optimized for search latency)

## Known Issues

- Index X requires manual shard rebalancing during peak hours
- Avoid creating indices with more than 10 shards
```

### API Request/Response Models

#### Chat Request
```json
{
  "message": "Why is my cluster yellow?",
  "view_context": {
    "view_type": "dashboard",
    "cluster_health": {
      "status": "yellow",
      "number_of_nodes": 3,
      "active_primary_shards": 10,
      "active_shards": 15,
      "relocating_shards": 0,
      "initializing_shards": 0,
      "unassigned_shards": 5
    }
  },
  "preferences": {
    "verbosity": "normal",
    "format": "markdown",
    "include_code_examples": true,
    "include_doc_links": true
  }
}
```

#### SSE Stream Response
```
data: {"content": "Your", "finish_reason": null}

data: {"content": " cluster", "finish_reason": null}

data: {"content": " is", "finish_reason": null}

data: {"content": " yellow", "finish_reason": null}

data: {"content": " because", "finish_reason": null}

data: {"content": " you", "finish_reason": null}

data: {"content": " have", "finish_reason": null}

data: {"content": " 5", "finish_reason": null}

data: {"content": " unassigned", "finish_reason": null}

data: {"content": " replica", "finish_reason": null}

data: {"content": " shards", "finish_reason": null}

data: {"content": ".", "finish_reason": "stop"}

data: [DONE]
```

#### Error Response
```json
{
  "error": "AI provider error",
  "details": "Rate limit exceeded. Please retry after 60 seconds."
}
```

### Database Schema

No database storage required. All conversation history is maintained client-side in browser state.

### Knowledge Base Document Format

```markdown
---
id: cluster-health-yellow
title: Understanding Yellow Cluster Status
version: all
category: troubleshooting
keywords: [yellow, replica, shards, unassigned]
---

# Understanding Yellow Cluster Status

A yellow cluster status indicates that all primary shards are allocated, but some replica shards are not allocated.

## Common Causes

1. **Insufficient nodes**: Not enough nodes to satisfy replica requirements
2. **Shard allocation settings**: Allocation rules preventing replica assignment
3. **Disk space**: Nodes running out of disk space

## Resolution Steps

1. Check number of nodes vs replica count
2. Review shard allocation settings
3. Check disk space on all nodes
4. Consider adjusting replica count if appropriate

## Example

```bash
GET /_cluster/health?level=indices
```
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

Before defining the final properties, I performed a reflection to eliminate redundancy:

**Redundancy Analysis:**
- Configuration validation properties (11.2-11.8) can be combined into a single comprehensive validation property
- User preference properties (13.1-13.4) are all about preference storage and can be combined
- Context building properties (3.3-3.7) all follow the same pattern and can be combined
- Error display properties (10.2-10.3) both test error propagation and can be combined
- Hint text properties (5.5-5.9) all test the same behavior for different views and can be combined

**Consolidation Decisions:**
- Combine all configuration validation into one property about valid configs being accepted and invalid ones rejected
- Combine all view-specific context properties into one property about contexts containing view-appropriate data
- Combine error propagation properties into one property about errors being passed through with details
- Combine hint text properties into one property about hint text matching view type

### Property 1: Configuration Validation

For any AI configuration, if all required fields are present and valid according to the provider type requirements, then the configuration should be accepted; otherwise it should be rejected with a descriptive error.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8**

### Property 2: Configuration Defaults

For any AI configuration where optional parameters (token_budget, timeout_secs, temperature) are omitted, the system should apply the default values (4096, 60, 0.7 respectively).

**Validates: Requirements 1.9, 1.10, 1.11**

### Property 3: AI Feature Visibility

For any page in the application, AI-related UI elements should be visible if and only if AI features are enabled in the configuration.

**Validates: Requirements 1.12, 5.2**

### Property 4: Graceful Degradation

For any invalid or missing AI configuration, the system should disable AI features, log a warning, and continue normal operation without AI capabilities.

**Validates: Requirements 1.13, 10.12, 10.13, 11.10, 11.11**

### Property 5: Streaming Response Delivery

For any AI request, response tokens should arrive incrementally and be displayed to the user as they arrive, rather than waiting for the complete response.

**Validates: Requirements 2.6, 5.12, 7.9, 9.1, 9.2**

### Property 6: Token Budget Enforcement

For any AI request, the total token count (prompt + context + response) should never exceed the configured token budget.

**Validates: Requirements 2.7, 3.9**

### Property 7: Request Timeout

For any AI request, if the provider does not respond within the configured timeout duration, the request should be terminated and return a timeout error.

**Validates: Requirements 2.8**

### Property 8: Input Sanitization

For any user input string, the sanitized version should have all prompt injection patterns removed while preserving the semantic meaning of the input.

**Validates: Requirements 2.12**

### Property 9: Retry with Exponential Backoff

For any transient AI provider failure, the system should retry the request with exponentially increasing delays between attempts.

**Validates: Requirements 2.11**

### Property 10: Context Contains View-Appropriate Data

For any view type (dashboard, indices, shards, nodes, tasks), the generated context should include data fields appropriate to that view type (e.g., cluster health for dashboard, index statistics for indices view).

**Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7**

### Property 11: Context Includes Filters and Grouping

For any view context where filters or grouping settings are active, the generated context should include those filter and grouping parameters.

**Validates: Requirements 3.8, 6.4**

### Property 12: Context Prioritization Under Budget Constraints

For any context that exceeds the token budget, the truncated context should retain high-priority data (system prompt and user message) while truncating lower-priority data (context details).

**Validates: Requirements 3.10**

### Property 13: Context Format Validity

For any generated context, the context data should be valid structured JSON that can be parsed without errors.

**Validates: Requirements 3.11**

### Property 14: Knowledge Base Relevance

For any user query and view type, the knowledge base excerpts included in the prompt should contain keywords or concepts related to the query and view type.

**Validates: Requirements 4.8, 4.9**

### Property 15: Hint Text Matches View

For any view type, the prefilled hint text in the Global Assistant should be contextually appropriate for that view type.

**Validates: Requirements 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**

### Property 16: Request Includes User Text and Context

For any Magic Wand button click, the AI request should include both the text field content (whether prefilled or user-modified) and the current view context.

**Validates: Requirements 5.11**

### Property 17: Conversation History Persistence

For any AI interaction, the user message and assistant response should be added to the conversation history and remain accessible for the duration of the session.

**Validates: Requirements 5.15, 10.9**

### Property 18: View-Specific Description Requests

For any view Magic Wand click, the populated description request should reflect the current view type, visible data, and any active filters or grouping.

**Validates: Requirements 6.2, 6.3, 6.5, 6.6**

### Property 19: View Assistant History Isolation

For any two different views, the conversation history in one view's assistant should not affect or appear in the other view's assistant.

**Validates: Requirements 7.10**

### Property 20: Template Placeholder Replacement

For any prompt template with placeholders, all placeholders should be replaced with actual context data before sending to the AI provider.

**Validates: Requirements 8.11**

### Property 21: Custom Template Override

For any prompt template that has a custom administrator-defined version, the custom template should be used instead of the default template.

**Validates: Requirements 8.12**

### Property 22: Streaming Interruption Handling

For any streaming response that is interrupted (by network failure or user cancellation), the system should display the partial response received up to the point of interruption.

**Validates: Requirements 9.4, 9.5**

### Property 23: Error Message Propagation

For any AI provider error (HTTP error, API error, rate limit, timeout, token limit, malformed response), the system should display the actual error message from the provider with relevant details.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**

### Property 24: Error Logging

For any AI request error, the system should log the error with full request and response details for debugging purposes.

**Validates: Requirements 10.11**

### Property 25: User Preferences Persistence

For any user preference change (verbosity, format, code examples, doc links), the updated preferences should be saved to browser local storage and persist across page reloads.

**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

### Property 26: Preferences in System Prompt

For any AI request, the user's preferences should be included in the system prompt to guide the AI's response style.

**Validates: Requirements 13.6**

### Property 27: Consistent Preference Application

For any user preference setting, all AI interactions (global assistant, view assistants, summaries) should respect that preference consistently.

**Validates: Requirements 13.8**

### Property 28: Cluster-Specific Documentation Prioritization

For any knowledge base search with a cluster_id, cluster-specific custom documentation for that cluster should score higher than general custom documentation, which should score higher than built-in documentation.

**Validates: Requirements 4.13, 4.16**



## Error Handling

### Error Categories

#### Configuration Errors

**Missing or Invalid Configuration**
- Detection: Validate configuration at application startup
- Handling: Disable AI features, log warning, continue normal operation
- User Impact: AI UI elements hidden, no functionality loss for core features
- Recovery: Update configuration file and restart application

**Invalid Provider Type**
- Detection: Configuration validation checks provider type against allowed values
- Handling: Reject configuration, disable AI features
- User Impact: AI features unavailable
- Recovery: Correct provider type in configuration

**Invalid API Credentials**
- Detection: Test connection during startup or first request
- Handling: Disable AI features, log error with details
- User Impact: AI features unavailable
- Recovery: Update API credentials in configuration

#### Runtime Errors

**Network Connectivity Errors**
- Detection: HTTP client connection failures
- Handling: Display connection error with network details to user
- User Impact: AI request fails, user sees error message
- Recovery: Retry button available, automatic retry with exponential backoff

**AI Provider API Errors**
- Detection: HTTP error status codes (4xx, 5xx)
- Handling: Parse provider error response, display exact error message to user
- User Impact: AI request fails with provider's error message
- Recovery: User can retry, may need to adjust request or wait for provider

**Rate Limiting**
- Detection: HTTP 429 status code or rate limit error in response
- Handling: Display rate limit message with retry-after time if available
- User Impact: AI request fails, user informed of rate limit
- Recovery: Wait for rate limit window to expire, then retry

**Timeout Errors**
- Detection: Request exceeds configured timeout duration
- Handling: Cancel request, display timeout error with duration
- User Impact: AI request fails after timeout
- Recovery: User can retry, may need to simplify request

**Token Budget Exceeded**
- Detection: Provider returns token limit error
- Handling: Display provider's token limit error message
- User Impact: AI request fails due to token limit
- Recovery: System should have prevented this via budget enforcement, but if it occurs, user can simplify request

**Malformed Response**
- Detection: JSON parsing errors or unexpected response format
- Handling: Display parsing error with details
- User Impact: AI request fails
- Recovery: Retry request, may indicate provider issue

#### Streaming Errors

**Connection Interruption**
- Detection: SSE connection closed unexpectedly
- Handling: Display partial response received, show interruption message
- User Impact: Incomplete response displayed
- Recovery: Retry button available

**User Cancellation**
- Detection: User clicks stop button
- Handling: Abort request, display partial response
- User Impact: Response stops streaming
- Recovery: User can submit new request

### Error Response Format

All errors follow a consistent format:

```rust
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    /// High-level error category
    pub error: String,
    
    /// Detailed error message from provider or system
    pub details: Option<String>,
    
    /// HTTP status code if applicable
    pub status_code: Option<u16>,
    
    /// Retry-after duration in seconds if applicable
    pub retry_after: Option<u64>,
}
```

### Error Logging

All AI errors are logged with structured logging:

```rust
tracing::error!(
    error = %e,
    provider = %provider_type,
    request_id = %request_id,
    user_message = %sanitized_message,
    "AI request failed"
);
```

Log levels:
- `ERROR`: Request failures, provider errors, network errors
- `WARN`: Configuration issues, validation failures, rate limits
- `INFO`: Successful requests, token usage statistics
- `DEBUG`: Request/response details, context building steps

### Graceful Degradation Strategy

1. **AI Features Disabled**: Core cluster management functionality continues to work
2. **No Blocking**: AI requests never block critical operations
3. **Clear Feedback**: Users always know when AI is unavailable and why
4. **Easy Recovery**: Retry mechanisms available for transient failures
5. **Fallback UI**: When AI is disabled, UI gracefully hides AI elements

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Configuration parsing with valid/invalid examples
- Error response formatting
- UI component rendering
- SSE stream parsing

**Property-Based Tests**: Verify universal properties across all inputs
- Configuration validation with random configs
- Context building with random view data
- Token budget enforcement with random prompts
- Input sanitization with random malicious inputs

### Backend Testing (Rust)

#### Unit Tests

**Configuration Tests** (`backend/src/ai/config_tests.rs`)
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_valid_openai_config() {
        let config = AiConfig {
            enabled: true,
            provider: AiProviderConfig::OpenAiCompatible {
                endpoint: "https://api.openai.com/v1".to_string(),
                api_key: "sk-test".to_string(),
                model: "gpt-4".to_string(),
            },
            token_budget: 4096,
            timeout_secs: 60,
            temperature: 0.7,
        };
        
        assert!(config.validate().is_ok());
    }
    
    #[test]
    fn test_invalid_temperature() {
        let config = AiConfig {
            enabled: true,
            provider: AiProviderConfig::OpenAiCompatible {
                endpoint: "https://api.openai.com/v1".to_string(),
                api_key: "sk-test".to_string(),
                model: "gpt-4".to_string(),
            },
            token_budget: 4096,
            timeout_secs: 60,
            temperature: 3.0, // Invalid: > 2.0
        };
        
        assert!(config.validate().is_err());
    }
    
    #[test]
    fn test_default_values() {
        let config: AiConfig = serde_json::from_str(r#"{
            "enabled": true,
            "provider": {
                "type": "openai-compatible",
                "endpoint": "https://api.openai.com/v1",
                "api_key": "sk-test",
                "model": "gpt-4"
            }
        }"#).unwrap();
        
        assert_eq!(config.token_budget, 4096);
        assert_eq!(config.timeout_secs, 60);
        assert_eq!(config.temperature, 0.7);
    }
}
```

**Context Builder Tests** (`backend/src/ai/context_tests.rs`)
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_dashboard_context_includes_health() {
        let builder = Builder::new(
            knowledge::Base::new().unwrap(),
            templates::Library::new(),
            4096,
        );
        
        let context = ViewContext::Dashboard {
            cluster_health: serde_json::json!({
                "status": "yellow",
                "number_of_nodes": 3
            }),
            cluster_stats: serde_json::json!({}),
        };
        
        let prompt = builder.build_prompt(
            "Why is my cluster yellow?",
            context,
            UserPreferences::default(),
        ).await.unwrap();
        
        let context_str = serde_json::to_string(&prompt.context).unwrap();
        assert!(context_str.contains("yellow"));
        assert!(context_str.contains("number_of_nodes"));
    }
    
    #[tokio::test]
    async fn test_token_budget_enforcement() {
        let builder = Builder::new(
            knowledge::Base::new().unwrap(),
            templates::Library::new(),
            100, // Very small budget
        );
        
        let large_context = ViewContext::Indices {
            indices: vec![serde_json::json!({"name": "test"})],
            filters: None,
            grouping: None,
        };
        
        let prompt = builder.build_prompt(
            "Describe these indices",
            large_context,
            UserPreferences::default(),
        ).await.unwrap();
        
        // Estimate tokens (rough: 1 token ≈ 4 chars)
        let total_chars = prompt.system.len() 
            + prompt.user_message.len() 
            + serde_json::to_string(&prompt.context).unwrap().len();
        let estimated_tokens = total_chars / 4;
        
        assert!(estimated_tokens <= 50); // Half of budget for prompt
    }
}
```

**Input Sanitization Tests** (`backend/src/ai/sanitize_tests.rs`)
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sanitize_removes_injection_patterns() {
        let inputs = vec![
            ("Normal input", "Normal input"),
            ("Input with </s> token", "Input with  token"),
            ("Input with <|im_end|>", "Input with "),
            ("Input with ### separator", "Input with  separator"),
        ];
        
        for (input, expected) in inputs {
            assert_eq!(sanitize_input(input), expected);
        }
    }
}
```

#### Property-Based Tests

**Configuration Validation Property** (`backend/src/ai/config_properties.rs`)
```rust
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    
    proptest! {
        #[test]
        fn test_valid_configs_accepted(
            api_key in "[a-z]{10,50}",
            model in "[a-z0-9-]{5,20}",
            token_budget in 100usize..10000,
            timeout in 10u64..300,
            temperature in 0.0f32..2.0,
        ) {
            // Feature: ai-assistant-integration, Property 1: Configuration Validation
            let config = AiConfig {
                enabled: true,
                provider: AiProviderConfig::OpenAiCompatible {
                    endpoint: "https://api.openai.com/v1".to_string(),
                    api_key,
                    model,
                },
                token_budget,
                timeout_secs: timeout,
                temperature,
            };
            
            assert!(config.validate().is_ok());
        }
        
        #[test]
        fn test_invalid_temperature_rejected(
            temperature in prop::num::f32::ANY.prop_filter(
                "out of range",
                |t| *t < 0.0 || *t > 2.0
            )
        ) {
            // Feature: ai-assistant-integration, Property 1: Configuration Validation
            let config = AiConfig {
                enabled: true,
                provider: AiProviderConfig::OpenAiCompatible {
                    endpoint: "https://api.openai.com/v1".to_string(),
                    api_key: "sk-test".to_string(),
                    model: "gpt-4".to_string(),
                },
                token_budget: 4096,
                timeout_secs: 60,
                temperature,
            };
            
            assert!(config.validate().is_err());
        }
    }
}
```

**Context Building Property** (`backend/src/ai/context_properties.rs`)
```rust
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    
    fn arb_view_context() -> impl Strategy<Value = ViewContext> {
        prop_oneof![
            Just(ViewContext::Dashboard {
                cluster_health: serde_json::json!({"status": "green"}),
                cluster_stats: serde_json::json!({}),
            }),
            Just(ViewContext::Indices {
                indices: vec![],
                filters: None,
                grouping: None,
            }),
            Just(ViewContext::Shards {
                shards: vec![],
                filters: None,
            }),
            Just(ViewContext::Nodes {
                nodes: vec![],
                filters: None,
            }),
            Just(ViewContext::Tasks {
                tasks: vec![],
                filters: None,
            }),
        ]
    }
    
    proptest! {
        #[test]
        fn test_context_format_validity(
            user_message in ".*",
            view_context in arb_view_context(),
        ) {
            // Feature: ai-assistant-integration, Property 13: Context Format Validity
            let builder = Builder::new(
                knowledge::Base::new().unwrap(),
                templates::Library::new(),
                4096,
            );
            
            let rt = tokio::runtime::Runtime::new().unwrap();
            let prompt = rt.block_on(async {
                builder.build_prompt(
                    &user_message,
                    view_context,
                    UserPreferences::default(),
                ).await
            }).unwrap();
            
            // Context should be valid JSON
            let context_str = serde_json::to_string(&prompt.context).unwrap();
            assert!(serde_json::from_str::<serde_json::Value>(&context_str).is_ok());
        }
        
        #[test]
        fn test_token_budget_never_exceeded(
            user_message in ".*",
            view_context in arb_view_context(),
            token_budget in 100usize..10000,
        ) {
            // Feature: ai-assistant-integration, Property 6: Token Budget Enforcement
            let builder = Builder::new(
                knowledge::Base::new().unwrap(),
                templates::Library::new(),
                token_budget,
            );
            
            let rt = tokio::runtime::Runtime::new().unwrap();
            let prompt = rt.block_on(async {
                builder.build_prompt(
                    &user_message,
                    view_context,
                    UserPreferences::default(),
                ).await
            }).unwrap();
            
            // Estimate total tokens
            let total_chars = prompt.system.len() 
                + prompt.user_message.len() 
                + serde_json::to_string(&prompt.context).unwrap().len();
            let estimated_tokens = total_chars / 4;
            
            // Should not exceed half the budget (other half reserved for response)
            assert!(estimated_tokens <= token_budget / 2);
        }
    }
}
```

**Input Sanitization Property** (`backend/src/ai/sanitize_properties.rs`)
```rust
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    
    proptest! {
        #[test]
        fn test_sanitization_removes_injection_patterns(
            input in ".*",
        ) {
            // Feature: ai-assistant-integration, Property 8: Input Sanitization
            let sanitized = sanitize_input(&input);
            
            // Should not contain injection patterns
            assert!(!sanitized.contains("</s>"));
            assert!(!sanitized.contains("<|im_end|>"));
            assert!(!sanitized.contains("<|endoftext|>"));
        }
    }
}
```

### Frontend Testing (TypeScript/React)

#### Unit Tests (Vitest + React Testing Library)

**Global Assistant Component Tests** (`frontend/src/components/GlobalAssistant.test.tsx`)
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalAssistant } from './GlobalAssistant';
import { vi } from 'vitest';

describe('GlobalAssistant', () => {
  it('renders when AI is enabled', async () => {
    // Mock AI status
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, providerType: 'openai-compatible' }),
    });
    
    render(<GlobalAssistant />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Describe this cluster/)).toBeInTheDocument();
    });
  });
  
  it('does not render when AI is disabled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false }),
    });
    
    const { container } = render(<GlobalAssistant />);
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
  
  it('displays streaming response token by token', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"content":"Hello"}\n'),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"content":" world"}\n'),
              })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: vi.fn(),
          }),
        },
      });
    
    render(<GlobalAssistant />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Describe this cluster/)).toBeInTheDocument();
    });
    
    const input = screen.getByPlaceholderText(/Describe this cluster/);
    fireEvent.change(input, { target: { value: 'Test question' } });
    
    const button = screen.getByText('Ask');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    });
  });
  
  it('displays error messages with copy button', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });
    
    render(<GlobalAssistant />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Describe this cluster/)).toBeInTheDocument();
    });
    
    const input = screen.getByPlaceholderText(/Describe this cluster/);
    fireEvent.change(input, { target: { value: 'Test question' } });
    
    const button = screen.getByText('Ask');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });
  });
});
```

**AI Client Tests** (`frontend/src/api/ai-client.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { AiClient } from './ai-client';

describe('AiClient', () => {
  it('parses SSE stream correctly', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"content":"Hello"}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"content":" world"}\n'),
            })
            .mockResolvedValueOnce({ done: true }),
          releaseLock: vi.fn(),
        }),
      },
    };
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse);
    
    const client = new AiClient();
    const tokens: string[] = [];
    
    for await (const token of client.streamChat({
      message: 'test',
      viewContext: { viewType: 'dashboard', data: {} },
    })) {
      tokens.push(token.content);
    }
    
    expect(tokens).toEqual(['Hello', ' world']);
  });
  
  it('throws error on failed request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'API error' }),
    });
    
    const client = new AiClient();
    
    await expect(async () => {
      for await (const token of client.streamChat({
        message: 'test',
        viewContext: { viewType: 'dashboard', data: {} },
      })) {
        // Should not reach here
      }
    }).rejects.toThrow('API error');
  });
});
```

#### Property-Based Tests (fast-check)

**Preferences Persistence Property** (`frontend/src/hooks/useAiPreferences.test.ts`)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { updateAiPreferences } from './useAiPreferences';

describe('AI Preferences Properties', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should persist any valid preferences to localStorage', () => {
    // Feature: ai-assistant-integration, Property 25: User Preferences Persistence
    fc.assert(
      fc.property(
        fc.constantFrom('concise', 'normal', 'detailed'),
        fc.constantFrom('plain_text', 'markdown', 'structured'),
        fc.boolean(),
        fc.boolean(),
        (verbosity, format, includeCodeExamples, includeDocLinks) => {
          const preferences = {
            verbosity,
            format,
            includeCodeExamples,
            includeDocLinks,
          };
          
          updateAiPreferences(preferences);
          
          const stored = localStorage.getItem('ai_preferences');
          expect(stored).not.toBeNull();
          
          const parsed = JSON.parse(stored!);
          expect(parsed.verbosity).toBe(verbosity);
          expect(parsed.format).toBe(format);
          expect(parsed.includeCodeExamples).toBe(includeCodeExamples);
          expect(parsed.includeDocLinks).toBe(includeDocLinks);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

**End-to-End AI Flow** (`backend/tests/ai_integration_test.rs`)
```rust
#[tokio::test]
async fn test_complete_ai_flow() {
    // Start test server with AI enabled
    let config = AiConfig {
        enabled: true,
        provider: AiProviderConfig::OpenAiCompatible {
            endpoint: "http://localhost:8080".to_string(), // Mock server
            api_key: "test-key".to_string(),
            model: "test-model".to_string(),
        },
        token_budget: 4096,
        timeout_secs: 60,
        temperature: 0.7,
    };
    
    let app = create_test_app(config).await;
    
    // Test status endpoint
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/ai/status")
                .body(Body::empty())
                .unwrap()
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    // Test chat endpoint
    let chat_request = serde_json::json!({
        "message": "Why is my cluster yellow?",
        "view_context": {
            "view_type": "dashboard",
            "cluster_health": {
                "status": "yellow"
            }
        }
    });
    
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/ai/chat")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&chat_request).unwrap()))
                .unwrap()
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "text/event-stream"
    );
}
```

### Test Configuration

**Minimum Iterations**: All property-based tests run with minimum 100 iterations to ensure comprehensive coverage through randomization.

**Test Tags**: Each property test includes a comment tag referencing the design document property:
```rust
// Feature: ai-assistant-integration, Property 6: Token Budget Enforcement
```

### Manual Testing Checklist

- [ ] Configure AI with OpenAI-compatible provider, verify connection
- [ ] Configure AI with Anthropic provider, verify connection
- [ ] Navigate to dashboard, verify Global Assistant appears with appropriate hint text
- [ ] Click Magic Wand, verify request includes cluster health context
- [ ] Submit question, verify streaming response appears token-by-token
- [ ] Navigate to indices view, verify hint text changes
- [ ] Click view Magic Wand, verify View Assistant populates with description request
- [ ] Submit view-specific question, verify context includes index data
- [ ] Apply filters to indices, verify AI context includes filter information
- [ ] Test with invalid API key, verify error message displays provider's error
- [ ] Test with rate-limited API, verify rate limit message displays
- [ ] Test network disconnection during streaming, verify partial response displays
- [ ] Click stop button during streaming, verify request cancels
- [ ] Change AI preferences, verify they persist after page reload
- [ ] Verify AI preferences affect response style
- [ ] Disable AI in configuration, verify all AI UI elements hidden
- [ ] Verify core cluster management works with AI disabled



## Rust Dependencies and Crate Selection

### AI Provider Crates

**Recommended Approach: Use Production-Ready SDKs**

Instead of building HTTP clients from scratch, we'll use well-maintained Rust crates and wrap them with our Provider trait:

```toml
[dependencies]
# AI Provider SDKs
async-openai = "0.27"      # OpenAI-compatible APIs with built-in SSE streaming
anthropic-sdk = "0.2"      # Anthropic Claude API with streaming support
futures = "0.3"            # For stream handling
tokio-stream = "0.1"       # Stream utilities
```

**Why `async-openai`:**
- Built-in SSE streaming (no manual parsing needed)
- Automatic retry with exponential backoff (already implemented)
- Supports custom endpoints (Ollama, local models, Azure)
- Ergonomic builder pattern
- Well-maintained with extensive examples
- High source reputation and 91 code snippets

**Why `anthropic-sdk`:**
- Type-safe async-first design
- Streaming and non-streaming support
- Comprehensive error handling
- Matches Anthropic's official API

**Implementation Strategy:**
- Create thin adapter wrappers around these crates
- Implement our Provider trait for each
- Leverage built-in features (streaming, retry, error handling)
- Add our custom logic (input sanitization, token budget enforcement)

### Knowledge Base Implementation

**Storage and Embedding Strategy:**

1. **Directory Structure:**
   ```
   backend/knowledge_base/
   ├── api/
   │   ├── cluster-health.md
   │   ├── index-apis.md
   │   └── search-apis.md
   ├── troubleshooting/
   │   ├── yellow-cluster.md
   │   ├── shard-allocation.md
   │   └── disk-watermarks.md
   ├── best_practices/
   │   ├── index-design.md
   │   ├── replica-configuration.md
   │   └── backup-strategies.md
   ├── performance/
   │   ├── query-optimization.md
   │   └── indexing-performance.md
   └── index_management/
       ├── lifecycle-policies.md
       └── rollover.md
   ```

2. **Document Format (Markdown with Frontmatter):**
   ```markdown
   ---
   id: cluster-health-yellow
   title: Understanding Yellow Cluster Status
   version: all  # or "7.x", "8.x", "9.x"
   category: troubleshooting
   keywords: [yellow, replica, shards, unassigned, allocation]
   ---
   
   # Understanding Yellow Cluster Status
   
   A yellow cluster status indicates that all primary shards are allocated,
   but some replica shards are not allocated.
   
   ## Common Causes
   
   1. **Insufficient nodes**: Not enough nodes to satisfy replica requirements
   2. **Shard allocation settings**: Allocation rules preventing replica assignment
   3. **Disk space**: Nodes running out of disk space
   
   ## Resolution Steps
   
   1. Check number of nodes vs replica count
   2. Review shard allocation settings
   3. Check disk space on all nodes
   ```

3. **Embedding with `rust-embed`:**
   ```rust
   use rust_embed::RustEmbed;
   
   #[derive(RustEmbed)]
   #[folder = "knowledge_base/"]
   struct EmbeddedDocs;
   ```
   - Compiles all markdown files into the binary at build time
   - No external files needed at runtime
   - Fast in-memory access
   - Updates via application releases only

4. **Search Implementation:**
   - **Simple keyword matching** (MVP approach)
   - Split query into keywords
   - Score documents based on keyword matches in title, content, keywords field
   - Apply category-based relevance boost (e.g., boost "troubleshooting" docs for cluster health queries)
   - Return top N results
   - **Future enhancement**: Add vector embeddings for semantic search

5. **Content Creation Process:**
   - **Recommended Approach: Manual Curation (MVP)**
     - Don't try to scrape/convert all Elasticsearch docs
     - Manually write focused documentation for common scenarios
     - Reference official docs but rewrite for AI consumption (concise, actionable)
     - Focus on: cluster health issues, shard allocation, index management, performance
     - Benefits: Higher quality, smaller knowledge base, faster search
   
   - **Alternative: Convert from Elasticsearch GitHub Repo (Optional)**
     - Source: `https://github.com/elastic/elasticsearch/tree/main/docs`
     - Format: AsciiDoc (.asciidoc files)
     - Process: Clone repo → Convert AsciiDoc to Markdown → Add frontmatter → Curate
     - Tools: `asciidoctor` can convert to HTML, then HTML to Markdown
     - Only pursue if manual curation is too time-consuming
   
   - **Content Priority for MVP:**
     1. Cluster health troubleshooting (yellow/red status)
     2. Shard allocation issues
     3. Index management basics
     4. Common API examples
     5. Performance optimization tips
   
   - Tag with version applicability
   - Organize by category for relevance scoring

**Why This Approach:**
- ✅ Simple and predictable
- ✅ No external dependencies or services
- ✅ Fast (in-memory)
- ✅ Works offline
- ✅ Easy to update (just add/edit markdown files)
- ✅ Good enough for MVP
- ✅ Can enhance with vector search later if needed

## Implementation Notes

### Phase 1: Backend Infrastructure (Priority: High)

**Configuration and Provider Abstraction**
1. Implement `AiConfig` structure with validation
2. Create `Provider` trait with streaming and non-streaming methods
3. Implement `OpenAI` client with SSE streaming support
4. Implement `Anthropic` client with SSE streaming support
5. Add configuration validation at startup
6. Test connectivity to providers during initialization

**Context Builder**
1. Define `ViewContext` enum with all view types
2. Implement context extraction for each view type
3. Add token estimation and budget enforcement
4. Implement intelligent context truncation
5. Add filter and grouping detection

**Knowledge Base**
1. Create knowledge base directory structure
2. Write Elasticsearch documentation in markdown format
3. Implement `rust-embed` integration
4. Create simple keyword-based search
5. Add category-based relevance scoring

**Prompt Templates**
1. Write template for each view type (dashboard, indices, shards, nodes, tasks)
2. Implement template selection logic
3. Add placeholder replacement
4. Support custom template loading from configuration

**API Routes**
1. Implement `/api/ai/chat` with SSE streaming
2. Implement `/api/ai/summary` for non-streaming summaries
3. Implement `/api/ai/status` for feature availability
4. Add comprehensive error handling with provider error propagation
5. Implement input sanitization

### Phase 2: Frontend Components (Priority: High)

**AI API Client**
1. Implement SSE stream parsing
2. Add retry logic with exponential backoff
3. Handle connection interruptions gracefully
4. Implement request cancellation

**Global Assistant Component**
1. Create component with text input and Magic Wand button
2. Implement view-based hint text
3. Add streaming response display
4. Implement conversation history management
5. Add error display with copy functionality
6. Add loading states and stop button

**View Assistant Component**
1. Create collapsible component for each view
2. Implement Magic Wand icon in view headers
3. Add view-specific prompt generation
4. Implement separate conversation history per view
5. Add example questions as hints

**Custom Hooks**
1. Implement `useViewContext` to extract current view data
2. Implement `useAiPreferences` for preference management
3. Add localStorage persistence for preferences

### Phase 3: Knowledge Base Content (Priority: Medium)

**Documentation Collection**
1. Extract relevant Elasticsearch documentation
2. Organize by category (API, best practices, troubleshooting, etc.)
3. Add version-specific content for ES 7.x, 8.x, 9.x
4. Create keyword index for fast lookup
5. Write custom troubleshooting guides

**Template Refinement**
1. Test templates with real queries
2. Refine based on response quality
3. Add more specific templates for common scenarios
4. Document template customization process

### Phase 4: User Preferences (Priority: Low)

**Preferences UI**
1. Create settings panel for AI preferences
2. Add verbosity selector (concise, normal, detailed)
3. Add format selector (plain text, markdown, structured)
4. Add toggles for code examples and doc links
5. Implement preference persistence

**Preference Integration**
1. Include preferences in system prompts
2. Test preference effects on responses
3. Ensure consistent application across all AI interactions

### Implementation Order Rationale

1. **Backend First**: Establish solid foundation with provider abstraction and context building
2. **Frontend Components**: Build UI on top of working backend API
3. **Knowledge Base**: Enhance quality with embedded documentation
4. **Preferences**: Add personalization as final polish

### Security Considerations

**Input Sanitization**
- Remove prompt injection patterns: `</s>`, `<|im_end|>`, `<|endoftext|>`, `###`
- Validate input length to prevent abuse
- Log suspicious input patterns for monitoring

**API Key Protection**
- Never expose API keys in frontend code
- Store keys securely in backend configuration
- Use environment variables for sensitive data
- Rotate keys regularly

**Rate Limiting**
- Implement per-user rate limiting to prevent abuse
- Track token usage per user/session
- Set reasonable limits based on provider quotas

**Data Privacy**
- Never send sensitive cluster data to AI providers without user awareness
- Sanitize cluster names and sensitive identifiers
- Allow administrators to disable AI for sensitive environments
- Log all AI requests for audit purposes

### Performance Considerations

**Streaming Response**
- Use SSE for efficient token streaming
- Minimize latency by streaming immediately
- Handle backpressure if frontend can't keep up

**Context Building**
- Cache knowledge base index in memory
- Optimize context extraction to minimize overhead
- Use async operations to avoid blocking

**Token Budget Management**
- Estimate tokens accurately (1 token ≈ 4 characters)
- Prioritize important data when truncating
- Reserve adequate tokens for response

**Caching**
- Consider caching common queries (optional future enhancement)
- Cache knowledge base search results
- Cache template selections

### Monitoring and Observability

**Metrics to Track**
- AI request count per view type
- Average response time
- Token usage per request
- Error rate by error type
- Provider availability

**Logging**
- Log all AI requests with sanitized user messages
- Log provider errors with full details
- Log token usage for cost tracking
- Log configuration validation failures

**Alerting**
- Alert on high error rates
- Alert on provider connectivity issues
- Alert on unusual token usage patterns

### Future Enhancements (Out of Scope)

1. **Semantic Search**: Replace keyword search with vector embeddings for better knowledge base retrieval
2. **Query Caching**: Cache responses for common queries to reduce API costs
3. **Multi-turn Conversations**: Maintain conversation context across multiple exchanges
4. **AI-Suggested Actions**: Provide executable commands based on AI recommendations
5. **Custom Knowledge Base**: Allow administrators to add custom documentation
6. **Response Feedback**: Allow users to rate responses for quality tracking
7. **Cost Tracking**: Detailed token usage and cost reporting per user/cluster
8. **Offline Mode**: Local model support for air-gapped environments

## API Specifications

### REST Endpoints

#### POST /api/ai/chat

Stream AI chat response with Server-Sent Events.

**Request Body:**
```json
{
  "message": "Why is my cluster yellow?",
  "view_context": {
    "view_type": "dashboard",
    "cluster_health": {
      "status": "yellow",
      "number_of_nodes": 3,
      "active_primary_shards": 10,
      "active_shards": 15,
      "unassigned_shards": 5
    },
    "cluster_stats": {}
  },
  "preferences": {
    "verbosity": "normal",
    "format": "markdown",
    "include_code_examples": true,
    "include_doc_links": true
  }
}
```

**Response:** Server-Sent Events stream

```
Content-Type: text/event-stream

data: {"content": "Your", "finish_reason": null}

data: {"content": " cluster", "finish_reason": null}

data: {"content": " is", "finish_reason": null}

data: {"content": " yellow", "finish_reason": null}

...

data: {"content": ".", "finish_reason": "stop"}

data: [DONE]
```

**Error Response:**
```json
{
  "error": "AI provider error",
  "details": "Rate limit exceeded. Please retry after 60 seconds.",
  "status_code": 429,
  "retry_after": 60
}
```

**Status Codes:**
- `200 OK`: Streaming response started
- `400 Bad Request`: Invalid request format
- `429 Too Many Requests`: Rate limited
- `502 Bad Gateway`: AI provider error
- `503 Service Unavailable`: AI features disabled

#### POST /api/ai/summary

Generate view summary (non-streaming).

**Request Body:**
```json
{
  "message": "Summarize these indices",
  "view_context": {
    "view_type": "indices",
    "indices": [
      {
        "name": "logs-2024.01",
        "status": "green",
        "docs_count": 1000000,
        "size": "500mb"
      },
      {
        "name": "logs-2024.02",
        "status": "yellow",
        "docs_count": 500000,
        "size": "250mb"
      }
    ],
    "filters": {
      "status": "yellow"
    }
  },
  "preferences": {
    "verbosity": "concise",
    "format": "markdown",
    "include_code_examples": false,
    "include_doc_links": true
  }
}
```

**Response:**
```json
{
  "response": "You have 2 indices. One index (logs-2024.02) is yellow, indicating missing replica shards. This is likely due to insufficient nodes for replica allocation. Consider adding more nodes or reducing replica count."
}
```

**Status Codes:**
- `200 OK`: Summary generated
- `400 Bad Request`: Invalid request format
- `502 Bad Gateway`: AI provider error
- `503 Service Unavailable`: AI features disabled

#### GET /api/ai/status

Check AI feature availability.

**Response:**
```json
{
  "enabled": true,
  "provider_type": "openai-compatible"
}
```

**Status Codes:**
- `200 OK`: Status retrieved

### WebSocket Alternative (Optional)

For environments where SSE is problematic, WebSocket can be used as an alternative:

**WebSocket Endpoint:** `ws://localhost:9000/api/ai/ws`

**Message Format:**
```json
{
  "type": "chat",
  "payload": {
    "message": "Why is my cluster yellow?",
    "view_context": { ... },
    "preferences": { ... }
  }
}
```

**Response Messages:**
```json
{"type": "token", "content": "Your"}
{"type": "token", "content": " cluster"}
{"type": "token", "content": " is"}
{"type": "token", "content": " yellow"}
{"type": "done", "finish_reason": "stop"}
```

**Error Messages:**
```json
{
  "type": "error",
  "error": "AI provider error",
  "details": "Rate limit exceeded"
}
```

## Deployment Considerations

### Configuration Management

**Environment Variables**
```bash
# AI Provider Configuration
AI_ENABLED=true
AI_PROVIDER_TYPE=openai-compatible
AI_ENDPOINT=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4
AI_TOKEN_BUDGET=4096
AI_TIMEOUT_SECS=60
AI_TEMPERATURE=0.7
```

**Configuration File** (`config.yaml`)
```yaml
ai:
  enabled: true
  provider:
    type: openai-compatible
    endpoint: https://api.openai.com/v1
    api_key: ${AI_API_KEY}  # From environment
    model: gpt-4
  token_budget: 4096
  timeout_secs: 60
  temperature: 0.7
```

### Docker Deployment

**Dockerfile Considerations**
- Embed knowledge base in binary using `rust-embed`
- No external files needed for knowledge base
- Configuration via environment variables or mounted config file

**Example Docker Compose**
```yaml
services:
  cerebro:
    image: cerebro:latest
    environment:
      - AI_ENABLED=true
      - AI_PROVIDER_TYPE=openai-compatible
      - AI_ENDPOINT=https://api.openai.com/v1
      - AI_API_KEY=${OPENAI_API_KEY}
      - AI_MODEL=gpt-4
    ports:
      - "9000:9000"
```

### Kubernetes Deployment

**ConfigMap for Configuration**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cerebro-config
data:
  config.yaml: |
    ai:
      enabled: true
      provider:
        type: openai-compatible
        endpoint: https://api.openai.com/v1
        model: gpt-4
      token_budget: 4096
```

**Secret for API Key**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cerebro-secrets
type: Opaque
stringData:
  ai-api-key: sk-...
```

**Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cerebro
spec:
  template:
    spec:
      containers:
      - name: cerebro
        image: cerebro:latest
        env:
        - name: AI_API_KEY
          valueFrom:
            secretKeyRef:
              name: cerebro-secrets
              key: ai-api-key
        volumeMounts:
        - name: config
          mountPath: /etc/cerebro
      volumes:
      - name: config
        configMap:
          name: cerebro-config
```

### Health Checks

**Liveness Probe**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 9000
  initialDelaySeconds: 10
  periodSeconds: 30
```

**Readiness Probe**
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 9000
  initialDelaySeconds: 5
  periodSeconds: 10
```

The `/ready` endpoint should check:
- Server is running
- Configuration is valid
- AI provider is reachable (if enabled)

### Scaling Considerations

**Horizontal Scaling**
- AI feature is stateless (no server-side conversation history)
- Can scale horizontally without coordination
- Load balancer can distribute requests across instances

**Resource Requirements**
- CPU: Minimal (mostly I/O bound waiting for AI provider)
- Memory: ~100MB for knowledge base + normal Cerebro overhead
- Network: Depends on AI request volume and response sizes

### Cost Management

**Token Usage Tracking**
- Log token usage per request
- Aggregate by user, view type, time period
- Set up alerts for unusual usage patterns

**Rate Limiting**
- Implement per-user rate limits
- Consider per-cluster rate limits
- Provide usage statistics to administrators

**Cost Optimization**
- Use smaller models for simple queries
- Cache common responses (future enhancement)
- Implement request deduplication

## Summary

This design provides a comprehensive AI assistant integration for the Elasticsearch web admin tool with the following key features:

1. **Multi-Provider Support**: Unified interface supporting OpenAI-compatible APIs and Anthropic
2. **Context Awareness**: Automatic context extraction based on current view with intelligent truncation
3. **Embedded Knowledge**: Elasticsearch documentation embedded in binary for expert-level guidance
4. **Streaming Responses**: Real-time token-by-token response delivery for better UX
5. **Transparent Errors**: Actual provider error messages displayed to users
6. **User Personalization**: Customizable response style and detail level
7. **Graceful Degradation**: Core functionality works even when AI is unavailable
8. **Security**: Input sanitization, API key protection, rate limiting
9. **Comprehensive Testing**: Unit tests and property-based tests for correctness

The implementation follows Rust and TypeScript best practices, maintains brand agnosticism, and integrates seamlessly with the existing Cerebro architecture.
