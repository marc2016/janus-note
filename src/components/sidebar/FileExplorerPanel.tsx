import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode2, 
  Plus, 
  FolderPlus,
  RotateCw, 
  Search, 
  ChevronRight, 
  ChevronDown,
  AlertCircle,
  X,
  Inbox
} from 'lucide-react';
import { FileNode } from '../../types/vault';
import { useVault } from '../../context/VaultContext';

// Shared module-level drag state for reliable cross-element data transfer
let globalDragPaths: string[] | null = null;

export const getValidMoveItems = (dragPaths: string[], targetFolder: string): string[] => {
  const cleanTarget = targetFolder.replace(/^\/+/, '').replace(/\/+$/, '');
  return dragPaths.filter(src => {
    const cleanSrc = src.replace(/^\/+/, '').replace(/\/+$/, '');
    // Cannot drop onto itself
    if (cleanSrc === cleanTarget) return false;
    // Cannot drop into its own subdirectory
    if (cleanTarget.startsWith(`${cleanSrc}/`)) return false;
    // Cannot drop into its current parent folder (already there)
    const lastSlash = cleanSrc.lastIndexOf('/');
    const parent = lastSlash !== -1 ? cleanSrc.slice(0, lastSlash) : '';
    if (parent === cleanTarget) return false;
    return true;
  });
};

interface TreeNodeProps {
  node: FileNode;
  level: number;
  activePath: string | null;
  selectedPaths: Set<string>;
  collapsedFolders: Set<string>;
  onToggleCollapse: (path: string) => void;
  onNodeClick: (node: FileNode, e: React.MouseEvent) => void;
  onMoveItems: (sourcePaths: string[], destinationFolder: string) => Promise<void>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLastSelectedPath: (path: string | null) => void;
  filterText: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ 
  node, 
  level, 
  activePath, 
  selectedPaths,
  collapsedFolders,
  onToggleCollapse,
  onNodeClick,
  onMoveItems,
  setSelectedPaths,
  setLastSelectedPath,
  filterText 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const isOpen = !collapsedFolders.has(node.path);
  const isSelected = selectedPaths.has(node.path);
  const isActive = activePath === node.path;
  const isMatch = filterText === '' || node.name.toLowerCase().includes(filterText.toLowerCase());

  if (!isMatch && !node.is_dir) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse(node.path);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick(node, e);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    let dragPaths: string[];
    if (selectedPaths.has(node.path)) {
      dragPaths = Array.from(selectedPaths);
    } else {
      dragPaths = [node.path];
      setSelectedPaths(new Set([node.path]));
      setLastSelectedPath(node.path);
    }

    globalDragPaths = dragPaths;
    e.dataTransfer.setData('text/plain', JSON.stringify(dragPaths));
    e.dataTransfer.setData('application/x-janus-nodes', JSON.stringify(dragPaths));
    e.dataTransfer.effectAllowed = 'move';

