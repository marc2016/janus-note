# Tasks: LLM Provider Abstraction & AI Configuration

## 1. LLM Core Types & Contracts

- [x] 1.1 Create `src/services/llm/types.ts` with standardized interfaces for `LlmMessage`, `LlmToolDefinition`, `LlmStreamChunk`, `LlmChatRequest`, `LlmChatResponse`, and `LlmProvider` contract. Verify with TypeScript compilation (`npm run build`).
- [x] 1.2 Define normalized error classes (`LlmError`, `LlmConnectionError`, `LlmAuthError`, `LlmQuotaError`) in `src/services/llm/errors.ts`. Verify unit test imports.

## 2. Ollama Provider Adapter

- [x] 2.1 Implement `OllamaProvider` in `src/services/llm/providers/OllamaProvider.ts` supporting `listModels()` via `/api/tags` and non-streaming `chat()`. Verify with unit test mocking `/api/tags` and `/api/chat`.
- [x] 2.2 Implement NDJSON streaming in `OllamaProvider.chatStream()` translating incremental message chunks and tool calls into `LlmStreamChunk`. Verify with mock stream parser unit tests.
- [x] 2.3 Implement connection ping check (`checkConnection()`) for Ollama to determine reachability. Verify with local fetch test.

## 3. Google Gemini Provider Adapter

- [x] 3.1 Implement `GeminiProvider` in `src/services/llm/providers/GeminiProvider.ts` translating normalized messages to Gemini REST format and mapping function declarations. Verify with unit tests.
- [x] 3.2 Implement SSE/REST streaming in `GeminiProvider.chatStream()` normalizing Gemini response candidates and functionCall parts into `LlmStreamChunk`. Verify with mock streaming unit tests.
- [x] 3.3 Implement API key validation check in `GeminiProvider` to verify valid credentials against Gemini API without charging tokens. Verify with test assertion.

## 4. Settings Service & Central LLM Service

- [x] 4.1 Implement `AiSettingsService` in `src/services/settings/aiSettingsService.ts` managing persistent storage for active provider, Ollama base URL, Gemini API key, and selected model defaults in `localStorage`. Verify persistence with unit tests.
- [x] 4.2 Implement `LlmService` in `src/services/llm/LlmService.ts` acting as the registry and factory for providers, resolving active provider from `AiSettingsService`, and exposing unified `chat()` / `chatStream()` methods. Verify with integration tests.

## 5. Virtual Tab & Workspace Navigation

- [x] 5.1 Extend `types/vault.ts` and `VaultContext.tsx` to support virtual tab entries (`tabType: 'note' | 'virtual'`, with route identifiers such as `virtual:ai-config`). Verify tab switching and closing behaviors.
- [x] 5.2 Add pinned "AI Config" item with icon in `FileExplorerPanel.tsx` beneath the Inbox item, triggering activation of the `virtual:ai-config` tab. Verify visual active state when selected.
- [x] 5.3 Update `TabBar.tsx` to render a distinct settings/sparkle icon for virtual configuration tabs. Verify tab bar rendering.
- [x] 5.4 Update `WorkspaceShell.tsx` center panel to render the configuration view when `activeTabPath === 'virtual:ai-config'` and the TipTap editor when a note is active. Verify view toggling.

## 6. AI Configuration View Component

- [x] 6.1 Create `AiConfigView.tsx` in `src/components/config/AiConfigView.tsx` with provider cards/tabs (Ollama and Gemini) and global default provider selection. Verify layout rendering in center canvas.
- [x] 6.2 Implement Ollama configuration section with base URL input, live "Verbindung testen" button, status badge, and dynamic model dropdown populated from `listModels()`. Verify interactive state changes.
- [x] 6.3 Implement Gemini configuration section with masked API key input (show/hide toggle), model selector dropdown, and "Key prüfen" validation button. Verify user input and masking.
- [x] 6.4 Wire settings changes to `AiSettingsService` and `LlmService` with a success toast or indicator. Verify updated settings persist across tab reload.

## 7. Integration & Verification

- [x] 7.1 Write comprehensive end-to-end integration tests in `src/services/llm/__tests__/llmService.test.ts` verifying provider switching, streaming callbacks, and error handling. Run `npm test`.
- [x] 7.2 Verify full application build via `npm run build` and run test suite with all tests passing.
