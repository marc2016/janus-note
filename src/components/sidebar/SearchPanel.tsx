import React, { useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

export const SearchPanel: React.FC = () => {
  const { fileTree, openNote } = useVault();
  const [query, setQuery] = useState('');

  // Collect all files recursively
  const getAllFiles = (nodes: typeof fileTree): Array<{ name: string; path: string }> => {
    const list: Array<{ name: string; path: string }> = [];
    for (const n of nodes) {
      if (!n.is_dir) {
        list.push({ name: n.name, path: n.path });
      }
      if (n.children) {
        list.push(...getAllFiles(n.children));
      }
    }
    return list;
  };

  const allFiles = getAllFiles(fileTree);
  const results = query.trim()
    ? allFiles.filter(
        f =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.path.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full bg-sidebar select-none overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-border-subtle/50 flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Search Vault
        </span>
      </div>

      <div className="p-3 flex-shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search filenames..."
            className="w-full bg-surface/70 border border-border-subtle rounded-md pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/80 focus:bg-surface transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {query.trim() === '' ? (
          <div className="px-4 py-8 text-center text-xs text-text-dim">
            Type to search files in vault
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted">
            No matching files found
          </div>
        ) : (
          results.map(f => (
            <div
              key={f.path}
              onClick={() => openNote(f.path)}
              className="flex items-center px-2 py-1.5 rounded cursor-pointer text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <FileText className="w-4 h-4 mr-2 text-text-muted" />
              <div className="truncate">
                <div className="font-medium text-text-primary truncate">{f.name}</div>
                <div className="text-[10px] text-text-dim truncate">{f.path}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
