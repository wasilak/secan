# Implementation Plan: AI Assistant Integration

## Overview

This implementation plan breaks down the AI assistant integration feature into discrete, incremental tasks. The implementation follows a phased approach: backend infrastructure first, then frontend components, followed by knowledge base content, and finally user preferences. Each task builds on previous work and includes specific requirements references for traceability.

The design specifies a comprehensive AI assistant system with:
- Multi-provider support (OpenAI-compatible and Anthropic)
- Context-aware prompt construction based on current view
- Embedded Elasticsearch knowledge base
- Streaming responses with SSE
- Global and view-specific assistant components
- Comprehensive error handling with transparent provider errors

## Tasks

- [ ] 1. Backend: Configuration and Provider Infrastructure
  - [ ] 1.1 Implement AI configuration structure with validation
    - Create `AiConfig` struct in `backend/src/config/types.rs`
    - Add fields: enabled, provider, token_budget, timeout_secs, temperature
    - Implement `AiProviderConfig` enum with OpenAiCompatible and Anthropic variants
    - Add default value functions for optional parameters
    - Implement configuration validation method
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  
  - [ ]* 1.2 Write property test for configuration validation
    - **Property 1: Configuration Validation**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8**
    - Test that valid configs are accepted and invalid ones rejected
    - Test temperature range validation (0.0-2.0)
    - Test positive number validation for token_budget and timeout
  
  - [ ]* 1.3 Write property test for configuration defaults
    - **Property 2: Configuration Defaults**
    - **Validates: Requirements 1.9, 1.10, 1.11**
    - Test that omitted optional parameters use default values

  - [ ] 1.4 Implement AI Provider trait abstraction
    - Create `backend/src/ai/provider.rs` module
    - Define `Token` struct with content and finish_reason fields
    - Define `Prompt` struct with system, user_message, context, temperature, max_tokens
    - Define `Provider` trait with async methods: stream_completion, complete, provider_type, validate_config, test_connection
    - Implement `Factory` struct for creating provider instances based on config
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 1.5 Write unit tests for provider trait factory
    - Test factory creates correct provider type based on config
    - Test factory validation rejects invalid configs
    - _Requirements: 2.1_

- [ ] 2. Backend: OpenAI-Compatible Provider Implementation
  - [ ] 2.1 Add async-openai dependency and implement client wrapper
    - Add `async-openai = "0.27"` to Cargo.toml
    - Create `backend/src/ai/openai.rs` module
    - Implement `Client` struct that wraps `async_openai::Client`
    - Implement constructor with custom endpoint configuration
    - Add endpoint URL validation
    - _Requirements: 2.4, 11.3_
  
  - [ ] 2.2 Implement OpenAI streaming completion using async-openai
    - Implement `stream_completion` method using `async_openai`'s built-in streaming
    - Use `CreateChatCompletionRequestArgs` builder pattern
    - Convert `async_openai` stream to our Token stream
    - Handle finish_reason detection
    - Leverage built-in SSE parsing from the crate
    - _Requirements: 2.6, 9.1, 9.2, 9.3_
  
  - [ ] 2.3 Implement OpenAI non-streaming completion using async-openai
    - Implement `complete` method using `async_openai`'s non-streaming API
    - Parse complete response and extract content
    - _Requirements: 2.3_

  - [ ] 2.4 Leverage async-openai's built-in retry logic
    - Configure retry settings in client initialization
    - async-openai already implements exponential backoff for rate limits
    - Add custom retry logic only for network errors if needed
    - _Requirements: 2.11_
  
  - [ ]* 2.5 Write property test for retry with exponential backoff
    - **Property 9: Retry with Exponential Backoff**
    - **Validates: Requirements 2.11**
    - Test that retries occur with increasing delays
  
  - [ ] 2.6 Implement request timeout handling
    - Add timeout wrapper using tokio::time::timeout
    - Return timeout error when duration exceeded
    - _Requirements: 2.8_
  
  - [ ]* 2.7 Write property test for request timeout
    - **Property 7: Request Timeout**
    - **Validates: Requirements 2.8**
    - Test that requests terminate after configured timeout
  
  - [ ] 2.8 Implement input sanitization
    - Create sanitize_input function to remove injection patterns
    - Remove: </s>, <|im_end|>, <|endoftext|>, ###
    - Preserve semantic meaning while removing dangerous patterns
    - _Requirements: 2.12_
  
  - [ ]* 2.9 Write property test for input sanitization
    - **Property 8: Input Sanitization**
    - **Validates: Requirements 2.12**
    - Test that all injection patterns are removed from any input
  
  - [ ]* 2.10 Write unit tests for OpenAI client
    - Test successful streaming response parsing
    - Test error response handling
    - Test timeout behavior
    - _Requirements: 2.4, 2.6, 2.8_

- [ ] 3. Backend: Anthropic Provider Implementation
  - [ ] 3.1 Add anthropic-sdk dependency and implement client wrapper
    - Add `anthropic-sdk = "0.2"` to Cargo.toml
    - Create `backend/src/ai/anthropic.rs` module
    - Implement `Client` struct that wraps `anthropic_sdk::Client`
    - Implement constructor with API key validation
    - _Requirements: 2.5_

  - [ ] 3.2 Implement Anthropic streaming completion using anthropic-sdk
    - Implement `stream_completion` method using SDK's streaming API
    - Handle Anthropic-specific message format via SDK types
    - Convert SDK stream to our Token stream
    - Parse content blocks and extract text
    - _Requirements: 2.6, 9.1, 9.2_
  
  - [ ] 3.3 Implement Anthropic non-streaming completion using anthropic-sdk
    - Implement `complete` method using SDK's non-streaming API
    - Parse Anthropic response format via SDK types
    - _Requirements: 2.3_
  
  - [ ] 3.4 Leverage anthropic-sdk's built-in features
    - Use SDK's error handling and timeout support
    - Add custom retry logic if needed beyond SDK capabilities
    - _Requirements: 2.8, 2.11_
  
  - [ ]* 3.5 Write unit tests for Anthropic client
    - Test successful streaming response parsing
    - Test Claude-specific message format
    - Test error handling
    - _Requirements: 2.5, 2.6_

