# Design: Agent Note Modification and Human-in-the-Loop Approval

## Context

See `proposal.md` for motivation. Currently, `JanusAgentPanel` passes only `[Aktive Notiz: title (path)]` without the actual content of the open note or the user's cursor selection in `TipTapEditor`. As a result, the agent has no visibility into what text already exists and defaults to appending new content at the end of the note via `edit_note(mode: 'append')`. Furthermore, `agentGraph.ts` only triggers `pendingApproval` for `create_note` on existing files, leaving `edit_note` replacements and patches unreviewed.

## Goals / Non-Goals

**Goals:**
- Provide active note markdown content and editor text selection in `VaultContext` so `JanusAgentPanel` can pass them to the agent graph.
- Implement `search_and_replace_note` tool and enhance `edit_note` section patching for precise in-place modifications.
- Implement an automated diff generator for file modifications and intercept all destructive or in-place edits (`replace`, `patch`, `search_and_replace`) with `pendingApproval`.
- Render a rich diff preview card (red for deletions, green for additions) with "Genehmigen" and "Ablehnen" buttons in `JanusAgentPanel`.
- Update system instructions to proactively trigger `ask_clarification` whenever editing intent is ambiguous.

**Non-Goals:**
- Direct inline ghost-text rendering inside the TipTap editor canvas (edits remain tool-driven and vault-backed).
- Multi-user collaborative cursor synchronization.

## Decisions

### 1. Editor Selection in VaultContext
- **Decision**: Add `editorSelection: string | null` and `setEditorSelection: (text: string | null) => void` to `VaultContext`. In `TipTapEditor.tsx`, hook into `onSelectionUpdate` to extract `editor.state.doc.textBetween(from, to, '\n')`.
- **Rationale**: Keeps selection state reactive and decoupled. Allows the agent panel to display a selection pill (e.g. "Markiert: 42 Zeichen") and bundle it into prompt context.
- **Alternatives considered**: Passing selection only via button click – rejected because users frequently type queries in the chat input while text remains selected in the editor.

### 2. Context Envelope Construction
- **Decision**: In `JanusAgentPanel.tsx`, construct the prompt envelope:
  ```text
  [Aktive Notiz im Editor: "<title>" (<path>)]
  [Notizinhalt:]
  <content (truncated at 25k chars if necessary)>
  [Aktuell im Editor markierter Textauszug:]
  <selectedText>
  <userPrompt>
  ```
- **Rationale**: Gives the agent complete awareness of the note's structure and the exact passage the user wants to refine, without requiring extra round-trip `read_note` tool calls.

### 3. In-Place Note Modification Tools
- **Decision**: 
  - Enhance `edit_note` with reliable section heading replacement.
  - Add `search_and_replace_note` taking `{ path, searchString, replacement }`. If `searchString` matches exactly once, replace it; if ambiguous (0 or >1 matches), return a descriptive error.
- **Rationale**: Users often want to change a single sentence or bullet point. A targeted search-and-replace prevents rewriting entire large notes.

### 4. Diff Generation & Approval Interception
- **Decision**:
  - Implement a lightweight line diff generator `generateSimpleDiff(oldText, newText)` producing unified diff format (`--- a/...`, `+++ b/...`, `- oldLine`, `+ newLine`).
  - In `agentGraph.ts`, intercept `edit_note` (when mode is `replace` or `patch`) and `search_and_replace_note`, computing the proposed content and diff, and setting `pendingApproval`.
  - In `JanusAgentPanel.tsx`, style lines starting with `-` as rose (`text-rose-400 bg-rose-500/10`) and `+` as emerald (`text-emerald-400 bg-emerald-500/10`).
- **Rationale**: Builds trust and safety; users can inspect the exact lines changing before confirming.

### 5. System Instructions for Clarification
- **Decision**: Update `SYSTEM_INSTRUCTION` in `agentGraph.ts` to instruct the agent to use `ask_clarification` with quick-reply options (e.g. `['Bestehenden Text ersetzen', 'Abschnitt aktualisieren', 'Am Ende anfügen']`) when user requests do not specify where or how to apply changes.
- **Rationale**: Prevents unsolicited overwrites when user intent could simply be taking an additional note.

## Risks / Trade-offs

- **[Risk] High token consumption for very large notes** → *Mitigation*: Cap injected note content at 25,000 characters, prioritizing the selected text.
- **[Risk] Multiple identical substrings during search-and-replace** → *Mitigation*: Require sufficient context in `searchString` to make the match unique, or fallback to section patching.
- **[Risk] TipTap editor overwriting external agent edits on re-focus** → *Mitigation*: Existing `contentVersion` increment in `VaultContext` already forces TipTap to refresh its document state when the agent writes to the file.