    // Multiple items drag preview badge
    if (dragPaths.length > 1) {
      const badge = document.createElement('div');
      badge.className = 'fixed -top-96 left-0 bg-accent text-white text-xs font-semibold px-2 py-0.5 rounded shadow-lg border border-white/30 z-50 pointer-events-none';
      badge.innerText = `${dragPaths.length} items`;
      document.body.appendChild(badge);
      e.dataTransfer.setDragImage(badge, 10, 10);
      setTimeout(() => {
        if (document.body.contains(badge)) {
          document.body.removeChild(badge);
        }
      }, 0);
    }
  };

  const handleDragEnd = () => {
    globalDragPaths = null;
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!node.is_dir) return;
    e.preventDefault();
    e.stopPropagation();

    const paths = globalDragPaths;
    if (paths && getValidMoveItems(paths, node.path).length === 0) {
      e.dataTransfer.dropEffect = 'none';
      setIsDragOver(false);
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!node.is_dir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    let paths: string[] | null = globalDragPaths;
    if (!paths || paths.length === 0) {
      try {
        const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/x-janus-nodes');
        if (raw) paths = JSON.parse(raw);
      } catch {
        paths = null;
      }
    }
    globalDragPaths = null;

    if (paths && Array.isArray(paths) && paths.length > 0) {
      const validItems = getValidMoveItems(paths, node.path);
      if (validItems.length > 0) {
        await onMoveItems(validItems, node.path);
      }
    }
  };

  const isCompanionJson = node.name.endsWith('.tasks.json') || node.name.endsWith('.chart.json');

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{ paddingLeft: `${level * 14 + 10}px` }}
        className={`group flex items-center py-1.5 pr-2.5 rounded cursor-pointer text-xs transition-colors select-none ${
          isDragOver
            ? 'bg-accent/30 ring-1 ring-accent text-accent font-medium'
            : isSelected
            ? 'bg-accent/20 text-accent font-medium border-l-2 border-accent pl-[8px]'
            : isActive
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
        }`}
      >
        {node.is_dir ? (
          <span 
            onClick={handleToggle} 
            className="p-0.5 mr-1 hover:text-text-primary rounded text-text-muted transition-colors pointer-events-auto"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 pointer-events-none" /> : <ChevronRight className="w-3.5 h-3.5 pointer-events-none" />}
          </span>
        ) : (
          <span className="w-3.5 mr-1 flex-shrink-0 pointer-events-none" />
        )}

        {node.is_dir ? (
          isOpen ? (
            <FolderOpen className="w-4 h-4 mr-2 text-accent/80 flex-shrink-0 pointer-events-none" />
          ) : (
            <Folder className="w-4 h-4 mr-2 text-text-muted flex-shrink-0 pointer-events-none" />
          )
        ) : isCompanionJson ? (
          <FileCode2 className="w-4 h-4 mr-2 text-purple-400 flex-shrink-0 pointer-events-none" />
        ) : (
          <FileText className="w-4 h-4 mr-2 text-text-muted group-hover:text-accent transition-colors flex-shrink-0 pointer-events-none" />
        )}

        <span className="truncate flex-1 pointer-events-none">{node.name}</span>

        {isCompanionJson && (
          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40 ml-1 pointer-events-none">
            Data
          </span>
        )}
      </div>

      {node.is_dir && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              activePath={activePath}
              selectedPaths={selectedPaths}
              collapsedFolders={collapsedFolders}
              onToggleCollapse={onToggleCollapse}
              onNodeClick={onNodeClick}
              onMoveItems={onMoveItems}
              setSelectedPaths={setSelectedPaths}
              setLastSelectedPath={setLastSelectedPath}
              filterText={filterText}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorerPanel: React.FC = () => {
  const { 
    fileTree, 
    activeTabPath, 
    openNote, 
    createNewNote, 
    createFolder, 
    moveItems,
    selectedPaths, 
    setSelectedPaths, 
    lastSelectedPath, 
    setLastSelectedPath,
    errorMessage,
    dismissErrorMessage,
    refreshFiles, 
    isLoading 
  } = useVault();

  const [filterText, setFilterText] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+Shift+I / Ctrl+Shift+I to open Inbox.md
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        openNote('Inbox.md');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openNote]);

  // Filter Inbox.md out of regular tree — it is rendered as a pinned item
  const filteredFileTree = fileTree.filter(node => node.path.toLowerCase() !== 'inbox.md');

  // Helper to flatten visible nodes for Shift+Click range selection
  const getVisibleNodes = (nodes: FileNode[]): FileNode[] => {
    const list: FileNode[] = [];
    for (const node of nodes) {
      list.push(node);
      if (node.is_dir && !collapsedFolders.has(node.path) && node.children) {
        list.push(...getVisibleNodes(node.children));
      }
    }
    return list;
  };

  const handleToggleCollapse = (path: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleNodeClick = (node: FileNode, e: React.MouseEvent) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isCmdOrCtrl) {
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
        }
        return next;
      });
      setLastSelectedPath(node.path);
    } else if (isShift && lastSelectedPath) {
      const visible = getVisibleNodes(fileTree);
      const lastIdx = visible.findIndex(n => n.path === lastSelectedPath);
      const currIdx = visible.findIndex(n => n.path === node.path);

      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        const rangePaths = visible.slice(start, end + 1).map(n => n.path);
        setSelectedPaths(new Set(rangePaths));
      } else {
        setSelectedPaths(new Set([node.path]));
        setLastSelectedPath(node.path);
      }
    } else {
      setSelectedPaths(new Set([node.path]));
      setLastSelectedPath(node.path);
      if (node.is_dir) {
        handleToggleCollapse(node.path);
      } else {
        openNote(node.path);
      }
    }
  };

  const handleMoveItems = async (sourcePaths: string[], destinationFolder: string) => {
    try {
      await moveItems(sourcePaths, destinationFolder);
      // Auto expand target folder so user sees relocated items
      if (destinationFolder) {
        setCollapsedFolders(prev => {
          const next = new Set(prev);
          next.delete(destinationFolder);
          return next;
        });
      }
    } catch (err) {
      // Error handled by context and displayed via banner
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverRoot(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOverRoot(false);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRoot(false);

    let paths: string[] | null = globalDragPaths;
    if (!paths || paths.length === 0) {
      try {
        const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/x-janus-nodes');
        if (raw) paths = JSON.parse(raw);
      } catch {
        paths = null;
      }
    }
    globalDragPaths = null;

    if (paths && Array.isArray(paths) && paths.length > 0) {
      // Only move items that are not already at root
      const toMove = getValidMoveItems(paths, '');
      if (toMove.length > 0) {
        await handleMoveItems(toMove, '');
      }
    }
  };

  const handleCreateNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNoteTitle.trim()) {
      await createNewNote(newNoteTitle.trim());
      setNewNoteTitle('');
      setIsCreatingNote(false);
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderPath.trim()) {
      await createFolder(newFolderPath.trim());
      setNewFolderPath('');
      setIsCreatingFolder(false);
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-sidebar select-none overflow-hidden"
      onClick={() => {
        // Deselect if clicking on empty panel area outside nodes
        setSelectedPaths(new Set());
      }}
    >
      {/* Header controls */}
      <div 
        onClick={e => e.stopPropagation()} 
        className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-border-subtle/50 flex-shrink-0"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Explorer {selectedPaths.size > 1 ? `(${selectedPaths.size} selected)` : ''}
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setIsCreatingNote(true);
              setIsCreatingFolder(false);
            }}
            title="Create New Note"
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsCreatingFolder(true);
              setIsCreatingNote(false);
            }}
            title="Create New Folder"
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={refreshFiles}
            disabled={isLoading}
            title="Refresh Vault Files"
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div 
          onClick={e => e.stopPropagation()}
          className="mx-2 mt-2 p-2 bg-red-950/80 border border-red-800/60 rounded text-[11px] text-red-200 flex items-start justify-between flex-shrink-0 animate-in fade-in duration-150"
        >
          <div className="flex items-start space-x-1.5 flex-1 pr-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
          <button
            onClick={dismissErrorMessage}
            className="text-red-400 hover:text-red-200 p-0.5 rounded transition-colors"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter search bar */}
      <div onClick={e => e.stopPropagation()} className="px-3 py-2 flex-shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-surface/70 border border-border-subtle rounded-md pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/80 focus:bg-surface transition-all"
          />
        </div>
      </div>

      {/* New Note inline input form */}
      {isCreatingNote && (
        <form 
          onClick={e => e.stopPropagation()} 
          onSubmit={handleCreateNoteSubmit} 
          className="px-3 py-1.5 flex-shrink-0 bg-surface/40"
        >
          <input
            type="text"
            autoFocus
            value={newNoteTitle}
            onChange={e => setNewNoteTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setIsCreatingNote(false);
            }}
            placeholder="Note name (e.g. roadmap.md)"
            className="w-full bg-surface border border-accent rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
          />
          <div className="flex justify-end space-x-1 mt-1 text-[10px]">
            <button
              type="button"
              onClick={() => setIsCreatingNote(false)}
              className="px-2 py-0.5 text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-0.5 bg-accent text-white rounded hover:bg-accent-hover font-medium"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* New Folder inline input form */}
      {isCreatingFolder && (
        <form 
          onClick={e => e.stopPropagation()} 
          onSubmit={handleCreateFolderSubmit} 
          className="px-3 py-1.5 flex-shrink-0 bg-surface/40"
        >
          <input
            type="text"
            autoFocus
            value={newFolderPath}
            onChange={e => setNewFolderPath(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setIsCreatingFolder(false);
            }}
            placeholder="Folder name (e.g. docs/architecture)"
            className="w-full bg-surface border border-accent rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
          />
          <div className="flex justify-end space-x-1 mt-1 text-[10px]">
            <button
              type="button"
              onClick={() => setIsCreatingFolder(false)}
              className="px-2 py-0.5 text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-0.5 bg-accent text-white rounded hover:bg-accent-hover font-medium"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Pinned Inbox Item */}
      <div
        onClick={e => { e.stopPropagation(); openNote('Inbox.md'); }}
        title="Open Inbox (Cmd+Shift+I)"
        className={`mx-2 mt-2 mb-1 flex items-center space-x-2 px-2 py-1.5 rounded-md cursor-pointer transition-all flex-shrink-0 border ${
          activeTabPath === 'Inbox.md'
            ? 'bg-accent/20 border-accent/50 text-accent'
            : 'bg-surface/50 border-border-subtle/60 text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-border-subtle'
        }`}
      >
        <Inbox className={`w-3.5 h-3.5 flex-shrink-0 ${activeTabPath === 'Inbox.md' ? 'text-accent' : 'text-amber-400'}`} />
        <span className="text-xs font-semibold flex-1">Inbox</span>
        <span className="text-[9px] text-text-dim font-mono opacity-60">⌘⇧I</span>
      </div>

      {/* File Tree List & Root Drop Target */}
      <div 
        ref={containerRef}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        className={`flex-1 overflow-y-auto px-1 py-1 space-y-0.5 transition-colors relative ${
          isDragOverRoot ? 'bg-accent/5 ring-1 ring-dashed ring-accent/60' : ''
        }`}
      >
        {filteredFileTree.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted">
            <p>No files in Vault</p>
            <div className="mt-2 flex flex-col items-center space-y-1">
              <button
                onClick={() => {
                  setIsCreatingNote(true);
                  setIsCreatingFolder(false);
                }}
                className="text-accent hover:underline text-xs"
              >
                + Create note
              </button>
              <button
                onClick={() => {
                  setIsCreatingFolder(true);
                  setIsCreatingNote(false);
                }}
                className="text-accent hover:underline text-xs"
              >
                + Create folder
              </button>
            </div>
          </div>
        ) : (
          <>
            {filteredFileTree.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                level={0}
                activePath={activeTabPath}
                selectedPaths={selectedPaths}
                collapsedFolders={collapsedFolders}
                onToggleCollapse={handleToggleCollapse}
                onNodeClick={handleNodeClick}
                onMoveItems={handleMoveItems}
                setSelectedPaths={setSelectedPaths}
                setLastSelectedPath={setLastSelectedPath}
                filterText={filterText}
              />
            ))}
            {isDragOverRoot && (
              <div className="py-2 px-3 text-center text-[10px] text-accent font-medium border border-dashed border-accent/40 rounded bg-accent/10 mt-1">
                Drop to move to Vault Root
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
