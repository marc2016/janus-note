# Proposal: Agent Note Modification and Human-in-the-Loop Approval

## Why

Currently, the Janus AI agent defaults to appending content to the end of notes and lacks full visibility into the active note's content and editor text selection. When users request edits, rewrites, or section updates, the agent either appends duplicate content or cannot perform precise in-place modifications, and destructive modifications occur without presenting a side-by-side diff preview for user approval.

This change introduces active document context streaming (full content and text selection), granular note modification tools (`patch` section and `search_and_replace_note`), and automatic human-in-the-loop interruption with diff previews before any existing text is overwritten or altered.

## What Changes

- **Active Note & Editor Selection Context**: Feed the active note's full text content and any active text selection from `TipTapEditor` into `VaultContext` and the agent's prompt context, accompanied by a visual selection indicator in the agent panel.
- **In-Place Note Editing Tools**: Enhance `edit_note` to reliably patch specific sections and add `search_and_replace_note` to replace targeted passages without rewriting whole files.
- **Proactive Clarification on Ambiguous Edits**: Guide the agent to call `ask_clarification` with quick-reply buttons (e.g. replace, patch section, or append) when user instructions are ambiguous.
- **Diff Preview & Approval Interruption**: Trigger human-in-the-loop pause and present a red/green Diff preview card in `JanusAgentPanel` whenever the agent proposes overwriting, replacing, or patching existing note content, requiring explicit user approval before changes are committed to disk.

## Capabilities

### Modified Capabilities
- `agent-orchestrator`: Enhance note modification tools with section-level patching and search-and-replace, inject active note content and editor text selection into agent context, and enforce human-in-the-loop diff approval cards before applying in-place text modifications.

## Impact

- **UI Components**: `TipTapEditor` tracks text selection in `VaultContext`; `JanusAgentPanel` displays selection pill and styled diff preview cards (`+` green / `-` red).
- **Agent Tools & Graph**: `src/services/agent/tools/noteTools.ts` gains `search_and_replace_note` and robust section patching; `src/services/agent/agentGraph.ts` intercepts all replacement/patching tool calls for user confirmation.
- **APIs & State**: `VaultContext` exposes `editorSelection` and selection updates.
