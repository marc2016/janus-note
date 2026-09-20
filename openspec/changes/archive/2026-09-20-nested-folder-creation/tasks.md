# Tasks: Nested Folder Creation

## 1. Backend Rust Directory Creation

- [x] 1.1 Implement `vault_create_folder` in `src-tauri/src/vault.rs` with sandboxed path resolution and `fs::create_dir_all`, register the command in `src-tauri/src/lib.rs`, and verify compilation via `cargo check`
- [x] 1.2 Add unit tests in `src-tauri/src/vault.rs` for `vault_create_folder` testing nested path creation, idempotency, and rejection of path traversal (`../`), and verify tests pass with `cargo test`

## 2. Vault Context & API Layer

- [x] 2.1 Expose `createFolder: (path: string) => Promise<void>` in `src/types/vault.ts` and implement it in `src/context/VaultContext.tsx` calling `vault_create_folder` and triggering `refreshFiles()`, and verify clean TypeScript compilation via `npm run build`

## 3. File Explorer UI Controls & Interaction

- [x] 3.1 Add a "New Folder" (`FolderPlus`) button in the File Explorer header in `FileExplorerPanel.tsx` displaying an inline creation form designed 1:1 identically to the note creation form (input, Cancel/Create buttons, autofocus, Enter/Escape handling) and verify folder creation
- [x] 3.2 Support slash notation (e.g. `docs/architecture/adr`) in the folder name input to create multi-level nested folders in a single action, and verify the full tree structure renders correctly

## 4. Integration Verification

- [x] 4.1 Verify interactive folder creation in the running desktop app, confirming both root-level folders, deeply nested subfolders, and immediate file tree synchronization
