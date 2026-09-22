import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { FileChangeEvent, FileNode, VaultInfo } from '../types/vault';

// Check if running inside Tauri webview
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// In-memory mock storage for browser mode
const mockStorage: Record<string, string> = {
  'Inbox.md': `# 📥 Inbox\n\nWelcome to your quick capture inbox. Jot down thoughts, tasks, and ideas freely here.\nUse the Triage button (or Cmd+Shift+T) to file notes into your vault.\n`,
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

const localFileChangeListeners = new Set<(event: FileChangeEvent) => void>();

interface RecentWrite {
  content: string;
  timestamp: number;
}

const recentWrites = new Map<string, RecentWrite>();

function notifyLocalFileChange(path: string, kind: 'create' | 'modify' | 'remove') {
  localFileChangeListeners.forEach(listener => {
    try {
      listener({ path, kind });
    } catch (err) {
      console.error('Error in file change listener:', err);
    }
  });
}

let mockVaultInfo: VaultInfo | null = {
  path: '/Users/demo/JanusVault',
  name: 'JanusVault'
};

export const vaultService = {
  isSelfWrite(path: string, content?: string): boolean {
    const cleanPath = path.replace(/^\/+/, '');
    const recent = recentWrites.get(cleanPath);
    if (!recent) return false;
    const isRecent = Date.now() - recent.timestamp < 3000;
    if (!isRecent) {
      recentWrites.delete(cleanPath);
      return false;
    }
    if (content !== undefined) {
      return recent.content === content;
    }
    return true;
  },

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
    recentWrites.set(cleanPath, { content, timestamp: Date.now() });

    if (isTauriEnvironment()) {
      await invoke<void>('vault_write_file', { path: cleanPath, content });
      return;
    }
    mockStorage[cleanPath] = content;
    notifyLocalFileChange(cleanPath, 'modify');
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

  async movePaths(sourcePaths: string[], destinationFolder: string): Promise<string[]> {
    const cleanSources = sourcePaths.map(p => p.replace(/^\/+/, ''));
    const cleanDestFolder = destinationFolder.replace(/^\/+/, '').replace(/\/+$/, '');

    if (isTauriEnvironment()) {
      return await invoke<string[]>('vault_move_paths', {
        sourcePaths: cleanSources,
        destinationFolder: cleanDestFolder
      });
    }

    // Browser mock
    const movedPaths: string[] = [];

    for (const src of cleanSources) {
      const srcParts = src.split('/');
      const baseName = srcParts[srcParts.length - 1];
      const targetDest = cleanDestFolder ? `${cleanDestFolder}/${baseName}` : baseName;

      if (src === targetDest) {
        continue;
      }

      // Check if src is an exact file in mockStorage
      if (src in mockStorage) {
        if (targetDest in mockStorage) {
          throw new Error(`An item named '${baseName}' already exists in destination`);
        }
        mockStorage[targetDest] = mockStorage[src];
        delete mockStorage[src];
        movedPaths.push(targetDest);
      } else {
        // Directory in mock storage
        const prefix = `${src}/`;
        const matchingKeys = Object.keys(mockStorage).filter(k => k === src || k.startsWith(prefix));
        if (matchingKeys.length === 0) {
          throw new Error(`Source path not found: ${src}`);
        }

        // Cycle check
        if (cleanDestFolder === src || cleanDestFolder.startsWith(`${src}/`)) {
          throw new Error(`Cannot move directory '${src}' into itself or its subdirectory`);
        }

        // Collision check
        const targetPrefix = `${targetDest}/`;
        const hasCollision = Object.keys(mockStorage).some(k => k === targetDest || k.startsWith(targetPrefix));
        if (hasCollision) {
          throw new Error(`An item named '${baseName}' already exists in destination`);
        }

        for (const oldKey of matchingKeys) {
          const suffix = oldKey.slice(src.length);
          const newKey = `${targetDest}${suffix}`;
          mockStorage[newKey] = mockStorage[oldKey];
          delete mockStorage[oldKey];
        }
        movedPaths.push(targetDest);
      }
    }

    return movedPaths;
  },

  async listFiles(): Promise<FileNode[]> {
    if (isTauriEnvironment()) {
      return await invoke<FileNode[]>('vault_list_files');
    }

    // Build tree from mockStorage with recursive directory support
    const rootNodes: FileNode[] = [];
    const dirMap = new Map<string, FileNode>();

    const getOrCreateDir = (dirPath: string): FileNode => {
      if (dirMap.has(dirPath)) return dirMap.get(dirPath)!;
      const parts = dirPath.split('/');
      const dirName = parts[parts.length - 1];
      const dirNode: FileNode = {
        name: dirName,
        path: dirPath,
        is_dir: true,
        children: []
      };
      dirMap.set(dirPath, dirNode);

      if (parts.length === 1) {
        rootNodes.push(dirNode);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parentDir = getOrCreateDir(parentPath);
        parentDir.children?.push(dirNode);
      }
      return dirNode;
    };

    Object.keys(mockStorage).sort().forEach(filePath => {
      const parts = filePath.split('/');
      if (parts.length === 1) {
        if (filePath.endsWith('.keep')) return;
        rootNodes.push({
          name: parts[0],
          path: parts[0],
          is_dir: false
        });
      } else {
        const fileName = parts[parts.length - 1];
        const dirPath = parts.slice(0, -1).join('/');
        const dirNode = getOrCreateDir(dirPath);
        if (fileName !== '.keep') {
          dirNode.children?.push({
            name: fileName,
            path: filePath,
            is_dir: false
          });
        }
      }
    });

    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.children) {
          sortNodes(node.children);
        }
      }
    };

    sortNodes(rootNodes);
    return rootNodes;
  },

  async onFileChanged(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
    localFileChangeListeners.add(callback);

    let tauriUnlisten: UnlistenFn | undefined;
    if (isTauriEnvironment()) {
      tauriUnlisten = await listen<FileChangeEvent>('vault://file-changed', event => {
        callback(event.payload);
      });
    }

    return () => {
      localFileChangeListeners.delete(callback);
      if (tauriUnlisten) tauriUnlisten();
    };
  },

  async deleteItem(path: string): Promise<void> {
    const cleanPath = path.replace(/^\/+/, '');
    if (isTauriEnvironment()) {
      return await invoke<void>('vault_delete_item', { path: cleanPath });
    }
    // Browser mock: block Inbox.md
    if (cleanPath.toLowerCase() === 'inbox.md') {
      throw new Error("Protected System Error: 'Inbox.md' is a protected system document and cannot be deleted");
    }
    const prefix = `${cleanPath}/`;
    const keysToDelete = Object.keys(mockStorage).filter(k => k === cleanPath || k.startsWith(prefix));
    if (keysToDelete.length === 0) throw new Error(`Item not found: ${cleanPath}`);
    for (const k of keysToDelete) delete mockStorage[k];
  },

  /**
   * Generate AI triage payload: inbox content + flat vault path listing.
   * Used by Phase 2 LLM integration to suggest filing destinations.
   */
  async getTriagePayload(): Promise<{ inboxContent: string; vaultTree: Array<{ path: string; isDir: boolean }> }> {
    const inboxContent = await this.readFile('Inbox.md');
    const files = await this.listFiles();
    const flattenTree = (nodes: FileNode[], acc: Array<{ path: string; isDir: boolean }> = []) => {
      for (const n of nodes) {
        acc.push({ path: n.path, isDir: n.is_dir });
        if (n.children) flattenTree(n.children, acc);
      }
      return acc;
    };
    return {
      inboxContent,
      vaultTree: flattenTree(files),
    };
  },
};