- [ ] 4. Backend: Context Builder Implementation
  - [ ] 4.1 Implement ViewContext enum and related types with cluster_id
    - Create `backend/src/ai/context.rs` module
    - Define `ViewContext` enum with variants: Dashboard, Indices, Shards, Nodes, Tasks
    - Add `cluster_id: String` field to each variant for cluster-specific knowledge
    - Define filter structs: IndexFilters, ShardFilters, NodeFilters, TaskFilters
    - Define `UserPreferences` struct with verbosity, format, include_code_examples, include_doc_links
    - _Requirements: 3.1, 3.2, 13.1, 13.2, 13.3, 13.4, 4.13_
  
  - [ ] 4.2 Implement Context Builder structure
    - Create `Builder` struct with knowledge_base, templates, token_budget fields
    - Implement constructor
    - _Requirements: 3.1_

  - [ ] 4.3 Implement view type identification and cluster ID extraction
    - Implement `identify_view_type` method to extract view type from context
    - Implement `extract_cluster_id` method to extract cluster ID from context
    - _Requirements: 3.2_
  
  - [ ] 4.4 Implement context data formatting
    - Implement `format_context` method to convert ViewContext to JSON
    - Ensure structured, machine-readable format
    - _Requirements: 3.11_
  
  - [ ]* 4.5 Write property test for context format validity
    - **Property 13: Context Format Validity**
    - **Validates: Requirements 3.11**
    - Test that generated context is always valid JSON
  
  - [ ] 4.6 Implement view-specific context extraction
    - Add logic to include cluster health for dashboard view
    - Add logic to include index statistics for indices view
    - Add logic to include shard allocation for shards view
    - Add logic to include node statistics for nodes view
    - Add logic to include task information for tasks view
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ]* 4.7 Write property test for context contains view-appropriate data
    - **Property 10: Context Contains View-Appropriate Data**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7**
    - Test that each view type includes appropriate data fields
  
  - [ ] 4.8 Implement filter and grouping detection
    - Add logic to extract filters from ViewContext
    - Add logic to extract grouping settings from ViewContext
    - Include filters and grouping in formatted context
    - _Requirements: 3.8_
  
  - [ ]* 4.9 Write property test for context includes filters and grouping
    - **Property 11: Context Includes Filters and Grouping**
    - **Validates: Requirements 3.8, 6.4**
    - Test that active filters and grouping appear in context

  - [ ] 4.10 Implement token budget enforcement
    - Implement token estimation (1 token ≈ 4 chars)
    - Implement `enforce_token_budget` method
    - Prioritize system prompt and user message over context
    - Implement intelligent context truncation when budget exceeded
    - Reserve half of budget for response
    - _Requirements: 2.7, 3.9, 3.10_
  
  - [ ]* 4.11 Write property test for token budget enforcement
    - **Property 6: Token Budget Enforcement**
    - **Validates: Requirements 2.7, 3.9**
    - Test that total tokens never exceed configured budget
  
  - [ ]* 4.12 Write property test for context prioritization
    - **Property 12: Context Prioritization Under Budget Constraints**
    - **Validates: Requirements 3.10**
    - Test that system prompt and user message are retained when truncating
  
  - [ ] 4.13 Implement system prompt building
    - Implement `build_system_prompt` method
    - Include prompt template content
    - Include knowledge base excerpts
    - Include user preferences in prompt
    - _Requirements: 13.6_
  
  - [ ]* 4.14 Write property test for preferences in system prompt
    - **Property 26: Preferences in System Prompt**
    - **Validates: Requirements 13.6**
    - Test that user preferences appear in system prompt
  
  - [ ] 4.15 Implement complete prompt building with cluster-aware knowledge search
    - Implement `build_prompt` method that orchestrates all steps
    - Identify view type and extract cluster ID from context
    - Query knowledge base with cluster_id for prioritized search
    - Select template, format context, build system prompt, enforce budget
    - Return complete Prompt struct
    - _Requirements: 3.1, 3.2, 4.15, 4.16_
  
  - [ ]* 4.16 Write unit tests for context builder
    - Test dashboard context includes health metrics
    - Test token budget enforcement with small budget
    - Test context truncation preserves important data
    - _Requirements: 3.3, 3.9, 3.10_

