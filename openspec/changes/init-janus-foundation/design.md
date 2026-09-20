# Design: Janus Note Foundation Architecture

## Context

See `proposal.md` for project motivation. This document details the technical implementation strategy for bootstrapping Janus Note from a greenfield repository into a functioning desktop environment with Tauri v2, React 19, TypeScript, and Tailwind CSS.

## Goals / Non-Goals

**Goals:**
- Setup the core Tauri v2 desktop application bundle with Rust backend and Vite/React frontend.
- Implement the Rust Vault I/O commands with strict path sandboxing and active file watching (`notify` crate).
- Build the 3-column workspace layout using Tailwind CSS and shadcn/ui design patterns.
- Integrate TipTap / ProseMirror as the block-based markdown editor with custom NodeViews for embedded companion blocks (`tasks` and `chart`).

**Non-Goals:**
- Full LLM API streaming and chat orchestration (belongs in subsequent `janus-agent-runtime` change).
- Advanced D3.js chart interactions and physics graphs (belongs in subsequent `companion-visualization` change).
- Cloud synchronization or multi-device sync.

## Decisions

### 1. Framework: Tauri v2 + Vite + React 19 + TypeScript
- **Rationale**: Tauri v2 offers tiny binary sizes, low RAM usage, and native file system performance via Rust compared to Electron's resource-heavy Chromium/Node runtime. React 19 + Vite ensures rapid iteration and a rich ecosystem for UI components and editors.
- **Alternatives Considered**: 
  - *Electron*: Familiar, but produces 100MB+ binaries and consumes high memory.
  - *Pure Web App*: Lacks zero-config direct local filesystem access and native file watching.

### 2. File System Sandbox & Vault Management
- **Rationale**: The user designates a Vault folder. The Rust backend stores the canonical root path in memory and verifies that all operations canonicalize to a path starting with the Vault root (`path.canonicalize()?.starts_with(&vault_root)`).
- **Commands**:
  - `vault_select_folder()`: Opens native OS folder picker dialog.
  - `vault_list_files()`: Scans and returns hierarchical directory tree.
  - `vault_read_file(relative_path)`: Reads markdown or companion JSON.
  - `vault_write_file(relative_path, content)`: Atomically writes file to disk.
  - `vault_start_watcher()`: Initializes `notify` watcher on the vault directory and emits `vault://file-changed` events to the webview.

### 3. Editor & Markdown Rendering Engine: TipTap / ProseMirror
- **Rationale**: TipTap allows creating custom React `NodeView` components embedded within the document flow. Standard markdown code blocks with language `tasks` or `chart` are intercepted and rendered as live interactive React widgets while remaining 100% compliant with standard markdown parsers.
- **Rich Typography**: Styled using `@tailwindcss/typography` (`prose prose-invert` for dark mode) to render headings, tables, callouts, blockquotes, syntax-highlighted code blocks, and checklists in a clean, polished reading layout.
- **View Modes**:
  - **Live Block Edit Mode**: Direct WYSIWYG editing where markdown structures are interactive blocks.
  - **Reading / Preview Mode**: Pure rendered view optimized for distraction-free reading, with embedded task boards and D3 charts fully interactive.
  - Toggleable via a top toolbar action (`Ctrl/Cmd + E`) with synchronized scroll position.
- **Syntax Convention**:
  ```markdown
  ```tasks
  src: "sprint-1.tasks.json"
  view: "kanban"
  ```
  ```

### 4. Agent Architecture: Frontend-Driven with Rust Sandbox (Option A)
- **Rationale**: The React frontend orchestrates chat UI, prompt construction, and provider streaming. Tools requested by the agent map directly to the safe Tauri IPC commands (`vault_read_file`, `vault_write_file`), ensuring a clean security boundary and simple frontend integration.

### 5. Extensible Sidebar & Panel Registry Architecture
- **Rationale**: Rather than hardcoding a single component into the left or right sidebars, both sidebars use a modular **Panel Container + Activity Bar** pattern (similar to VS Code / Obsidian).
- **Structure**:
  - Each sidebar consists of a narrow icon strip (Activity Bar) and an active content pane.
  - A lightweight React `PanelRegistry` allows registering panels with `{ id, title, icon, component, defaultActive }`.
  - **Left Sidebar initial panels**: `explorer` (File Explorer, active by default), with slots ready for `search`, `tags`.
  - **Right Sidebar initial panels**: `agent` (Janus Chat, active by default), with slots ready for `outline`, `companion-inspector`.
  - Sidebars can be collapsed independently, and the active panel ID is persisted.

### 6. Window Architecture & Modern Frame Design (No Menu Bar)
- **Rationale**: Bulky traditional application menus ("File", "Edit", "View") consume valuable vertical space and look outdated. Janus Note adopts a modern, minimalist frameless design similar to Linear, Obsidian, and Arc.
- **Implementation**:
  - In `tauri.conf.json`, application menus are disabled/omitted.
  - On macOS, windows are configured with transparent / overlay titlebars (`titleBarStyle: "Overlay"`) so the window traffic lights float cleanly over the top header.
  - A slim unified top header strip with `data-tauri-drag-region` enables window dragging while housing the active vault name, breadcrumb, view-mode toggles, and sidebar fold icons.

### 7. Resizable Sidebars & Multi-Tab Document Workspace
- **Resizable Split Panes**:
  - Implemented via `react-resizable-panels` to provide smooth, accessible drag dividers between panels.
  - **Left Sidebar**: Default 260px (min 180px, max 450px).
  - **Right Sidebar**: Default 340px (min 240px, max 600px).
  - Widths and collapse states are automatically persisted across reloads.
- **Multi-Tab Document State**:
  - Managed via an application `TabStore`:
    - `openTabs: Array<{ path: string; title: string; isDirty: boolean; lastSavedContent?: string }>`
    - `activeTabId: string | null`
  - Clicking files in the File Explorer opens them as new tabs or focuses existing ones.
  - Tabs support close buttons (`x`), middle-click to close, dirty dot indicators, and keyboard shortcuts (`Cmd/Ctrl + W`).

## Risks / Trade-offs

- **[Risk] External file updates interrupting active typing**
  - *Mitigation*: The frontend tracks editor focus and dirty state. If a file change event arrives for the currently open file while the user is actively typing, display a non-destructive banner ("File modified externally - Click to reload or merge") rather than clobbering editor state.
- **[Risk] Malformed companion JSON files crashing the editor**
  - *Mitigation*: NodeViews validate JSON schemas using Zod before rendering. Invalid JSON renders an inline error alert showing exact syntax errors without crashing the ProseMirror document.
- **[Risk] Path traversal attacks via agent tool-calls**
  - *Mitigation*: Rust backend strictly normalizes and validates that the resolved target path is prefixed by the active Vault root directory before performing any filesystem syscalls.
