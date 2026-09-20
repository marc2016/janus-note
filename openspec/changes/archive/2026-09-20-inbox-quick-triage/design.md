# Design: Inbox Quick Capture & Triage

## Context

Janus Note uses a local-first sandboxed Vault managed by a Tauri/Rust core and a React 19 frontend. Currently, all notes are created as regular files in the file explorer tree without a dedicated scratchpad or triage system. 

To enable zero-friction note capture and preparation for the Janus AI Copilot, we need a permanent, un-deletable `Inbox.md` document and a fast triage interface to relocate thoughts into structured notes or folders.

## Goals / Non-Goals

**Goals:**
* Ensure `Inbox.md` is always present at the Vault root, automatically initialized if absent.
* Protect `Inbox.md` against accidental deletion or renaming at both the UI and Rust backend levels.
* Display a pinned Inbox item at the top of the File Explorer sidebar for immediate 1-click access.
* Provide a keyboard shortcut (`Cmd+Shift+I` / `Ctrl+Shift+I`) to instantly open and focus `Inbox.md`.
* Provide a dedicated Triage dialog when viewing `Inbox.md` (or on selected text) to relocate snippets into:
  * An existing note (appending with optional header).
  * A brand-new note in a newly created directory structure (e.g., `projects/janus/architecture.md`).
* Safely remove triaged snippets from `Inbox.md` upon confirmation (Inbox Zero workflow).
* Define the structured context schema ready for LLM triage dispatch in Phase 2.

**Non-Goals:**
* Executing live LLM network calls or embedding models in this initial phase (Phase 1 establishes the structural and manual triage workflow; Phase 2 connects the LLM agent).
* Multi-inbox support (single canonical `Inbox.md` per Vault).

## Decisions

### 1. Root-Level `Inbox.md` vs Hidden Directory
* **Decision**: Place `Inbox.md` directly at the Vault root.
* **Rationale**: Maintains transparency, local-first portability, and interoperability with other markdown editors (Obsidian, VS Code, Logseq) without hiding thoughts in proprietary config folders.
* **Alternatives considered**: `.janus/inbox.md` (rejected: hides user notes from standard filesystem browsing and external backup tools).

### 2. Deletion & Relocation Protection
* **Decision**: Enforce protection both in frontend UI (disable delete/move actions) and in Rust (`vault.rs`).
* **Rationale**: Backend validation in `vault_delete_item` and `vault_move_item` guarantees that `Inbox.md` cannot be destroyed or moved even if an API call is made directly.
* **Alternatives considered**: Frontend-only check (rejected: insecure and prone to edge-case deletions).

### 3. Dedicated Pinned Explorer Entry
* **Decision**: Filter out `Inbox.md` from the regular hierarchical tree in `FileExplorerPanel` and render it as a distinct, styled "Pinned Inbox" row above the file list.
* **Rationale**: Keeps the inbox permanently visible regardless of how deep the user scrolls or how many nested folders are expanded, emphasizing its role as the primary capture surface.

### 4. Triage Dialog Architecture & UI Entry Points
* **Decision**: Implement a reusable `TriageModal` component accessible through multiple discoverable channels:
  1. **Inbox Action Banner**: A prominent amber banner displayed directly below the formatting toolbar in `TipTapEditor.tsx` whenever `Inbox.md` is the active note, featuring an explicit "Einsortieren" button with keyboard hint (`⌘⇧T`).
  2. **Tab Bar Action**: An amber triage button embedded directly in `TabBar.tsx` for quick access.
  3. **Global Shortcut**: `Cmd+Shift+T` / `Ctrl+Shift+T` available while `Inbox.md` is active.
* **Flow**:
  1. Captures either the active text selection or the entire `Inbox.md` content.
  2. Offers an autocompleting list of existing vault notes OR an input field for a new path.
  3. If a new path is specified (e.g., `archive/2026/note.md`), leverages existing nested directory creation capabilities.
  4. Updates the target note atomically, removes the text from `Inbox.md`, and updates active editor tabs.
* **Immediate In-Editor Buffer Refresh (`contentVersion`)**:
  * Normally, TipTapEditor caches editor content per open tab to prevent resetting cursor position during unrelated re-renders.
  * To immediately reflect the removed snippet in `Inbox.md` without requiring the user to switch tabs or reload, `TabItem` tracks a `contentVersion: number` counter.
  * When `triageContent()` writes the updated note to disk, it increments `contentVersion` for the affected tab(s). TipTapEditor includes `activeTab?.contentVersion` in its synchronization effect dependencies, causing an immediate, seamless editor content reload.

```
+-------------------------------------------------------------+
|                      TipTap Editor                          |
|  [B] [I] [H1] [H2] ... Formatting Toolbar                   |
|  [⚡ Quick-capture Inbox]                   [ Einsortieren ⌘⇧T]
+-------------------------------------------------------------+
|                      Inbox.md Buffer                        |
|   "## Project Alpha                                         |
|    Need to schedule kickoff with team..."                   |
+-------------------------------------------------------------+
                              |
                              | [Einsortieren / Cmd+Shift+T]
                              v
+-------------------------------------------------------------+
|                        Triage Modal                         |
|   [x] Selected: "## Project Alpha..."                       |
|   Destination: [ projects/alpha/kickoff.md                ] |
|   Action: (•) Create New Note   ( ) Append to Existing      |
|   [ Cancel ]                              [ Move & Clean ]  |
+-------------------------------------------------------------+
                              |
                 +------------+------------+
                 |                         |
                 v                         v
       [Target Created / Updated]   [Inbox Cleaned & contentVersion++]
                                           |
                                           v
                                [TipTap Editor Reloads Live]
```

### 5. Schema for Future AI Triage Dispatch
* **Decision**: The triage service will expose a `getTriagePayload()` function returning:
  ```json
  {
    "inboxContent": "...",
    "vaultTree": [
      { "path": "notes/daily.md", "isDir": false },
      { "path": "projects/janus", "isDir": true }
    ]
  }
  ```
* **Rationale**: Decouples the UI and filesystem extraction from the specific LLM provider or prompting strategy in Phase 2.

## Risks / Trade-offs

* **Risk**: Concurrent edits in `Inbox.md` while triage modal is open leading to text conflict.
  * **Mitigation**: When applying triage, replace only the exact triaged snippet from current `Inbox.md` content, or append any un-triaged lines cleanly.
* **Risk**: Creating new folders with invalid filesystem characters.
  * **Mitigation**: Reuse existing path validation and sandboxing logic in `vault.rs`.
