import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { FileChangeEvent, FileNode, VaultInfo } from '../types/vault';

// Check if running inside Tauri webview
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// In-memory mock storage for browser mode
const mockStorage: Record<string, string> = {
  'welcome.md': `---
title: Welcome to Janus Note
tags: [getting-started, notes]
status: active
---

# Welcome to Janus Note

Janus Note is a privacy-first, local-first workspace pairing markdown prose with structured companion data files.

## Key Features

- **Local Vault Storage**: Files reside on your disk in standard Markdown and JSON formats.
- **Companion Blocks**: Directly embed interactive task boards and roadmap charts into your notes.
- **Embedded Agent**: Pair program with Janus AI to inspect and modify structured project data cleanly.

\`\`\`tasks
src: "tasks/sprint-1.tasks.json"
view: "board"
\`\`\`

\`\`\`chart
src: "charts/architecture.chart.json"
type: "diagram"
\`\`\`

Feel free to edit this note, toggle between Edit and Reading mode with **Cmd+E**, or create new notes in the File Explorer!
`,
  'tasks/sprint-1.tasks.json': JSON.stringify(
    {
      title: 'Sprint 1 - Foundation Setup',
      tasks: [
        { id: '1', title: 'Tauri v2 Scaffolding', status: 'done', priority: 'high' },
        { id: '2', title: 'Sandboxed Rust Vault Core', status: 'done', priority: 'high' },
        { id: '3', title: 'Resizable 3-Column Shell', status: 'in-progress', priority: 'medium' },
        { id: '4', title: 'TipTap Block Markdown Editor', status: 'todo', priority: 'high' }
      ]
    },
    null,
    2
  ),
  'charts/architecture.chart.json': JSON.stringify(
    {
      title: 'Janus Architecture',
      nodes: [
        { id: 'vault', label: 'Local Vault (Rust)' },
        { id: 'shell', label: '3-Column Shell' },
        { id: 'editor', label: 'TipTap Block Editor' },
        { id: 'agent', label: 'Janus AI Agent' }
      ]
    },
    null,
    2
  )
};

let mockVaultInfo: VaultInfo | null = {
  path: '/Users/demo/JanusVault',
  name: 'JanusVault'
};

export const vaultService = {
  async getCurrentVault(): Promise<VaultInfo | null> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<VaultInfo | null>('vault_get_current');
      } catch (err) {
        console.warn('Failed to get current vault from Tauri:', err);
        return null;
      }
    }
    return mockVaultInfo;
  },

  async selectFolder(): Promise<VaultInfo | null> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<VaultInfo | null>('vault_select_folder');
      } catch (err) {
        console.error('Error selecting folder:', err);
        throw err;
      }
    }
    // Mock selecting folder in browser
    mockVaultInfo = {
      path: '/Users/demo/LocalVault',
      name: 'LocalVault'
    };
    return mockVaultInfo;
  },

  async setFolder(path: string): Promise<VaultInfo> {
    if (isTauriEnvironment()) {
      return await invoke<VaultInfo>('vault_set_folder', { path });
    }
    mockVaultInfo = {
      path,
      name: path.split('/').filter(Boolean).pop() || 'Vault'
    };
    return mockVaultInfo;
  },

  async readFile(path: string): Promise<string> {
    const cleanPath = path.replace(/^\/+/, '');
    if (isTauriEnvironment()) {
      return await invoke<string>('vault_read_file', { path: cleanPath });
    }
    if (cleanPath in mockStorage) {
      return mockStorage[cleanPath];
    }
    throw new Error(`File not found: ${cleanPath}`);
  },

  async writeFile(path: string, content: string): Promise<void> {
    const cleanPath = path.replace(/^\/+/, '');
    if (isTauriEnvironment()) {
      return await invoke<void>('vault_write_file', { path: cleanPath, content });
    }
    mockStorage[cleanPath] = content;
  },

  async createFolder(path: string): Promise<void> {
    const cleanPath = path.replace(/^\/+/, '');
    if (isTauriEnvironment()) {
      return await invoke<void>('vault_create_folder', { path: cleanPath });
    }
    // Browser mock
    if (!mockStorage[`${cleanPath}/.keep`]) {
      mockStorage[`${cleanPath}/.keep`] = '';
    }
  },

  async listFiles(): Promise<FileNode[]> {
    if (isTauriEnvironment()) {
      return await invoke<FileNode[]>('vault_list_files');
    }

    // Build tree from mockStorage
    const rootNodes: FileNode[] = [];
    const dirs: Record<string, FileNode> = {};

    Object.keys(mockStorage).sort().forEach(filePath => {
      const parts = filePath.split('/');
      if (parts.length === 1) {
        rootNodes.push({
          name: parts[0],
          path: parts[0],
          is_dir: false
        });
      } else {
        const dirName = parts[0];
        if (!dirs[dirName]) {
          const dirNode: FileNode = {
            name: dirName,
            path: dirName,
            is_dir: true,
            children: []
          };
          dirs[dirName] = dirNode;
          rootNodes.push(dirNode);
        }
        dirs[dirName].children?.push({
          name: parts.slice(1).join('/'),
          path: filePath,
          is_dir: false
        });
      }
    });

    return rootNodes;
  },

  async onFileChanged(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
    if (isTauriEnvironment()) {
      return await listen<FileChangeEvent>('vault://file-changed', event => {
        callback(event.payload);
      });
    }
    // Browser mock: no-op unlistener
    return () => {};
  }
};
