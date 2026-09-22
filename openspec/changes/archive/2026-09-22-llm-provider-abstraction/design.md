# Design: LLM Provider Abstraction & AI Configuration

## Context

Janus Note operates as a local-first desktop application using Tauri v2, React 19, and TypeScript. The user interface currently manages open documents through `VaultContext` and `TabBar`, rendering a TipTap Markdown editor in the center canvas. The left sidebar (`FileExplorerPanel`) displays a pinned `Inbox.md` entry alongside the vault file tree.

To support intelligent companion file inspection and generation, Janus Note requires access to Large Language Models. See `proposal.md` for background motivation.

## Goals / Non-Goals

**Goals:**
* Define a lightweight, vendor-agnostic `LlmProvider` interface in TypeScript for streaming, completions, model discovery, and tool calling.
* Implement production-ready adapters for **Ollama** (local-first) and **Google Gemini** (cloud).
* Provide a centralized `LlmService` with an extensible registry pattern to make adding future providers (OpenAI, Anthropic, etc.) trivial.
* Implement a persistent `AiSettingsService` storing endpoint URLs, API keys, and model preferences in application storage.
* Integrate an "AI Config" navigation button in the left sidebar and support virtual tabs (`virtual:ai-config`) that render an interactive configuration canvas (`AiConfigView`) instead of the Markdown editor.

**Non-Goals:**
* Implementing the multi-step ReAct agent decision loop (the abstraction provides the foundation; agent task planning belongs in the Janus Agent panel).
* Vault vector embeddings or RAG pipeline (reserved for a dedicated search/indexing change).
* Vault-level storage of API keys (secrets must never be stored inside vault markdown or files).

## Decisions

### 1. TypeScript Execution Layer with Tauri HTTP
* **Decision:** Implement the LLM provider layer and streaming parsers in TypeScript (`src/services/llm/`) using Fetch / `@tauri-apps/plugin-http`.
* **Rationale:** Streaming 50–100 tokens/sec directly to React avoids continuous Rust-to-Webview IPC serialization overhead. Tool schemas are written in TypeScript, allowing direct typed validation without duplicating definitions in Rust.
* **Alternatives Considered:** Rust-only client via `reqwest` and Tauri event streams. Rejected due to high serialization overhead, repetitive Serde bridging, and harder extension from the frontend.

### 2. Virtual Tab Routing for Settings Views
* **Decision:** Treat configuration and utility panels as virtual tabs identified by a URI prefix (e.g. `virtual:ai-config`) within `TabItem`.
* **Rationale:** Fits naturally into the existing multi-tab workflow and keyboard shortcuts. Users can keep their notes open while switching to settings and back without losing document state or cursor position.
* **Alternatives Considered:** Modal dialogs or drawer overlays. Rejected because configuration often requires copying keys, checking models, or side-by-side reference, which modals unnecessarily obstruct.

### 3. Isolated Global App-Level Settings
* **Decision:** Store AI settings (API keys, endpoints, model selection) in browser `localStorage` or Tauri's app-data directory, completely decoupled from the Vault directory.
* **Rationale:** Vaults in Janus Note are plain folders that users might sync via Git or cloud storage. Isolating credentials prevents accidental exposure of Gemini API keys.
* **Alternatives Considered:** Storing in `.janus/config.json` in the active vault. Rejected due to credential leak risks in version-controlled vaults.

### 4. Normalized Tool Calling and Streaming Contract
* **Decision:** Standardize tool definitions on JSONSchema and normalize streaming chunks into:
  ```typescript
  export interface LlmStreamChunk {
    deltaText?: string;
    deltaToolCalls?: LlmToolCallChunk[];
    finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
    usage?: { promptTokens: number; completionTokens: number };
  }
  ```
* **Rationale:** Ollama (NDJSON) and Gemini (SSE / REST) emit stream chunks differently. Normalizing at the provider adapter boundary ensures all consuming UI components and agent tools remain 100% provider-agnostic.

## Architecture

```text
+--------------------------------------------------------------------------+
|                       Workspace Shell & TabBar                           |
|       (Renders TipTapEditor for notes OR AiConfigView for virtual tabs)  |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|                     AiConfigView & Janus Agent Panel                     |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|                                LlmService                                |
|  - Registry of LlmProvider instances                                     |
|  - Active provider / model resolution                                    |
|  - Settings synchronizer (reads/writes AiSettingsService)                |
+--------------------------------------------------------------------------+
             |                                              |
             v                                              v
+--------------------------+                  +--------------------------+
|      OllamaProvider      |                  |      GeminiProvider      |
| - URL: /api/chat         |                  | - URL: v1beta/models/... |
| - Discovery: /api/tags   |                  | - Auth: x-goog-api-key   |
| - NDJSON stream parser   |                  | - SSE stream parser      |
| - Local tool calling     |                  | - Function declarations  |
+--------------------------+                  +--------------------------+
```

## Risks / Trade-offs

* **[Ollama offline or not running]** → Provide live status detection ("Test Connection" button) and clear error prompts in both the config view and agent panel.
* **[Localhost CORS issues with Ollama]** → If standard browser fetch is blocked by CORS policy, route network requests through `@tauri-apps/plugin-http` which bypasses webview origin restrictions.
* **[Gemini API rate limits / quota exceeded]** → Surface structured error messages with status codes rather than silent stream terminations.
* **[Model-specific tool-calling variance]** → Some local models in Ollama do not support tools; the provider checks or indicates tool capability based on model family.
