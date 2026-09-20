# Janus Note 🪐

**Janus Note** is a privacy-first, local-first desktop application for intelligent note-taking and project planning. Built with **Tauri v2**, **React 19**, **TypeScript**, and **Rust**, it combines human-friendly Markdown writing with machine-operable structured companion files.

---

## 💡 The Core Concept

Traditional note-taking tools either lock users into proprietary clouds or store structured project artifacts (task boards, dependency graphs, roadmaps) as fragile, unstructured markdown snippets that AI agents easily corrupt.

**Janus Note** solves this dual nature (inspired by Janus, the two-faced Roman god of transitions and dual perspectives):

* **Human Perspective:** Clean, expressive Markdown notes for thinking, writing, and organizing thoughts.
* **Agent Perspective:** Schema-validated JSON companion files (`*.tasks.json`, `*.chart.json`) that an embedded AI assistant can inspect, validate, and mutate via typed tool-calls without damaging surrounding prose.

---

## 🏛️ Architecture & Key Features

### 1. Sandboxed Vault Core (Rust)
* **Local-First Privacy:** All notes and companion data reside strictly on your local disk.
* **Path-Containment Security:** Filesystem operations are strictly constrained to the user-selected Vault root directory.
* **Atomic File I/O:** Safe file updates prevent corruption during concurrent edits.
* **Real-time Synchronization:** Built-in filesystem watcher (`notify`) emits instant change events (`vault://file-changed`) to keep editor and panels in sync.

### 2. Modular 3-Column Workspace Shell
* **Modern Window Frame:** Frameless overlay header with integrated window controls and maximized editor surface.
* **Left Sidebar:** Collapsible and resizable panel system (File Explorer, Vault management, Search).
* **Center Canvas:** Multi-tab document manager with dirty indicators and live preview toggle.
* **Right Sidebar:** Integrated panel registry for the embedded Janus Agent, document outlines, and inspector tools.

### 3. Block-Based Editor & Rich Companion Blocks
* **Rich Markdown Editing:** Powered by TipTap / ProseMirror and Tailwind CSS typography (headings, tables, syntax highlighting, callouts).
* **Companion Embeds:** Interactive inline blocks for embedded companion files (e.g. interactive task boards and charts embedded into notes).
* **Frontmatter Preservation:** Lossless YAML frontmatter parsing and serialization.

---

## 🛠️ Tech Stack

* **Desktop Runtime:** [Tauri v2](https://v2.tauri.app/) & Rust
* **Frontend UI:** React 19, TypeScript, Vite, Tailwind CSS
* **Icons & UI Utilities:** Lucide React, `react-resizable-panels`
* **Editor Core:** TipTap / ProseMirror
* **Specification & Governance:** [OpenSpec](openspec/)

---

## 📁 Repository Structure

```text
janus-note/
├── .agents/                 # AI Agent workflows and skill definitions
├── openspec/                # OpenSpec specifications and active change proposals
│   ├── changes/             # Active proposals (e.g. init-janus-foundation)
│   └── specs/               # Core domain specifications
├── .gitignore               # Multi-environment ignore configuration
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: `v20+` and `npm` (or `pnpm`)
* **Rust**: Stable toolchain (`rustup`)
* **Platform Dependencies**: Standard Tauri prerequisites for macOS, Linux, or Windows (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

### Development Workflow

Once the application foundation is scaffolded:

```bash
# Install frontend dependencies
npm install

# Run the desktop application in development mode
npm run tauri dev

# Build production bundle
npm run tauri build
```

---

## 📋 Project Status

Janus Note is currently in early foundation development. Active specifications and rollout tasks are tracked under [`openspec/changes/init-janus-foundation/`](openspec/changes/init-janus-foundation/).
