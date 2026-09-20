# Tasks: Janus Note Foundation Implementation

## 1. Project Initialization & Tooling

- [x] 1.1 Scaffold Tauri v2 with React, TypeScript, and Vite in the workspace and verify `npm run build` executes cleanly
- [x] 1.2 Configure Tailwind CSS with dark-mode support and custom design tokens and verify styles compile without errors
- [x] 1.3 Configure Tauri v2 window settings (no OS menu bar, overlay titlebar styling, fs/dialog plugins) and capabilities in `src-tauri` and verify Rust compilation succeeds via `cargo check`

## 2. Vault Core & Sandboxed File I/O

- [x] 2.1 Implement Rust commands for Vault selection (`vault_select_folder`, `vault_get_current`) with path-containment validation and verify traversal attempts outside root are rejected
- [x] 2.2 Implement atomic file read/write Rust commands (`vault_read_file`, `vault_write_file`) and verify reading and writing markdown and JSON files
- [x] 2.3 Implement directory tree scanner (`vault_list_files`) returning nested tree nodes and verify the output represents the Vault directory structure
- [x] 2.4 Integrate the `notify` crate in Rust to watch the active Vault directory and verify `vault://file-changed` events are emitted to the webview on filesystem modifications

## 3. Workspace Layout Shell

- [x] 3.1 Build the modular 3-column layout shell with resizable divider handles (`react-resizable-panels`), top window drag region, and collapsible left/right sidebars, and verify panel resizing and width persistence
- [x] 3.2 Implement the Panel Registry context to support registering and switching sidebar views dynamically on both sides
- [x] 3.3 Implement the File Explorer panel in the left sidebar registry and verify file selection and folder expand/collapse behavior
- [x] 3.4 Implement the Multi-Tab Document manager in the center canvas and verify opening multiple notes, switching active tabs, closing tabs, and dirty indicators
- [x] 3.5 Implement the Janus Agent panel in the right sidebar registry and verify panel switching and toggle state persistence

## 4. Block Editor & Markdown Rendering Foundation

- [x] 4.1 Integrate TipTap editor core with `@tailwindcss/typography` styling for full Markdown element rendering (headings, lists, blockquotes, codeblocks, tables) and verify visual formatting in the webview
- [x] 4.2 Implement Edit / Reading preview mode toggle (with toolbar action and shortcut) and verify switching preserves document state and scroll position
- [x] 4.3 Implement YAML frontmatter extraction and serialization and verify metadata is preserved across save cycles
- [x] 4.4 Create custom TipTap NodeViews for codeblocks tagged `tasks` and `chart` and verify interactive placeholder cards render within both edit and rendered views

## 5. Integration Verification

- [x] 5.1 Assemble sample test Vault with markdown notes and companion JSON files, launch the desktop app, and verify directory browsing, note editing, and live file-watch updates
