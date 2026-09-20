# Proposal: Nested Folder Creation

## Why

Currently, Janus Note allows viewing hierarchical folder structures in the File Explorer and creating notes at the root level, but users cannot create folders directly within the interface. To organize knowledge bases, notes, and companion data into structured taxonomies (e.g. `projects/janus/specs/`), users need the ability to create folders and arbitrarily nested subfolders directly from the File Explorer UI.

## What Changes

- Add a backend command `vault_create_folder` in Tauri/Rust that securely validates the target path against the Vault root and creates the directory (including parent directories as needed).
- Extend `VaultContext` with a `createFolder(path: string)` method.
- Update the File Explorer UI in `workspace-layout`:
  - Add a dedicated "New Folder" (`FolderPlus`) action in the Explorer header to create top-level or relative folders.
  - Support creating folders directly inside any directory node via hover actions or contextual creation.
  - Allow typing slash-separated paths (e.g. `docs/architecture/adr`) to create deeply nested subdirectories in a single operation.
  - Automatically expand parent folders when a new folder or note is created inside them.

## Capabilities

### New Capabilities
*(None)*

### Modified Capabilities
- `vault-core`: Add requirement for secure directory creation (`vault_create_folder`) constrained to the Vault root.
- `workspace-layout`: Extend directory tree navigation to support interactive creation of arbitrarily nested folders within the File Explorer.

## Impact

- **Backend (`src-tauri`)**: New Tauri command `vault_create_folder` registered in `lib.rs` and capability permissions in `capabilities/default.json`.
- **Frontend Types & Context (`src/types/vault.ts`, `src/context/VaultContext.tsx`)**: New `createFolder` API exposed to panels.
- **UI (`src/components/sidebar/FileExplorerPanel.tsx`)**: New header controls, inline folder creation form, folder action buttons, and nested creation workflow.
