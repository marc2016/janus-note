# Proposal

## Why

Note-taking applications often create cognitive friction when a user has a quick thought, task, or meeting snippet and must first decide where to file it before writing. 

Janus Note aims to provide a frictionless quick-capture experience through a permanent, un-deletable `Inbox.md` file, accompanied by a single-click triage mechanism. Users can jot down unstructured thoughts immediately and later sort them into appropriate folders or notes—either creating new files/directories on the fly or appending to existing ones. This foundational capability establishes the manual and structural pipeline, preparing the system for intelligent AI-driven triage (Janus Copilot) in subsequent iterations.

## What Changes

* **Permanent Protected Inbox File**: A dedicated `Inbox.md` note is automatically verified and created at the Vault root. It is marked as a protected system file that cannot be deleted or renamed via the UI or backend file operations.
* **Pinned Inbox Navigation**: The File Explorer displays a prominent pinned `Inbox` shortcut at the very top of the left sidebar, ensuring instant access regardless of scroll depth or folder hierarchy.
* **Triage & Filing Action (Manual Foundation)**:
  * When viewing `Inbox.md`, a prominent **Action Banner** in the editor provides an explicit **"Einsortieren"** button (alongside the `⌘⇧T` keyboard shortcut and tab bar action) to eliminate cognitive barrier for users unfamiliar with shortcuts.
  * When text is selected, the triage action focuses on that snippet; otherwise it targets the entire inbox content.
  * A modal/dialog prompts the user to select an existing target note or specify a new note path (which automatically creates intermediate directories if they do not exist).
  * The user can choose to append the content to an existing note or create a new note, safely removing the filed snippet from `Inbox.md` upon confirmation (Inbox Zero).
  * The active editor immediately updates in-place without requiring the user to switch tabs or reload.
* **AI Triage Preparation (Architecture)**:
  * Prepares structured data extraction (vault directory tree + inbox content) and defines the contract for the future LLM-based triage assistant to propose file placements and directory creation automatically.

## Capabilities

### New Capabilities
- `inbox-triage`: Introduces the permanent, protected Inbox document, pinned quick-capture navigation, manual extraction and filing mechanisms into existing or newly created paths, and the schema for AI-assisted classification.

### Modified Capabilities
- `vault-core`: Enhances deletion and rename security rules to enforce system file protection for `Inbox.md`.

## Impact

- **Rust Backend (`src-tauri/src/vault.rs`)**: Adds file protection validation to prevent deletion/renaming of `Inbox.md`, and ensures `Inbox.md` is initialized on vault open.
- **Frontend State & Services (`src/context/VaultContext.tsx`, `src/services/vaultService.ts`)**: Exposes inbox presence, quick navigation, and the triage/relocation workflow.
- **UI Components**:
  - `src/components/sidebar/FileExplorerPanel.tsx`: Renders the pinned Inbox item at the top.
  - `src/components/editor/TipTapEditor.tsx` / `WindowHeader.tsx`: Adds the Triage action button and Triage modal dialog.
