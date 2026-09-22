# Proposal: LLM Provider Abstraction & AI Configuration

## Why

Janus Note's core concept unites human note-taking with an embedded machine-operable AI assistant that interacts with structured companion files. Currently, there is no standardized way to connect different LLM backends (such as local-first Ollama instances or cloud-based Google Gemini), nor is there any user interface to configure API keys, endpoints, or active models.

Introducing an extensible LLM provider abstraction allows Janus Note to remain privacy-first and model-agnostic, supporting offline local models out-of-the-box via Ollama while simultaneously supporting cloud providers like Gemini and future adapters (OpenAI, Anthropic, etc.). Providing an accessible, dedicated AI configuration tab in the UI gives users full control over their models, credentials, and connectivity.

## What Changes

* **Unified LLM Provider Abstraction (`src/services/llm/`):**
  * Core `LlmProvider` interface defining standardized chat completion, streaming (`AsyncIterable<LlmStreamChunk>`), tool/function calling (`LlmToolDefinition`), and model catalog discovery.
  * **Ollama Provider (`OllamaProvider`):** Localhost HTTP adapter (`http://localhost:11434`), dynamic model discovery via `/api/tags`, streaming NDJSON parser, and native tool-calling support.
  * **Google Gemini Provider (`GeminiProvider`):** Cloud REST/SDK adapter, API key authentication, model listing/selection, streaming SSE parser, and function calling translation.
  * **Central LLM Service (`LlmService`):** Provider registry, active model/provider selection, and agent execution loop utilities.
* **Persistent AI Configuration Store (`src/services/settings/`):**
  * Storage for global AI settings (endpoints, API keys, active provider, model selections) in local application storage (`localStorage` / app config), ensuring keys are never leaked into user vault notes.
* **Dedicated AI Config View & Virtual Tab Navigation:**
  * Pinned **AI Config** navigation entry in `FileExplorerPanel` directly under the pinned Inbox item with a dedicated icon.
  * Virtual tab support in `TabBar` and `WorkspaceShell` (`virtual:ai-config`), enabling the center canvas to render the interactive `AiConfigView` instead of the Markdown editor.
  * Interactive settings UI: Ollama connection test & model refresh button, Gemini API key input with show/hide password masking, and default model pickers.

## Capabilities

### New Capabilities
- `llm-provider`: Core provider interface, normalization for messages, streaming chunks, tool calls, model discovery, and adapter implementations for Ollama and Gemini.

### Modified Capabilities
- `workspace-layout`: Extend sidebar with pinned AI Config entry and enhance center panel tab management to support non-file virtual tabs (e.g. `virtual:ai-config`) rendering dedicated configuration interfaces.

## Impact

* **Frontend architecture:** Introduces `src/services/llm/` and `src/components/config/AiConfigView.tsx`.
* **State / Context:** Extends `VaultContext` or tab management to distinguish between file notes and virtual utility views (`virtual:ai-config`).
* **Dependencies:** Uses `@tauri-apps/plugin-http` or native fetch for CORS-free local and remote network calls.
* **Security & Privacy:** API keys and local URLs stored strictly in app-level settings, not in markdown notes.
