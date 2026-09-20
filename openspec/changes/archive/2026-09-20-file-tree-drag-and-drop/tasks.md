# Tasks

## 1. Rust Backend Batch Move & Security Tests

- [x] 1.1 Implement `move_paths_impl` and Tauri command `vault_move_paths` in `src-tauri/src/vault.rs` with pre-flight path validation, cycle detection across all input folders, destination collision detection, and atomic renaming.
- [x] 1.2 Register `vault_move_paths` in `src-tauri/src/lib.rs` invoke handlers.
- [x] 1.3 Add Rust unit tests in `src-tauri/src/vault.rs` verifying batch file moves, directory moves, root relocation, cycle prevention, path traversal rejection, and destination collision aborts. Verify with `cargo test`.

## 2. Vault Service & Mock Environment

- [x] 2.1 Add `movePaths(sourcePaths: string[], destinationFolder: string)` to `src/services/vaultService.ts` calling Tauri command in desktop mode and performing batch key remapping in browser `mockStorage`.
- [x] 2.2 Add unit test cases in `src/services/vaultService.test.ts` verifying batch file and folder relocation in the mock environment. Verify with `npm test`.

## 3. Vault Context & Tab Synchronization

- [x] 3.1 Add multi-selection state management (`selectedPaths`, `setSelectedPaths`, `lastSelectedPath`) and `moveSelectedItems(sourcePaths: string[], destinationFolder: string)` in `src/context/VaultContext.tsx`.
- [x] 3.2 Implement batch tab path synchronization in `VaultContext.tsx` to update all open tabs matching moved files or nested inside moved directories.
- [x] 3.3 Expose selection actions and handle move error reporting gracefully in the UI.

## 4. File Explorer Multi-Selection & Drag-and-Drop UI

- [x] 4.1 Implement multi-selection handlers in `FileExplorerPanel.tsx` and `TreeNode` supporting Cmd/Ctrl + click (toggle) and Shift + click (range selection across visible nodes).
- [x] 4.2 Update `TreeNode` drag handlers to serialize all selected paths into `application/x-janus-nodes` and display a custom drag preview count badge when dragging multiple items.
- [x] 4.3 Add dragover and drop handlers on folders and root drop zone with visual target highlights and pre-flight cycle validation.
- [x] 4.4 Verify application build with `npm run build` and validate multi-selection and batch drag-and-drop interactions across files and directories.
