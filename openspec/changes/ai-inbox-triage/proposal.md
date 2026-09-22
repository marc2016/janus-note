# Proposal: AI-Powered Default Inbox Triage

## Why

Janus Note features a quick-capture `Inbox.md` for jotting down spontaneous thoughts, ideas, and tasks. However, triaging inbox items currently requires users to manually type destination paths or browse note hierarchies. By making AI triage the default experience, users can file thoughts into their vault hierarchy with zero friction—the AI automatically analyzes the snippet against existing vault notes and proposes the optimal target note, action (create new note vs. append), and reasoning.

## What Changes

- **Default AI Triage Analysis**: When the Triage modal is opened (via `Cmd+Shift+T` or the in-editor "Einsortieren" button), an AI analysis is initiated by default, using the active LLM provider (Ollama or Gemini) and the vault's structure.
- **AI Recommendation Presentation**: The Triage modal displays the AI's suggested target path, suggested mode (`create` new note or `append` to existing note), and brief rationale.
- **One-Click & Keyboard Filing**: Users can accept the AI suggestion immediately via `Enter` or a primary "File with AI" button, or edit the suggested destination inline before filing.
- **Manual Triage Toggle / Fallback**: Users can easily toggle to manual mode, and if no LLM provider/model is configured or available, the modal falls back smoothly to manual triage with a helpful configuration hint.
- **Enhanced Triage Service / Prompting**: Implements a dedicated triage prompt in `aiTriageService` leveraging `vaultService.getTriagePayload()` to generate accurate, context-aware filing decisions.

## Capabilities

### New Capabilities
*(None — builds on existing inbox-triage)*

### Modified Capabilities
- `inbox-triage`: Extends the triage capability with automated AI-assisted destination recommendation as the default flow, including recommendation review, one-click execution, and graceful fallback to manual mode.

## Impact

- **UI Components**: `src/components/editor/TriageModal.tsx` updated with AI recommendation cards, loading spinner/skeletons, one-click acceptance, and manual override toggle.
- **Services**: New `src/services/triage/aiTriageService.ts` utilizing `llmService` and `vaultService.getTriagePayload()` to perform structured LLM inference with JSON output.
- **Tests**: Unit tests for `aiTriageService` and Triage recommendation parsing/fallback logic.