- [ ] 5. Backend: Knowledge Base Implementation
  - [ ] 5.1 Create knowledge base directory structure
    - Create `knowledge_base/` directory in backend
    - Organize by category: api/, best_practices/, troubleshooting/, index_management/, cluster_health/, performance/
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ] 5.2 Implement knowledge base embedding
    - Create `backend/src/ai/knowledge.rs` module
    - Use rust-embed to embed knowledge_base/ directory
    - Define `Document` struct with id, title, content, version, category, keywords
    - Define `Category` enum
    - _Requirements: 4.1_
  
  - [ ] 5.3 Implement knowledge base loading with custom path support
    - Update `Base::new()` to accept `custom_knowledge_path: Option<PathBuf>` parameter
    - Load embedded documents with `DocumentSource::BuiltIn`
    - Call `load_custom_docs()` if custom path is configured
    - Parse document metadata from frontmatter or filename
    - Build in-memory index
    - _Requirements: 4.1, 4.10, 4.11, 4.12_
  
  - [ ] 5.4 Implement custom documentation loading from filesystem
    - Implement `load_custom_docs()` method
    - Check if custom knowledge path exists, log warning if not
    - Walk the custom knowledge directory
    - Identify cluster ID folders vs general markdown files
    - Load general custom docs with `DocumentSource::CustomGeneral`
    - Call `load_cluster_docs()` for each cluster folder
    - _Requirements: 4.11, 4.12_
  
  - [ ] 5.5 Implement cluster-specific documentation loading
    - Implement `load_cluster_docs()` method
    - Walk cluster-specific directory
    - Load markdown files with `DocumentSource::CustomClusterSpecific`
    - Set `cluster_id` field on each document
    - Support same frontmatter format as built-in docs
    - _Requirements: 4.13, 4.14_
  
  - [ ] 5.6 Update Document struct to support custom docs
    - Add `source: DocumentSource` field (BuiltIn, CustomGeneral, CustomClusterSpecific)
    - Add `cluster_id: Option<String>` field for cluster-specific docs
    - Update `parse_document()` to handle frontmatter parsing
    - _Requirements: 4.13, 4.14_
  
  - [ ] 5.7 Implement keyword-based search with cluster prioritization
    - Update `search` method to accept `cluster_id: Option<&str>` parameter
    - Implement `search` method with keyword matching
    - Score documents based on keyword matches in title, content, keywords
    - Apply category relevance boost based on view type
    - Apply source prioritization: cluster-specific (3x) > custom general (2x) > built-in (1x)
    - Match cluster-specific docs only for the current cluster
    - Return top N documents
    - _Requirements: 4.8, 4.9, 4.15, 4.16_
  
  - [ ]* 5.8 Write property test for knowledge base relevance
    - **Property 14: Knowledge Base Relevance**
    - **Validates: Requirements 4.8, 4.9**
    - Test that returned excerpts contain query keywords or view-related concepts
  
  - [ ]* 5.9 Write property test for cluster-specific prioritization
    - **Property 28: Cluster-Specific Documentation Prioritization**
    - **Validates: Requirements 4.13, 4.16**
    - Test that cluster-specific docs score higher than general docs for matching cluster
  
  - [ ]* 5.10 Write unit tests for knowledge base
    - Test document loading from embedded files
    - Test custom documentation loading from filesystem
    - Test cluster-specific documentation loading
    - Test keyword search returns relevant results
    - Test category-based relevance scoring
    - Test source prioritization (cluster-specific > custom > built-in)
    - _Requirements: 4.1, 4.8, 4.9, 4.11, 4.12, 4.13, 4.16_

- [ ] 6. Backend: Prompt Template Library
  - [ ] 6.1 Create template directory structure
    - Create `backend/src/ai/templates/` directory
    - Create template files: dashboard.txt, indices.txt, shards.txt, nodes.txt, tasks.txt
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 6.2 Write prompt templates for each view type
    - Write dashboard template for cluster health analysis
    - Write indices template for index performance optimization
    - Write shards template for shard allocation troubleshooting
    - Write nodes template for node resource analysis
    - Write tasks template for task analysis
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 6.3 Implement template library
    - Create `backend/src/ai/templates.rs` module
    - Implement `Library` struct with HashMap of templates
    - Load templates using include_str! macro
    - _Requirements: 8.1_
  
  - [ ] 6.4 Implement template selection
    - Implement `select_template` method based on view type
    - Return appropriate template for each view
    - _Requirements: 8.10_
  
  - [ ] 6.5 Implement custom template loading
    - Implement `load_custom_templates` method
    - Allow administrators to override default templates
    - _Requirements: 8.12_
  
  - [ ]* 6.6 Write property test for custom template override
    - **Property 21: Custom Template Override**
    - **Validates: Requirements 8.12**
    - Test that custom templates override defaults
  
  - [ ]* 6.7 Write unit tests for template library
    - Test template selection returns correct template for each view
    - Test custom template loading overrides defaults
    - _Requirements: 8.10, 8.12_

