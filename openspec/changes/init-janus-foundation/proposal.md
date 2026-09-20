# Proposal: Janus Note Foundation

## Why

Personal note-taking and project planning tools either lock users into proprietary clouds or treat structured project artifacts (task lists, roadmaps, dependency charts) as fragile, unstructured markdown text that AI agents struggle to manipulate accurately. 

Janus Note solves this by establishing a privacy-first, local-first desktop application using Tauri v2 and React. It pairs standard Markdown files with structured, schema-validated JSON companion files (`*.tasks.json`, `*.chart.json`) that an embedded AI agent can inspect and mutate cleanly via typed tool-calls without damaging surrounding prose.

## What Changes

- Initialize the desktop application scaffolding using Tauri v2, React 19, TypeScript, and Tailwind CSS.
- Establish the **Vault Core**: a sandboxed local filesystem layer in Rust providing atomic file read/write operations, directory scanning, and real-time file watching (`notify`).
- Implement the modular **3-Column Workspace Layout**:
  - Left: Width-resizable, collapsible sidebar with Activity Bar (File Explorer by default, extensible with Search, Tags, etc.).
  - Center: Multi-tab document workspace and Visualization canvas.
  - Right: Width-resizable, collapsible sidebar with Activity Bar (Janus Agent by default, extensible with Outline, Inspector, etc.).
- Establish a modern, sleek window frame without traditional application menu bars, featuring integrated window controls, top drag region, and maximized editor space.
- Implement the foundation of the **Block-based Editor** supporting rich Markdown rendering (typography, tables, syntax highlighting), live preview/reading mode toggle, YAML frontmatter extraction, and custom embed blocks for companion files (e.g. `tasks` and `chart` codeblocks).

## Capabilities

### New Capabilities
- `vault-core`: Local vault folder selection, path containment verification, atomic file read/write for Markdown and companion JSON, directory tree indexing, and file change event dispatching.
- `workspace-layout`: Modular 3-column desktop shell with width-resizable sidebars, multi-tab document management, and persistent view state.
- `block-editor`: Markdown document editing with rich visual rendering, Edit/Preview mode switching, YAML frontmatter extraction, and extensible block rendering for companion file references.

### Modified Capabilities
*(None - initial project bootstrap)*

## Impact

- **New Dependencies**: Tauri v2 CLI and plugins (`@tauri-apps/api`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`), React, TypeScript, Tailwind CSS, Lucide icons, TipTap / ProseMirror core libraries.
- **Security & Sandboxing**: Native Rust filesystem commands are strictly constrained to the user-selected Vault root directory to ensure local-first privacy.
