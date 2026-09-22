# Design: AI-Powered Default Inbox Triage

## Context

Janus Note already provisions a quick-capture `Inbox.md` and provides `vaultService.getTriagePayload()` (returning `inboxContent` and flattened `vaultTree`). It also has a multi-provider `llmService` (supporting Ollama and Gemini). However, `TriageModal.tsx` currently requires manual path typing and mode selection. This design introduces an autonomous triage classification service and integrates it as the default view in `TriageModal.tsx`.

## Goals / Non-Goals

**Goals:**
- Provide instantaneous AI classification upon opening the Triage dialog.
- Propose target note path, action mode (`create` vs `append`), and a concise explanation.
- Enable 1-click or single-keypress (`Enter`) filing of the recommendation.
- Allow frictionless manual editing or switching to manual mode.
- Fail gracefully with clear fallbacks when no LLM is configured or when offline.

**Non-Goals:**
- Autonomous background triage without user confirmation (the user must always review and approve before content is moved).
- Multi-note batch triage in a single dialog (each triage action remains focused on the snippet or current Inbox).

## Decisions

### 1. Dedicated `AiTriageService` with Structured JSON Prompting
- **Decision**: Create `src/services/triage/aiTriageService.ts` utilizing `llmService.getProvider().chat()` with a system prompt optimized for file classification and strict JSON schema output.
- **Alternatives Considered**:
  - *Using the full LangGraph agent graph*: Too heavy and slow for a quick modal interaction; requires multi-turn tool execution. A direct single-shot prompt to `llmService` returns in ~500ms to 1s with minimal token overhead.
  - *Client-side heuristic matching (keyword/fuzzy search)*: Lacks semantic understanding of context (e.g. knowing that a snippet about "budgeting" belongs in "finance/quarterly-plan.md").

### 2. Default AI Mode in `TriageModal.tsx` with Pre-filled Manual Controls
- **Decision**: Make AI the default view. When the modal opens, trigger `aiTriageService.suggestTriage()`. Once resolved, pre-populate the destination path and mode controls while presenting the recommendation card.
- **Alternatives Considered**:
  - *Having an "Analyze with AI" button that the user must click*: Adds unnecessary friction. The user explicitly requested AI triage to be default.
  - *Hiding manual inputs completely*: Too restrictive. Pre-filling the manual inputs gives the user immediate visual feedback and the ability to tweak the recommendation with zero clicks.

### 3. Resilient JSON Extraction
- **Decision**: Parse JSON using a resilient regex extractor that handles raw JSON, markdown-fenced code blocks (` ```json ... ``` `), and leading/trailing chatter.
- **Alternatives Considered**: Strict `JSON.parse` only (frequently fails on local Ollama models that prepend conversational greetings).

## Risks / Trade-offs

- **[Risk]** Local LLM (Ollama) may take 1-3 seconds to respond.
  - → **Mitigation**: Show an attractive shimmer/skeleton loader while AI thinks, with an immediate "Switch to manual" button so the user is never blocked.
- **[Risk]** LLM might suggest an invalid path (e.g. empty or containing illegal filesystem characters).
  - → **Mitigation**: Sanitize suggested paths with path normalization (`replace(/^\/+/, '')`, strip illegal characters, ensure `.md` extension).
- **[Risk]** LLM recommends appending to a file that does not exist.
  - → **Mitigation**: Cross-check against `vaultTree`. If the file does not exist, adjust mode to `create`.
