import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FileNode, TabItem, VaultInfo, ViewMode } from '../types/vault';
import { vaultService } from '../services/vaultService';
import { parseMarkdownWithFrontmatter, serializeMarkdownWithFrontmatter } from '../utils/frontmatter';

interface VaultContextType {
  vaultInfo: VaultInfo | null;
  fileTree: FileNode[];
  openTabs: TabItem[];
  activeTabPath: string | null;
  activeTab: TabItem | null;
  viewMode: ViewMode;
  externalModificationBanner: string | null;
  errorMessage: string | null;
  isLoading: boolean;
  selectedPaths: Set<string>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastSelectedPath: string | null;
  setLastSelectedPath: (path: string | null) => void;
  selectVault: () => Promise<void>;
  openSampleVault: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  openNote: (path: string) => Promise<void>;
  openVirtualTab: (path: string, title: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateActiveContent: (body: string, updatedFrontmatter?: Record<string, any>) => void;
  saveActiveNote: () => Promise<void>;
  createNewNote: (fileName?: string) => Promise<void>;
  createFolder: (folderPath: string) => Promise<void>;
  moveItems: (sourcePaths: string[], destinationFolder: string) => Promise<void>;
  triageContent: (snippet: string, destPath: string, mode: 'create' | 'append') => Promise<void>;
  toggleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
  dismissBanner: () => void;
  dismissErrorMessage: () => void;
  reloadExternalFile: (path: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<TabItem[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [externalModificationBanner, setExternalModificationBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
    try {
      const files = await vaultService.listFiles();
      setFileTree(files);
    } catch (err) {
      console.error('Failed to list files:', err);
    }
  }, []);

  // Initial vault load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const info = await vaultService.getCurrentVault();
        if (mounted && info) {
          setVaultInfo(info);
          const files = await vaultService.listFiles();
          setFileTree(files);

          // Open first note if available
          const firstFile = files.find(f => !f.is_dir && f.path.endsWith('.md'));
          if (firstFile) {
            openNote(firstFile.path);
          }
        }
      } catch (err) {
        console.error('Failed to load initial vault:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen to file change events from notify
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await vaultService.onFileChanged(event => {
        refreshFiles();

        // Check if event targets an open tab
        setOpenTabs(currentTabs => {
          const tab = currentTabs.find(t => t.path === event.path);
          if (!tab) return currentTabs;

          if (tab.isDirty) {
            setExternalModificationBanner(
              `"${tab.title}" was modified externally on disk. Click to reload with external changes or save to overwrite.`
            );
          } else {
            // Tab is clean, auto reload content smoothly
            vaultService.readFile(event.path).then(newRaw => {
              const { frontmatter, body } = parseMarkdownWithFrontmatter(newRaw);
              setOpenTabs(tabs =>
                tabs.map(t =>
                  t.path === event.path
                    ? {
                        ...t,
                        rawContent: newRaw,
                        content: body,
                        frontmatter,
                        lastSavedContent: newRaw,
                        isDirty: false,
                        contentVersion: (t.contentVersion || 0) + 1,
                      }
                    : t
                )
              );
            }).catch(console.error);
          }
          return currentTabs;
        });
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [refreshFiles]);

  const selectVault = async () => {
    try {
      setIsLoading(true);
      const selected = await vaultService.selectFolder();
      if (selected) {
        setVaultInfo(selected);
        setOpenTabs([]);
        setActiveTabPath(null);
        await refreshFiles();
      }
    } catch (err) {
      console.error('Error selecting vault folder:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openSampleVault = async () => {
    try {
      setIsLoading(true);
      const samplePath = 'sample-vault';
      const selected = await vaultService.setFolder(samplePath);
      setVaultInfo(selected);
      setOpenTabs([]);
      setActiveTabPath(null);
      await refreshFiles();
      await openNote('welcome.md');
    } catch (err) {
      console.error('Error opening sample vault:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openVirtualTab = (path: string, title: string) => {
    const existing = openTabs.find(t => t.path === path);
    if (existing) {
      setActiveTabPath(path);
      return;
    }

    const newTab: TabItem = {
      path,
      title,
      tabType: 'virtual',
      isDirty: false,
      content: '',
      rawContent: '',
      frontmatter: {},
      lastSavedContent: '',
      contentVersion: 0,
    };

    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabPath(path);
  };

  const openNote = async (filePath: string) => {
    if (filePath.startsWith('virtual:')) {
      const title = filePath === 'virtual:ai-config' ? 'AI Settings' : 'Settings';
      openVirtualTab(filePath, title);
      return;
    }

    // If already open, switch to it
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    try {
      setIsLoading(true);
      const rawContent = await vaultService.readFile(filePath);
      const { frontmatter, body } = parseMarkdownWithFrontmatter(rawContent);

      const title =
        frontmatter.title ||
        filePath.split('/').pop()?.replace(/\.md$/, '') ||
        'Untitled';

      const newTab: TabItem = {
        path: filePath,
        title,
        isDirty: false,
        content: body,
        rawContent,
        frontmatter,
        lastSavedContent: rawContent,
        contentVersion: 0
      };

      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabPath(filePath);
    } catch (err) {
      console.error(`Failed to open note ${filePath}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const closeTab = (filePath: string) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath);
      if (idx === -1) return prev;

      const remaining = prev.filter(t => t.path !== filePath);

      // If closing active tab, switch to adjacent tab
      if (activeTabPath === filePath) {
        if (remaining.length > 0) {
          const nextIdx = Math.min(idx, remaining.length - 1);
          setActiveTabPath(remaining[nextIdx].path);
        } else {
          setActiveTabPath(null);
        }
      }

      return remaining;
    });
  };

  const updateActiveContent = (body: string, updatedFrontmatter?: Record<string, any>) => {
    if (!activeTabPath) return;

    setOpenTabs(prev =>
      prev.map(tab => {
        if (tab.path !== activeTabPath) return tab;

        const frontmatter = updatedFrontmatter ?? tab.frontmatter;
        const serialized = serializeMarkdownWithFrontmatter(frontmatter, body);
        const isDirty = serialized !== tab.lastSavedContent;

        return {
          ...tab,
          content: body,
          frontmatter,
          rawContent: serialized,
          isDirty
        };
      })
    );
  };

  const saveActiveNote = async () => {
    if (!activeTabPath) return;

    const tab = openTabs.find(t => t.path === activeTabPath);
    if (!tab || tab.tabType === 'virtual') return;

    const serialized = serializeMarkdownWithFrontmatter(tab.frontmatter, tab.content);

    try {
      await vaultService.writeFile(tab.path, serialized);
      setOpenTabs(prev =>
        prev.map(t =>
          t.path === activeTabPath
            ? { ...t, rawContent: serialized, lastSavedContent: serialized, isDirty: false }
            : t
        )
      );
      if (externalModificationBanner) {
        setExternalModificationBanner(null);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const createNewNote = async (suggestedName?: string) => {
    const fileName = suggestedName || `note-${Date.now().toString().slice(-4)}.md`;
    const cleanName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    const initialContent = `# ${cleanName.replace(/\.md$/, '')}\n\nStart writing here...`;

    try {
      await vaultService.writeFile(cleanName, initialContent);
      await refreshFiles();
      await openNote(cleanName);
    } catch (err) {
      console.error('Failed to create new note:', err);
    }
  };

  const createFolder = useCallback(
    async (folderPath: string) => {
      const trimmed = folderPath.trim();
      if (!trimmed) return;
      try {
        await vaultService.createFolder(trimmed);
        await refreshFiles();
      } catch (err) {
        console.error('Failed to create folder:', err);
        throw err;
      }
    },
    [refreshFiles]
  );

  const toggleViewMode = () => {
    setViewMode(prev => (prev === 'edit' ? 'preview' : 'edit'));
  };

  const dismissBanner = () => {
    setExternalModificationBanner(null);
  };

  const dismissErrorMessage = () => {
    setErrorMessage(null);
  };

  const moveItems = useCallback(
    async (sourcePaths: string[], destinationFolder: string) => {
      if (sourcePaths.length === 0) return;
      try {
        await vaultService.movePaths(sourcePaths, destinationFolder);
        await refreshFiles();

        // Update open tabs
        setOpenTabs(currentTabs => {
          let updatedActiveTabPath = activeTabPath;

          const newTabs = currentTabs.map(tab => {
            for (const src of sourcePaths) {
              const cleanSrc = src.replace(/^\/+/, '');
              const baseName = cleanSrc.split('/').pop() || '';
              const cleanDestFolder = destinationFolder.replace(/^\/+/, '').replace(/\/+$/, '');
              const targetDest = cleanDestFolder ? `${cleanDestFolder}/${baseName}` : baseName;

              if (tab.path === cleanSrc) {
                if (activeTabPath === tab.path) {
                  updatedActiveTabPath = targetDest;
                }
                return {
                  ...tab,
                  path: targetDest,
                  title: targetDest.split('/').pop()?.replace(/\.md$/, '') || tab.title
                };
              }

              if (tab.path.startsWith(`${cleanSrc}/`)) {
                const suffix = tab.path.slice(cleanSrc.length);
                const newPath = `${targetDest}${suffix}`;
                if (activeTabPath === tab.path) {
                  updatedActiveTabPath = newPath;
                }
                return {
                  ...tab,
                  path: newPath,
                  title: newPath.split('/').pop()?.replace(/\.md$/, '') || tab.title
                };
              }
            }
            return tab;
          });

          if (updatedActiveTabPath !== activeTabPath) {
            setActiveTabPath(updatedActiveTabPath);
          }

          return newTabs;
        });

        // Update selectedPaths to reflect new locations
        setSelectedPaths(prev => {
          const next = new Set<string>();
          for (const item of prev) {
            let matched = false;
            for (const src of sourcePaths) {
              const cleanSrc = src.replace(/^\/+/, '');
              const baseName = cleanSrc.split('/').pop() || '';
              const cleanDestFolder = destinationFolder.replace(/^\/+/, '').replace(/\/+$/, '');
              const targetDest = cleanDestFolder ? `${cleanDestFolder}/${baseName}` : baseName;

              if (item === cleanSrc) {
                next.add(targetDest);
                matched = true;
                break;
              } else if (item.startsWith(`${cleanSrc}/`)) {
                next.add(`${targetDest}${item.slice(cleanSrc.length)}`);
                matched = true;
                break;
              }
            }
            if (!matched) {
              next.add(item);
            }
          }
          return next;
        });
      } catch (err: any) {
        console.error('Failed to move items:', err);
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to move items';
        setErrorMessage(msg);
        throw err;
      }
    },
    [activeTabPath, refreshFiles]
  );

  const triageContent = useCallback(
    async (snippet: string, destPath: string, mode: 'create' | 'append') => {
      const cleanDest = destPath.replace(/^\/+/, '');
      if (!cleanDest) throw new Error('Destination path cannot be empty');

      // Ensure parent folders exist
      const parentDir = cleanDest.includes('/') ? cleanDest.split('/').slice(0, -1).join('/') : '';
      if (parentDir) {
        await vaultService.createFolder(parentDir);
      }

      if (mode === 'append') {
        let existing = '';
        try { existing = await vaultService.readFile(cleanDest); } catch { /* file doesn't exist yet */ }
        const combined = existing ? `${existing.trimEnd()}\n\n${snippet.trim()}\n` : `${snippet.trim()}\n`;
        await vaultService.writeFile(cleanDest, combined);
      } else {
        await vaultService.writeFile(cleanDest, `${snippet.trim()}\n`);
      }

      // Remove snippet from Inbox.md
      const currentInbox = await vaultService.readFile('Inbox.md');
      const newInbox = currentInbox.replace(snippet, '').replace(/\n{3,}/g, '\n\n').trimStart();
      await vaultService.writeFile('Inbox.md', newInbox || '# 📥 Inbox\n\n');

      // Update any open tabs (Inbox.md and dest)
      const rawInbox = await vaultService.readFile('Inbox.md');
      const { frontmatter: inboxFm, body: inboxBody } = parseMarkdownWithFrontmatter(rawInbox);
      setOpenTabs(prev => prev.map(t => {
        if (t.path === 'Inbox.md') {
          return { ...t, content: inboxBody, frontmatter: inboxFm, rawContent: rawInbox, lastSavedContent: rawInbox, isDirty: false, contentVersion: t.contentVersion + 1 };
        }
        return t;
      }));

      await refreshFiles();
    },
    [refreshFiles]
  );

  const reloadExternalFile = async (path: string) => {
    try {
      const raw = await vaultService.readFile(path);
      const { frontmatter, body } = parseMarkdownWithFrontmatter(raw);
      setOpenTabs(prev =>
        prev.map(t =>
          t.path === path
            ? {
                ...t,
                content: body,
                frontmatter,
                rawContent: raw,
                lastSavedContent: raw,
                isDirty: false,
                contentVersion: (t.contentVersion || 0) + 1,
              }
            : t
        )
      );
      setExternalModificationBanner(null);
    } catch (err) {
      console.error('Failed to reload file:', err);
    }
  };

  // Keyboard shortcut listener: Cmd/Ctrl + S to save, Cmd/Ctrl + E to toggle view mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveNote();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleViewMode();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabPath) {
          closeTab(activeTabPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const activeTab = openTabs.find(t => t.path === activeTabPath) || null;

  return (
    <VaultContext.Provider
      value={{
        vaultInfo,
        fileTree,
        openTabs,
        activeTabPath,
        activeTab,
        viewMode,
        externalModificationBanner,
        errorMessage,
        isLoading,
        selectedPaths,
        setSelectedPaths,
        lastSelectedPath,
        setLastSelectedPath,
        selectVault,
        openSampleVault,
        refreshFiles,
        openNote,
        openVirtualTab,
        closeTab,
        setActiveTab: setActiveTabPath,
        updateActiveContent,
        saveActiveNote,
        createNewNote,
        createFolder,
        moveItems,
        triageContent,
        toggleViewMode,
        setViewMode,
        dismissBanner,
        dismissErrorMessage,
        reloadExternalFile
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
