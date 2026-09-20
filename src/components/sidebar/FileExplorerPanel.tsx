import React, { useState } from 'react';
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
  ChevronDown 
} from 'lucide-react';
import { FileNode } from '../../types/vault';
import { useVault } from '../../context/VaultContext';

interface TreeNodeProps {
  node: FileNode;
  level: number;
  activePath: string | null;
  onSelect: (path: string) => void;
  filterText: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, activePath, onSelect, filterText }) => {
  const [isOpen, setIsOpen] = useState(true);

  const isSelected = activePath === node.path;
  const isMatch = filterText === '' || node.name.toLowerCase().includes(filterText.toLowerCase());

  if (!isMatch && !node.is_dir) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.is_dir) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  const isCompanionJson = node.name.endsWith('.tasks.json') || node.name.endsWith('.chart.json');

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${level * 14 + 10}px` }}
        className={`group flex items-center py-1.5 pr-2.5 rounded cursor-pointer text-xs transition-colors ${
          isSelected
            ? 'bg-accent/15 text-accent font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
        }`}
      >
        {node.is_dir ? (
          <span 
            onClick={handleToggle} 
            className="p-0.5 mr-1 hover:text-text-primary rounded text-text-muted transition-colors"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        ) : (
          <span className="w-3.5 mr-1 flex-shrink-0" />
        )}

        {node.is_dir ? (
          isOpen ? (
            <FolderOpen className="w-4 h-4 mr-2 text-accent/80 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 mr-2 text-text-muted flex-shrink-0" />
          )
        ) : isCompanionJson ? (
          <FileCode2 className="w-4 h-4 mr-2 text-purple-400 flex-shrink-0" />
        ) : (
          <FileText className="w-4 h-4 mr-2 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" />
        )}

        <span className="truncate flex-1">{node.name}</span>

        {isCompanionJson && (
          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40 ml-1">
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
              onSelect={onSelect}
              filterText={filterText}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorerPanel: React.FC = () => {
  const { fileTree, activeTabPath, openNote, createNewNote, createFolder, refreshFiles, isLoading } = useVault();
  const [filterText, setFilterText] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');

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
    <div className="flex flex-col h-full bg-sidebar select-none overflow-hidden">
      {/* Header controls */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-border-subtle/50 flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Explorer
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

      {/* Filter search bar */}
      <div className="px-3 py-2 flex-shrink-0">
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
        <form onSubmit={handleCreateNoteSubmit} className="px-3 py-1.5 flex-shrink-0 bg-surface/40">
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

      {/* New Folder inline input form (exact visual & behavioral parity with New Note) */}
      {isCreatingFolder && (
        <form onSubmit={handleCreateFolderSubmit} className="px-3 py-1.5 flex-shrink-0 bg-surface/40">
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

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
        {fileTree.length === 0 ? (
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
          fileTree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              activePath={activeTabPath}
              onSelect={openNote}
              filterText={filterText}
            />
          ))
        )}
      </div>
    </div>
  );
};