- [ ] 7. Backend: API Routes Implementation
  - [ ] 7.1 Create AI routes module structure
    - Create `backend/src/ai/routes.rs` module
    - Define `AiState` struct with provider, context_builder, enabled fields
    - Define request/response types: ChatRequest, ChatResponse, StatusResponse, ErrorResponse
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 7.2 Implement POST /api/ai/chat streaming endpoint
    - Implement `chat_stream` handler function
    - Check if AI is enabled, return 503 if disabled
    - Sanitize user input
    - Build prompt using context builder
    - Stream completion from provider
    - Convert token stream to SSE events
    - Handle errors and return appropriate status codes
    - _Requirements: 2.6, 9.1, 9.2, 9.3, 12.1_
  
  - [ ]* 7.3 Write property test for streaming response delivery
    - **Property 5: Streaming Response Delivery**
    - **Validates: Requirements 2.6, 5.12, 7.9, 9.1, 9.2**
    - Test that tokens arrive incrementally, not all at once
  
  - [ ] 7.4 Implement POST /api/ai/summary endpoint
    - Implement `generate_summary` handler function
    - Check if AI is enabled
    - Build summary prompt
    - Get complete response from provider
    - Return JSON response
    - _Requirements: 12.2_
  
  - [ ] 7.5 Implement GET /api/ai/status endpoint
    - Implement `status` handler function
    - Return enabled status and provider type
    - _Requirements: 12.3_
  
  - [ ]* 7.6 Write property test for AI feature visibility
    - **Property 3: AI Feature Visibility**
    - **Validates: Requirements 1.12, 5.2**
    - Test that status endpoint reflects configuration
  
  - [ ] 7.7 Implement comprehensive error handling
    - Handle provider unreachable errors
    - Handle HTTP errors from provider
    - Handle API errors (invalid key, model not found)
    - Handle rate limit errors with retry-after
    - Handle timeout errors
    - Handle token limit errors
    - Handle malformed response errors
    - Return ErrorResponse with details
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 7.8 Write property test for error message propagation
    - **Property 23: Error Message Propagation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**
    - Test that provider errors are passed through with details
  
  - [ ] 7.9 Implement error logging
    - Add structured logging for all AI errors
    - Log with error level for failures
    - Include provider type, request details, error details
    - _Requirements: 10.11_
  
  - [ ]* 7.10 Write property test for error logging
    - **Property 24: Error Logging**
    - **Validates: Requirements 10.11**
    - Test that errors are logged with full details
  
  - [ ] 7.11 Create router and integrate with main application
    - Create `routes()` function that returns configured router
    - Add AI routes to main Axum application in `backend/src/main.rs`
    - Initialize AiState with provider and context builder
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ]* 7.12 Write integration tests for AI routes
    - Test complete AI flow: status check, chat request, streaming response
    - Test error responses for disabled AI
    - Test error responses for invalid requests
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 8. Backend: Configuration Integration and Validation
  - [ ] 8.1 Integrate AI config into main configuration
    - Add `ai` field to main ServerConfig struct
    - Load AI configuration from config file and environment variables
    - _Requirements: 1.1_
  
  - [ ] 8.2 Implement startup configuration validation
    - Validate AI configuration at application startup
    - Test connectivity to AI provider if enabled
    - Disable AI features if validation fails
    - Log descriptive warnings for configuration errors
    - Continue startup even if AI validation fails
    - _Requirements: 11.1, 11.2, 11.9, 11.10, 11.11_

  - [ ]* 8.3 Write property test for graceful degradation
    - **Property 4: Graceful Degradation**
    - **Validates: Requirements 1.13, 10.12, 10.13, 11.10, 11.11**
    - Test that invalid config disables AI but allows normal operation
  
  - [ ]* 8.4 Write unit tests for configuration validation
    - Test valid OpenAI config is accepted
    - Test valid Anthropic config is accepted
    - Test invalid temperature is rejected
    - Test missing required fields are rejected
    - Test default values are applied
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [ ] 9. Checkpoint - Backend Infrastructure Complete
  - Ensure all backend tests pass
  - Verify backend builds without errors or warnings
  - Test AI configuration loading with both OpenAI and Anthropic
  - Test connectivity to AI providers
  - Verify error handling returns appropriate messages
  - Ask the user if questions arise

- [ ] 10. Frontend: AI API Client Implementation
  - [ ] 10.1 Create AI client module structure with cluster_id support
    - Create `frontend/src/api/ai-client.ts` file
    - Define TypeScript interfaces: ChatRequest, ViewContext (with clusterId field), UserPreferences, Token, AiStatus
    - _Requirements: 12.5, 12.7, 4.13_
  
  - [ ] 10.2 Implement AiClient class constructor
    - Create AiClient class with baseUrl parameter
    - Default baseUrl to '/api/ai'
    - _Requirements: 12.5_
  
  - [ ] 10.3 Implement SSE streaming chat method
    - Implement `streamChat` as async generator
    - Send POST request to /api/ai/chat
    - Parse SSE stream with ReadableStream reader
    - Yield tokens as they arrive
    - Handle [DONE] event
    - Handle connection errors
    - _Requirements: 9.3, 12.7_

  - [ ]* 10.4 Write property test for streaming interruption handling
    - **Property 22: Streaming Interruption Handling**
    - **Validates: Requirements 9.4, 9.5**
    - Test that partial responses are displayed when stream interrupts
  
  - [ ] 10.5 Implement non-streaming summary method
    - Implement `generateSummary` method
    - Send POST request to /api/ai/summary
    - Return complete response string
    - _Requirements: 12.2_
  
  - [ ] 10.6 Implement status check method
    - Implement `getStatus` method
    - Send GET request to /api/ai/status
    - Return AiStatus object
    - _Requirements: 12.3_
  
  - [ ] 10.7 Implement error handling and retry logic
    - Handle fetch errors and throw descriptive messages
    - Parse error responses from backend
    - Implement retry logic for transient failures
    - _Requirements: 12.9_
  
  - [ ]* 10.8 Write unit tests for AI client
    - Test SSE stream parsing with mock responses
    - Test error handling for failed requests
    - Test status check
    - _Requirements: 12.7, 12.9_

- [ ] 11. Frontend: Custom Hooks Implementation
  - [ ] 11.1 Implement useViewContext hook with cluster_id extraction
    - Create `frontend/src/hooks/useViewContext.ts` file
    - Use useLocation to determine current route
    - Implement getViewTypeFromPath to extract view type
    - Implement extractClusterId to extract cluster ID from URL path or cluster data
    - Implement extractViewData to get relevant cluster data
    - Extract filters and grouping from URL params
    - Return ViewContext object with clusterId field
    - _Requirements: 3.2, 3.8, 4.13_

  - [ ] 11.2 Implement useAiPreferences hook
    - Create `frontend/src/hooks/useAiPreferences.ts` file
    - Define default preferences constant
    - Load preferences from localStorage on mount
    - Return UserPreferences object
    - _Requirements: 13.5_
  
  - [ ] 11.3 Implement updateAiPreferences function
    - Create function to update preferences
    - Merge with existing preferences
    - Save to localStorage
    - Dispatch custom event to notify components
    - _Requirements: 13.5_
  
  - [ ]* 11.4 Write property test for user preferences persistence
    - **Property 25: User Preferences Persistence**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**
    - Test that any valid preference change persists to localStorage
  
  - [ ]* 11.5 Write unit tests for preferences hooks
    - Test preferences load from localStorage
    - Test preferences update and persist
    - Test default preferences when none stored
    - _Requirements: 13.5_

