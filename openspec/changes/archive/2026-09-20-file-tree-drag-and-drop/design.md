# Design: File and Folder Drag-and-Drop with Multi-Selection in File Explorer

## Context

The Janus Note desktop workspace consists of a React/TypeScript frontend inside a Tauri v2 shell backed by Rust. The left sidebar hosts `FileExplorerPanel`, which renders the Vault file tree as recursive `TreeNode` components.

Currently, paths are managed locally in `src-tauri/src/vault.rs` through `validate_and_resolve_path`, but no backend command or frontend handlers exist to move or relocate existing files and directories. When files change on disk, `VaultContext` receives watcher events, but manual reorganization and multi-selection inside the UI are unsupported.

## Goals / Non-Goals

**Goals:**
- Support multi-selection in the File Explorer via standard desktop conventions:
  - Plain click: exclusive selection (and opens note if clicked node is a file).
  - Cmd/Ctrl + click: toggle individual items in and out of the multi-selection.
  - Shift + click: continuous range selection between the anchor node and the clicked node.
- Enable moving single and multiple selected files and directory trees by dragging them onto target folder nodes or into the Vault root drop zone.
- Display clear visual feedback during drag operations:
  - Highlight valid target folders with border and background styling.
  - Display a count badge (e.g. "3 items") on the drag preview when dragging multiple items.
- Guarantee security and filesystem integrity in Rust through strict vault boundary verification, anti-collision checks, and cycle prevention (cannot move any directory into itself or its descendants).
- Seamlessly update open tabs and active editor state when open files (or files within moved folders) are relocated.
- Maintain full parity between the desktop Tauri environment and the in-browser mock development environment.

**Non-Goals:**
- Dragging files into the markdown editor to create links or attachments (editor capability).
- Dragging files from the operating system's external file manager (Finder / File Explorer) into the app.
- Drag-and-drop manual reordering of files within the same directory (the tree is sorted alphabetically with directories first).

## Decisions

### 1. Multi-Selection State Management
- **Decision**: Manage selection state (`selectedPaths: Set<string>` and `lastSelectedPath: string | null`) in `VaultContext` (or local explorer state shared via context).
- **Click Behavior**:
  - `e.metaKey || e.ctrlKey`: Toggle `node.path` in `selectedPaths`. Update `lastSelectedPath`.
  - `e.shiftKey`: Flatten visible nodes in `fileTree` into an array, find indices of `lastSelectedPath` and current `node.path`, and add all intermediate visible paths to `selectedPaths`.
  - No modifiers: Reset `selectedPaths` to `{ node.path }`. If the node is a markdown file, open the note in an editor tab.
- **Visual Presentation**:
  - Nodes in `selectedPaths` render with an active selection highlight (`bg-accent/20 text-accent border border-accent/30` or equivalent subtle styling), distinct from unselected hover state.

### 2. Native HTML5 Drag and Drop with Batch Payload
- **Decision**: Use standard HTML5 drag-and-drop events (`draggable`, `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`) directly in React.
- **Drag Start Logic**:
  - When dragging starts on a node:
    - If the node is already in `selectedPaths`, drag ALL items in `selectedPaths`.
    - If the node is NOT in `selectedPaths`, reset selection to just this node and drag it.
  - Set `e.dataTransfer.setData('application/x-janus-nodes', JSON.stringify(Array.from(effectivePaths)))`.
  - When dragging multiple items, render a lightweight drag ghost element containing a badge with the count (e.g., `3 items`) and call `e.dataTransfer.setDragImage(ghostElement, 0, 0)`.

### 3. Rust Backend Command: `vault_move_paths`
- **Decision**: Provide a batch Tauri command `vault_move_paths(source_paths: Vec<String>, destination_folder: String) -> Result<Vec<String>, String>`.
- **Validation Pipeline**:
  - `destination_folder` is the relative folder path (empty string `""` represents vault root).
  - For each `source_path`:
    - Compute destination path: `destination_folder / basename(source_path)`.
    - If source equals destination (dropping item into its own parent folder), skip as no-op.
    - Check that both source and destination stay strictly within `vault_root` via `validate_and_resolve_path`.
    - Check destination existence: If destination already exists, return a collision error to prevent silent data loss.
    - Cycle detection: If `source_path` is a directory, ensure destination canonical path does not start with source canonical path.
  - If all pre-flight checks pass:
    - Execute atomic `fs::rename(source, destination)` for each item.
    - Return list of successfully moved destination paths.

### 4. Tab State Synchronization in `VaultContext`
- **Decision**: When `moveItems(sourcePaths, destFolder)` succeeds, recalculate paths for all open tabs in `openTabs`:
  - For each moved item:
    - If single file: update any tab matching `tab.path === sourcePath` to `newPath`.
    - If directory: update any tab where `tab.path.startsWith(sourcePath + '/')` by replacing the prefix with `${newPath}/`.
    - Update `activeTabPath` synchronously if the currently focused tab was affected.
- **Rationale**: Keeps open tabs in sync immediately without waiting for watcher events and preserves dirty buffer edits.

## Risks / Trade-offs

- **[Risk]** Multi-item drop with one invalid item (e.g. collision or cycle) could leave filesystem in a half-moved state.
  - **Mitigation**: Perform comprehensive pre-flight verification on all paths in Rust before executing any `fs::rename`. If any path is invalid (cycle or collision), reject the entire batch before modifying disk.
- **[Risk]** Large range selection with Shift-click selecting collapsed subfolder children unexpectedly.
  - **Mitigation**: Range selection only iterates over currently visible (expanded) nodes in the tree view, matching native file explorer expectations.
- **[Risk]** Accidental selection clearing when dragging.
  - **Mitigation**: Do not reset multi-selection in `onMouseDown` if the mouse is pressed over an already-selected item; defer deselection until `onClick` if no drag occurs.
