# Design: Nested Folder Creation

## Context

Janus Note uses a Tauri v2 backend with a local Rust sandbox (`validate_and_resolve_path`) ensuring all file operations stay within the selected Vault root. While `vault_write_file` implicitly creates parent directories when writing a note, there is currently no dedicated command or UI workflow to create empty directories or nested folder trees.

See `proposal.md` for motivation and `specs/` for capability deltas.

## Goals / Non-Goals

**Goals:**
- Provide a secure Rust backend command `vault_create_folder` that canonicalizes and validates paths before creating directories via `fs::create_dir_all`.
- Expose `createFolder(path: string)` in `VaultContext`.
- Add folder creation UI in `FileExplorerPanel` that **matches the existing file creation UI 1:1**:
  - A `FolderPlus` button in the explorer header adjacent to `Plus` (New Note) and `RotateCw` (Refresh).
  - An identical inline input form in the sidebar with autofocus, placeholder (e.g. `Folder name (e.g. docs/architecture)`), Enter/Escape handling, and matching `Cancel` and `Create` action buttons.
  - Full slash-separated path support (e.g. `projects/janus/specs`) to create arbitrarily nested subdirectories in a single operation.
- Automatically refresh the file tree and display newly created directory structures.

**Non-Goals:**
- Drag-and-drop moving of files between folders (deferred to future change).
- Renaming, deleting, or trashing folders (deferred to future change).
- Custom folder colors, tags, or icons.

## Decisions

### 1. Tauri Backend Command `vault_create_folder`
- **Choice**: Implement `vault_create_folder(path: String, state: State<'_, VaultState>) -> Result<(), String>`.
- **Rationale**: Reuses `validate_and_resolve_path` to guarantee sandbox containment and prevent traversal attacks (`..`). Calls `std::fs::create_dir_all(&target_dir)` which is idempotent (succeeds without error if the directory already exists).
- **Alternative considered**: Relying solely on `vault_write_file` with a dummy `.gitkeep` file. Rejected because users expect clean empty folders without artifact files.

### 2. UI Form Parity with File Creation Form
- **Choice**: The folder creation UI strictly mirrors the existing file creation form in `FileExplorerPanel.tsx`.
- **Rationale**: Keeps the interface cohesive, predictable, and clean without introducing disjointed modal dialogs or intrusive popups.
- **Form Structure**:
  - Header trigger: `FolderPlus` icon next to `Plus` in the header action bar.
  - Inline container: `px-3 py-1.5 flex-shrink-0 bg-surface/40`.
  - Input: `w-full bg-surface border border-accent rounded px-2 py-1 text-xs text-text-primary focus:outline-none` with placeholder `Folder name (e.g. docs/specs)`.
  - Action footer: `Cancel` (`px-2 py-0.5 text-text-muted hover:text-text-primary`) and `Create` (`px-2 py-0.5 bg-accent text-white rounded hover:bg-accent-hover font-medium`).
  - Keyboard handling: `Enter` to submit, `Escape` to cancel.

### 3. Path Input & Slash Notation for Arbitrary Nesting
- **Choice**: The folder creation input accepts relative paths with forward slashes (e.g. `archive/2026/reports`).
- **Rationale**: Users can create single folders (`notes`) or arbitrarily deep nested hierarchies (`projects/janus/frontend/components`) in one straightforward input submission.

### 4. Tree Expansion & Synchronization
- **Choice**: Invoke `refreshFiles()` immediately after `vault_create_folder` resolves so the UI renders the new folder immediately without waiting on file watcher debouncing.

## Risks / Trade-offs

- **[Filesystem character compatibility]** → Input trimmed and basic sanitization to prevent invalid OS characters.
- **[Watcher debounce timing]** → Explicitly invoke `refreshFiles()` immediately after the `vault_create_folder` command resolves.