- [ ] 12. Frontend: Global Assistant Component
  - [ ] 12.1 Create GlobalAssistant component structure
    - Create `frontend/src/components/GlobalAssistant.tsx` file
    - Define component state: input, messages, isStreaming, error, aiEnabled
    - Define Message interface with role and content
    - _Requirements: 5.1, 5.2_
  
  - [ ] 12.2 Implement AI availability check
    - Check AI status on component mount using aiClient.getStatus()
    - Set aiEnabled state based on response
    - Return null if AI is disabled
    - _Requirements: 1.12, 5.2_
  
  - [ ]* 12.3 Write unit test for AI feature visibility
    - Test component renders when AI is enabled
    - Test component does not render when AI is disabled
    - _Requirements: 1.12, 5.2_

  - [ ] 12.4 Implement view-based hint text
    - Use useViewContext hook to get current view type
    - Implement getHintText function with view-specific hints
    - Update input field with hint text when view changes
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  
  - [ ]* 12.5 Write property test for hint text matches view
    - **Property 15: Hint Text Matches View**
    - **Validates: Requirements 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**
    - Test that hint text is appropriate for each view type
  
  - [ ] 12.6 Implement text input and Magic Wand button
    - Add Mantine Textarea for multi-line input
    - Add Magic Wand button with IconWand icon
    - Allow user to modify prefilled hint text
    - Support Cmd/Ctrl+Enter to submit
    - _Requirements: 5.3, 5.10, 5.14_
  
  - [ ] 12.7 Implement streaming response handling
    - Implement handleSubmit function
    - Add user message to conversation history
    - Call aiClient.streamChat with message and context
    - Update assistant message in real-time as tokens arrive
    - Display loading indicator while waiting for first token
    - _Requirements: 5.11, 5.12, 5.13, 9.1, 9.2_
  
  - [ ]* 12.8 Write property test for request includes user text and context
    - **Property 16: Request Includes User Text and Context**
    - **Validates: Requirements 5.11**
    - Test that Magic Wand sends both text and view context
  
  - [ ] 12.9 Implement conversation history management
    - Store messages array in component state
    - Add user and assistant messages to history
    - Display message bubbles with appropriate styling
    - Implement clear button to reset history
    - _Requirements: 5.15, 5.16_
  
  - [ ]* 12.10 Write property test for conversation history persistence
    - **Property 17: Conversation History Persistence**
    - **Validates: Requirements 5.15, 10.9**
    - Test that messages remain in history during session

  - [ ] 12.11 Implement stop button for cancellation
    - Add stop button that appears during streaming
    - Implement handleStop to abort request
    - Use AbortController to cancel fetch
    - _Requirements: 9.6, 9.7_
  
  - [ ] 12.12 Implement error display with copy functionality
    - Display error messages in conversation history
    - Add copy button to copy error details
    - Style error messages distinctly
    - _Requirements: 5.17, 10.8, 10.9, 10.10_
  
  - [ ]* 12.13 Write unit tests for GlobalAssistant component
    - Test streaming response displays token by token
    - Test error messages display with copy button
    - Test stop button cancels request
    - Test clear button resets history
    - _Requirements: 5.12, 5.16, 9.6, 10.8_

- [ ] 13. Frontend: View Assistant Component
  - [ ] 13.1 Create ViewAssistant component structure
    - Create `frontend/src/components/ViewAssistant.tsx` file
    - Define component props: viewContext, defaultPrompt
    - Define component state: opened, input, messages, isStreaming
    - _Requirements: 7.1, 7.2_
  
  - [ ] 13.2 Implement collapsible interface
    - Use Mantine Collapse component
    - Add show/hide button with chevron icons
    - Default to collapsed state
    - _Requirements: 7.2_
  
  - [ ] 13.3 Implement Magic Wand button for view summaries
    - Add Magic Wand button in view header
    - Implement handleMagicWand to populate text field
    - Use getDefaultPrompt to generate view-specific description request
    - Focus text field after populating
    - _Requirements: 6.1, 6.2, 6.8_

  - [ ]* 13.4 Write property test for view-specific description requests
    - **Property 18: View-Specific Description Requests**
    - **Validates: Requirements 6.2, 6.3, 6.5, 6.6**
    - Test that description reflects view type, data, filters, and grouping
  
  - [ ] 13.5 Implement view-specific hint text and placeholders
    - Implement getPlaceholder function with view-specific hints
    - Display example questions in placeholder
    - _Requirements: 7.3, 7.4, 7.11_
  
  - [ ] 13.6 Implement view-specific question handling
    - Implement handleSubmit for view questions
    - Include view-specific context in request
    - Support questions about specific items, comparisons, trends
    - _Requirements: 7.5, 7.6, 7.7, 7.8_
  
  - [ ] 13.7 Implement separate conversation history per view
    - Maintain messages array in component state
    - Display streaming responses in real-time
    - Keep history separate from Global Assistant
    - _Requirements: 7.9, 7.10_
  
  - [ ]* 13.8 Write property test for view assistant history isolation
    - **Property 19: View Assistant History Isolation**
    - **Validates: Requirements 7.10**
    - Test that different views have separate conversation histories
  
  - [ ]* 13.9 Write unit tests for ViewAssistant component
    - Test Magic Wand populates description request
    - Test collapsible interface works
    - Test view-specific context is included in requests
    - _Requirements: 6.2, 7.2, 7.5_

