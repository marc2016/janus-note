# Spec Delta: llm-provider

## Purpose

Provides a unified, extensible abstraction layer for multiple Large Language Model providers in Janus Note, supporting local and cloud models with streaming, tool-calling, and dynamic model discovery.

## ADDED Requirements

### Requirement: Unified LLM Provider Interface
The system SHALL define a provider interface that standardizes chat interactions, token streaming, tool call execution, and model catalog discovery across diverse LLM backends.

#### Scenario: Provider registration and selection
- **WHEN** the application initializes or configures an LLM provider (such as Ollama or Gemini)
- **THEN** the provider exposes standardized methods for listing models, non-streaming chat, and streaming chat using a normalized message schema.

#### Scenario: Message normalization
- **WHEN** an interaction contains system instructions, user prompts, assistant turns, or tool results
- **THEN** the provider translates the normalized message list into its vendor-specific API payload without losing roles, content, or tool arguments.

### Requirement: Local Ollama Provider Adapter
The system SHALL provide an Ollama provider adapter that communicates with a local or remote Ollama server instance to list installed models and execute completions.

#### Scenario: Auto-discovery of local models
- **WHEN** the client queries available models from an active Ollama instance
- **THEN** the system queries the Ollama tag catalog (`/api/tags`) and returns all locally installed model tags and details.

#### Scenario: Ollama streaming and tool calling
- **WHEN** a chat request with defined tools is dispatched to Ollama
- **THEN** the adapter streams response tokens via newline-delimited chunks and surfaces structured tool call requests when emitted by tool-capable models.

### Requirement: Cloud Google Gemini Provider Adapter
The system SHALL provide a Google Gemini provider adapter that communicates with Google Generative AI endpoints using an API key.

#### Scenario: Gemini model catalog and completion
- **WHEN** a chat request is sent to Gemini with a configured API key
- **THEN** the adapter maps messages and system instructions to Gemini content structures, supports tool calling via function declarations, and streams response chunks.

#### Scenario: Invalid or missing API key error handling
- **WHEN** a request is dispatched without an API key or with an invalid key
- **THEN** the provider returns a descriptive error without crashing the workspace or leaking sensitive parameters.

### Requirement: Stream Chunk and Event Normalization
The system SHALL normalize streaming responses from all providers into a common event contract containing text deltas, tool call deltas, usage metrics, and finish reasons.

#### Scenario: Token-by-token text streaming
- **WHEN** a provider streams a response
- **THEN** the consumer receives an async iterable of standardized chunks containing incremental text deltas and a termination event on completion.

#### Scenario: Streaming tool call chunks
- **WHEN** a provider streams a tool or function call
- **THEN** the consumer receives structured tool call deltas including tool call ID, function name, and argument fragments that assemble into valid JSON.

### Requirement: Global AI Settings Persistence
The system SHALL persist AI provider configuration (endpoints, API keys, default provider, and default model selections) in app-level local storage isolated from vault notes.

#### Scenario: Configuration persistence across sessions
- **WHEN** a user updates the active provider, Ollama URL, or Gemini API key
- **THEN** the settings are stored in local application storage and restored upon application restart without writing secrets into vault markdown or JSON files.
