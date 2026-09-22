# Tasks: Agent Note Modification and Human-in-the-Loop Approval

## 1. Editor Selection & Vault Context

- [x] 1.1 Add `editorSelection` state and `setEditorSelection` callback to `VaultContext.tsx` and verify with unit tests
- [x] 1.2 Connect `TipTapEditor.tsx` selection changes (`onSelectionUpdate`) to sync highlighted text into `VaultContext`

## 2. Granular Note Editing Tools

- [x] 2.1 Enhance section-level patching in `editNoteTool` in `src/services/agent/tools/noteTools.ts` to cleanly replace headings and subsection bodies
- [x] 2.2 Implement `search_and_replace_note` in `src/services/agent/tools/noteTools.ts` with strict unique-occurrence matching
- [x] 2.3 Add unit tests in `src/services/agent/tools/noteTools.test.ts` verifying section patching and search-and-replace behavior

## 3. Diff Generation & Graph Interception

- [x] 3.1 Implement a line-based diff utility (`generateUnifiedDiff`) that produces structured additions and deletions
- [x] 3.2 Intercept `edit_note` (`replace` / `patch`) and `search_and_replace_note` in `src/services/agent/agentGraph.ts` to generate diffs and pause for approval
- [x] 3.3 Update `SYSTEM_INSTRUCTION` in `src/services/agent/agentGraph.ts` to enforce proactive `ask_clarification` calls when editing scope is ambiguous
- [x] 3.4 Update `agentGraph.test.ts` to verify diff generation and approval checkpoints for in-place modifications

## 4. UI Presentation in JanusAgentPanel

- [x] 4.1 Update `JanusAgentPanel.tsx` context header to display an active selection badge when text is selected in the editor
- [x] 4.2 Enhance prompt envelope in `JanusAgentPanel.tsx` to include current note content and editor selection
- [x] 4.3 Upgrade Diff Approval Card in `JanusAgentPanel.tsx` to render syntax-colored unified diff lines (red deletions and green additions)

## 5. Verification & Testing

- [x] 5.1 Run test suite with `npm run test` and verify that all unit and agent graph tests pass
- [x] 5.2 Run `npm run build` to ensure type-checking and bundling succeed with zero errors