- [ ] 14. Frontend: Integration with Main Application
  - [ ] 14.1 Add GlobalAssistant to main layout
    - Import GlobalAssistant component in main layout/app component
    - Position below cluster health bar and breadcrumbs
    - Ensure visible on all pages
    - _Requirements: 5.1, 5.2_

  - [ ] 14.2 Add ViewAssistant to each view
    - Add ViewAssistant to indices view
    - Add ViewAssistant to shards view
    - Add ViewAssistant to nodes view
    - Add ViewAssistant to tasks view
    - Pass appropriate viewContext to each instance
    - _Requirements: 7.1_
  
  - [ ] 14.3 Add Magic Wand icons to view headers
    - Add Magic Wand icon button to indices view header
    - Add Magic Wand icon button to shards view header
    - Add Magic Wand icon button to nodes view header
    - Add Magic Wand icon button to tasks view header
    - Wire to ViewAssistant handleMagicWand
    - _Requirements: 6.1_
  
  - [ ] 14.4 Test frontend integration
    - Verify GlobalAssistant appears on all pages
    - Verify ViewAssistant appears in each view
    - Verify Magic Wand buttons trigger appropriate actions
    - Test navigation between views maintains separate histories
    - _Requirements: 5.1, 5.2, 7.1, 7.10_

- [ ] 15. Checkpoint - Frontend Components Complete
  - Ensure all frontend tests pass
  - Verify frontend builds without errors or warnings
  - Test GlobalAssistant with mock AI responses
  - Test ViewAssistant in each view
  - Verify streaming responses display correctly
  - Verify error handling displays provider errors
  - Ask the user if questions arise

- [ ] 16. Knowledge Base: Content Creation
  - [ ] 16.1 Set up knowledge base directory structure
    - Create `backend/knowledge_base/` directory
    - Create subdirectories: api/, troubleshooting/, best_practices/, performance/, index_management/, cluster_health/
    - _Requirements: 4.2, 4.6_
  
  - [ ] 16.2 Create initial documentation set (manual curation approach)
    - **Approach**: Manually write focused docs for AI consumption, don't try to scrape everything
    - **Sources**: Reference official Elasticsearch docs, but rewrite for conciseness
    - **Format**: Markdown with frontmatter (see example below)
    - _Requirements: 4.2_
  
  - [ ] 16.3 Create cluster health documentation
    - Write `cluster_health/yellow-status.md` - Understanding yellow cluster status
    - Write `cluster_health/red-status.md` - Understanding red cluster status
    - Write `cluster_health/green-status.md` - Understanding green cluster status
    - Cover common causes, resolutions, and API examples
    - _Requirements: 4.2, 4.6_

  - [ ] 16.4 Create index management documentation
    - Write `index_management/lifecycle-policies.md` - Index lifecycle management
    - Write `index_management/index-settings.md` - Common index settings
    - Write `index_management/mappings.md` - Index mappings best practices
    - Include best practices for index design
    - _Requirements: 4.2, 4.5_
  
  - [ ] 16.5 Create shard allocation documentation
    - Write `troubleshooting/shard-allocation.md` - Shard allocation troubleshooting
    - Write `troubleshooting/disk-watermarks.md` - Disk watermark settings
    - Write `troubleshooting/unassigned-shards.md` - Fixing unassigned shards
    - Include common allocation issues and fixes
    - _Requirements: 4.2, 4.4_
  
  - [ ] 16.6 Create performance optimization documentation
    - Write `performance/query-optimization.md` - Query performance tips
    - Write `performance/indexing-performance.md` - Indexing performance tips
    - Write `performance/caching.md` - Caching strategies
    - Include node resource optimization
    - _Requirements: 4.2, 4.6_
  
  - [ ] 16.7 Create API reference documentation
    - Write `api/cluster-apis.md` - Common cluster APIs
    - Write `api/index-apis.md` - Common index APIs
    - Write `api/search-apis.md` - Common search APIs
    - Include request/response examples
    - _Requirements: 4.2_
  
  - [ ] 16.8 Create best practices documentation
    - Write `best_practices/cluster-sizing.md` - Cluster sizing guidelines
    - Write `best_practices/replica-configuration.md` - Replica configuration
    - Write `best_practices/backup-strategies.md` - Backup and restore strategies
    - Include security and access control guidance
    - _Requirements: 4.3_
  
  - [ ] 16.9 Add version-specific content and metadata
    - Tag each document with version applicability (7.x, 8.x, 9.x, all)
    - Add version-specific notes for breaking changes
    - Ensure frontmatter includes: id, title, version, category, keywords
    - _Requirements: 4.7_
  
  - [ ] 16.10 Optional: Script to convert Elasticsearch docs from GitHub
    - **Only if manual curation is too time-consuming**
    - Clone `https://github.com/elastic/elasticsearch` docs folder
    - Write script to convert AsciiDoc to Markdown
    - Extract relevant sections and add frontmatter
    - This is optional - manual curation is recommended for MVP
  
  - [ ] 16.11 Test knowledge base integration
    - Verify documents are embedded in binary using rust-embed
    - Test search returns relevant results for common queries
    - Verify category-based relevance scoring works
    - Test with queries like "yellow cluster", "shard allocation", "index performance"
    - _Requirements: 4.1, 4.8, 4.9, 4.10_

