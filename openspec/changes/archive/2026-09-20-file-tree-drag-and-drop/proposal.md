# Proposal: File and Folder Drag-and-Drop with Multi-Selection in File Explorer

## Why

Currently, users can create nested folders and notes in the Janus Note File Explorer, but cannot reorganize them afterwards or select multiple items at once. Providing multi-selection (via Cmd/Ctrl-click and Shift-click) and intuitive HTML5 drag-and-drop support directly in the File Explorer sidebar allows users to efficiently organize batches of notes and folders into nested directory structures, significantly improving workspace management and desktop ergonomics.

## What Changes

- Add multi-selection support in the File Explorer:
  - Select individual nodes with standard clicks.
  - Multi-select arbitrary nodes via Cmd/Ctrl + click.
  - Range-select nodes via Shift + click.
  - Clear selection when clicking outside or selecting a single item without modifier keys.
- Add multi-item drag-and-drop:
  - Dragging any item within an active multi-selection moves all selected items together.
  - Drag preview indicates the count of items being relocated (e.g. "3 items").
  - Dragging an unselected item selects and drags only that item.
- Add secure path movement commands in the Tauri Rust backend (`vault_move_paths` and `vault_move_path`):
  - Strict sandboxing ensuring all sources and destinations stay inside the active vault root.
  - Pre-flight cycle detection across all selected folders (cannot move a directory into itself or into any child/descendant).
  - Collision checks to prevent accidental overwriting of existing target files or directories.
- Add support in `vaultService` for batch path moving in both Tauri desktop and browser mock environments.
- Update `VaultContext` to coordinate batch path relocation, manage multi-selection state, and synchronize open tabs and `activeTabPath` for all moved notes.
- Enhance `FileExplorerPanel` and `TreeNode` with selection styling, keyboard modifier handlers, drop target highlights, and root drop zone support.

## Capabilities

### Modified Capabilities

- `vault-core`: Introduce requirements and scenarios for moving individual and multiple files/directories within the vault with sandboxing, cycle prevention, and collision safeguards.
- `workspace-layout`: Extend directory tree navigation with multi-selection mechanics (Cmd/Ctrl + click, Shift + click) and multi-item drag-and-drop reorganization into destination folders or vault root.

## Impact

- **Backend (`src-tauri/src/vault.rs`, `src-tauri/src/lib.rs`)**: New `vault_move_paths` command and batch relocation logic with unit test coverage.
- **Frontend Services (`src/services/vaultService.ts`)**: New `movePaths(sourcePaths: string[], destinationFolder: string)` API method with browser mock support.
- **Frontend State (`src/context/VaultContext.tsx`)**: Multi-selection state management (`selectedPaths`), `moveSelectedItems(destinationFolder: string)`, and batch tab path updates.
- **Frontend UI (`src/components/sidebar/FileExplorerPanel.tsx`)**: Selection keyboard listeners (Cmd/Ctrl, Shift), multi-drag preview, drop target highlights, and pre-flight validation.