**Example Document Format:**
```markdown
---
id: cluster-health-yellow
title: Understanding Yellow Cluster Status
version: all
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

1. Check number of nodes vs replica count:
   ```
   GET /_cluster/health?level=indices
   ```

2. Review shard allocation settings:
   ```
   GET /_cluster/settings?include_defaults=true
   ```

3. Check disk space on all nodes:
   ```
   GET /_cat/allocation?v
   ```

## Quick Fix

If you have only one node and don't need replicas:
```
PUT /my-index/_settings
{
  "index": {
    "number_of_replicas": 0
  }
}
```
```

- [ ] 17. User Preferences: Settings UI
  - [ ] 17.1 Create AI preferences settings panel
    - Create `frontend/src/components/AiPreferencesPanel.tsx` file
    - Add to application settings/preferences page
    - _Requirements: 13.7_
  
  - [ ] 17.2 Implement verbosity selector
    - Add radio group or select for verbosity: concise, normal, detailed
    - Load current preference from useAiPreferences
    - Update preference on change
    - _Requirements: 13.1_
  
  - [ ] 17.3 Implement format selector
    - Add radio group or select for format: plain_text, markdown, structured
    - Load current preference from useAiPreferences
    - Update preference on change
    - _Requirements: 13.2_
  
  - [ ] 17.4 Implement code examples toggle
    - Add checkbox for including code examples
    - Load current preference from useAiPreferences
    - Update preference on change
    - _Requirements: 13.3_
  
  - [ ] 17.5 Implement documentation links toggle
    - Add checkbox for including documentation links
    - Load current preference from useAiPreferences
    - Update preference on change
    - _Requirements: 13.4_
  
  - [ ] 17.6 Test preferences persistence
    - Verify preferences save to localStorage
    - Verify preferences persist across page reloads
    - Verify preferences apply to all AI interactions
    - _Requirements: 13.5, 13.8_
  
  - [ ]* 17.7 Write property test for consistent preference application
    - **Property 27: Consistent Preference Application**
    - **Validates: Requirements 13.8**
    - Test that preferences apply consistently across all AI interactions

- [ ] 18. Frontend: Knowledge Management UI
  - [ ] 18.1 Add knowledge management API methods to AI client
    - Add `getKnowledgeStatus()` method to AiClient class
    - Add `reloadKnowledge()` method to AiClient class
    - Define TypeScript interfaces: KnowledgeStatusResponse, DocumentInfo, KnowledgeReloadResponse, LoadError
    - _Requirements: 14.6, 14.7_
  
  - [ ] 18.2 Create KnowledgeManagementPage component
    - Create `frontend/src/components/KnowledgeManagementPage.tsx` file
    - Implement component state: status, loading, reloading, reloadResult, error
    - Implement loadStatus function to fetch knowledge base status
    - Implement handleReload function to trigger documentation reload
    - _Requirements: 14.1, 14.2_
  
  - [ ] 18.3 Implement status display section
    - Display configured custom knowledge path
    - Display total document count
    - Display counts by source: built-in, custom general, cluster-specific
    - Use Mantine Card and Badge components for styling
    - _Requirements: 14.2, 14.3, 14.13, 14.14_
  
  - [ ] 18.4 Implement cluster-specific documentation display
    - Use Mantine Accordion to group docs by cluster ID
    - Display table of documents for each cluster
    - Show filename, title, category, and load status for each document
    - Use color-coded badges for load status (success/error)
    - _Requirements: 14.4, 14.5_
  
  - [ ] 18.5 Implement reload functionality
    - Add reload button with loading state
    - Display reload results with success/error counts
    - Show list of errors if any files failed to load
    - Refresh status display after successful reload
    - _Requirements: 14.8, 14.9, 14.11, 14.12_
  
  - [ ] 18.6 Add route for knowledge management page
    - Add route to React Router configuration
    - Add navigation link in admin/settings menu
    - Ensure page is accessible to administrators
    - _Requirements: 14.1_
  
  - [ ]* 18.7 Write unit tests for KnowledgeManagementPage
    - Test status loading displays correctly
    - Test reload button triggers reload
    - Test error display when API calls fail
    - Test cluster-specific docs display in accordion
    - _Requirements: 14.1, 14.2, 14.8_

- [ ] 19. Backend: Knowledge Management Implementation
  - [ ] 19.1 Add cluster access control to AiState
    - Add `cluster_config: Arc<ClusterConfig>` field to AiState
    - Implement `get_user_accessible_clusters()` helper method
    - Integrate with existing RBAC system from cluster configuration
    - _Requirements: 14.16, 14.17_
  
  - [ ] 19.2 Implement get_status() method with access control
    - Update method signature to accept `accessible_clusters: Option<&[String]>`
    - Count documents by source (built-in, custom general, cluster-specific)
    - Filter cluster-specific docs by accessible clusters
    - Group cluster-specific docs by cluster ID (only accessible clusters)
    - Create DocumentInfo structs with filename, title, category, source, load_status
    - Return KnowledgeStatusResponse
    - _Requirements: 14.6, 14.13, 14.14, 14.16, 14.17_
  
  - [ ] 19.3 Implement reload_custom_docs() method with access control
    - Update method signature to accept `accessible_clusters: Option<&[String]>`
    - Remove existing custom docs from index (retain built-in and inaccessible cluster docs)
    - Reload custom docs from filesystem with error tracking and access filtering
    - Use load_custom_docs_with_errors helper method with access control
    - Collect errors for files that fail to load
    - Return KnowledgeReloadResponse with success status and error list
    - _Requirements: 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 14.18, 14.19_
  
  - [ ] 19.4 Update load_custom_docs_with_errors with access control
    - Add `accessible_clusters: Option<&[String]>` parameter
    - Walk custom knowledge directory
    - Skip cluster folders user doesn't have access to
    - Track errors for each file that fails to load
    - Parse documents and add to index
    - Handle both general docs and cluster-specific folders
    - _Requirements: 14.12, 14.18, 14.19_
  
  - [ ] 19.5 Update knowledge_status and knowledge_reload route handlers
    - Extract authenticated user from session (AuthUser)
    - Call get_user_accessible_clusters() to get user's cluster access
    - Pass accessible clusters to get_status() and reload_custom_docs()
    - _Requirements: 14.16, 14.17, 14.18, 14.19_
  
  - [ ]* 19.6 Write unit tests for access control
    - Test get_status() filters clusters correctly
    - Test get_status() shows only accessible clusters
    - Test reload_custom_docs() only reloads accessible cluster docs
    - Test reload_custom_docs() preserves inaccessible cluster docs
    - Test load_custom_docs_with_errors skips inaccessible clusters
    - _Requirements: 14.16, 14.17, 14.18, 14.19_

- [ ] 20. End-to-End Integration Testing
  - [ ]* 20.1 Test complete AI flow with OpenAI-compatible provider
    - Configure with OpenAI-compatible endpoint
    - Test dashboard view AI summary
    - Test indices view AI questions
    - Verify streaming responses work
    - Verify error handling works

  - [ ]* 20.2 Test complete AI flow with Anthropic provider
    - Configure with Anthropic API
    - Test dashboard view AI summary
    - Test shards view AI questions
    - Verify streaming responses work
    - Verify error handling works
  
  - [ ]* 20.3 Test AI disabled scenario
    - Disable AI in configuration
    - Verify AI UI elements are hidden
    - Verify core cluster management still works
    - Verify no errors in console
  
  - [ ]* 20.4 Test error scenarios
    - Test with invalid API key
    - Test with unreachable endpoint
    - Test with rate limiting
    - Verify error messages display provider details
    - Verify copy error button works
  
  - [ ]* 20.5 Test context awareness
    - Apply filters in indices view
    - Verify AI context includes filters
    - Apply grouping in indices view
    - Verify AI context includes grouping
    - Navigate between views
    - Verify context changes appropriately
  
  - [ ]* 20.6 Test conversation history
    - Ask multiple questions in Global Assistant
    - Verify history persists
    - Clear history
    - Verify history resets
    - Ask questions in different view assistants
    - Verify histories are separate
  
  - [ ]* 20.7 Test user preferences
    - Change verbosity to concise
    - Verify AI responses are more concise
    - Change format to plain_text
    - Verify AI responses use plain text
    - Reload page
    - Verify preferences persist
  
  - [ ]* 20.8 Test knowledge management UI
    - Navigate to knowledge management page
    - Verify status displays correctly
    - Verify document counts are accurate
    - Verify cluster-specific docs display in accordion
    - Click reload button
    - Verify reload completes and status updates
    - Test with invalid custom knowledge path
    - Verify errors display correctly

- [ ] 21. Documentation and Configuration Examples
  - [ ] 21.1 Create configuration documentation
    - Document AI configuration options in README or docs
    - Provide example configurations for OpenAI and Anthropic
    - Document environment variable overrides
    - Include troubleshooting guide
    - Document custom knowledge base configuration and directory structure

  - [ ] 21.2 Create example configuration files
    - Create config.yaml.example with AI section
    - Create docker-compose.yml example with AI environment variables
    - Create Kubernetes ConfigMap and Secret examples
    - Include custom_knowledge_path configuration example
  
  - [ ] 21.3 Document API endpoints
    - Document POST /api/ai/chat endpoint with request/response examples
    - Document POST /api/ai/summary endpoint
    - Document GET /api/ai/status endpoint
    - Document GET /api/ai/knowledge/status endpoint
    - Document POST /api/ai/knowledge/reload endpoint
    - Include SSE stream format documentation
  
  - [ ] 21.4 Create user guide
    - Document how to use Global Assistant
    - Document how to use View Assistant
    - Document Magic Wand functionality
    - Include screenshots or examples
    - Document user preferences
    - Document custom knowledge base setup and management

- [ ] 22. Final Checkpoint - Feature Complete
  - Ensure all backend tests pass (unit and property-based)
  - Ensure all frontend tests pass (unit and property-based)
  - Verify backend builds without errors or warnings
  - Verify frontend builds without errors or warnings
  - Test with real OpenAI-compatible API (GPT-4, Llama, Mistral)
  - Test with real Anthropic API (Claude)
  - Verify knowledge base provides relevant excerpts
  - Verify prompt templates produce quality responses
  - Verify error handling displays actual provider errors
  - Verify graceful degradation when AI is disabled
  - Verify user preferences persist and apply consistently
  - Verify conversation histories work correctly
  - Verify streaming responses display smoothly
  - Verify custom knowledge base loading and prioritization works
  - Verify knowledge management UI displays status correctly
  - Verify knowledge reload functionality works
  - Review all requirements are satisfied
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at major milestones
- Backend infrastructure is built first to provide stable API for frontend
- Frontend components are built on working backend
- Knowledge base content enhances quality after core functionality works
- User preferences add personalization as final polish
