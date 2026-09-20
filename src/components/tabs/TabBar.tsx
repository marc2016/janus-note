import React from 'react';
import { X, FileText, Plus } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

export const TabBar: React.FC = () => {
  const { openTabs, activeTabPath, setActiveTab, closeTab, createNewNote } = useVault();

  if (openTabs.length === 0) {
    return null;
  }

  const handleAuxClick = (e: React.MouseEvent, path: string) => {
    // Middle-click closes the tab
    if (e.button === 1) {
      e.preventDefault();
      closeTab(path);
    }
  };

  return (
    <div className="h-9 bg-sidebar border-b border-border-subtle flex items-center select-none overflow-x-auto no-scrollbar flex-shrink-0">
      <div className="flex items-center h-full">
        {openTabs.map(tab => {
          const isActive = tab.path === activeTabPath;

          return (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              onAuxClick={e => handleAuxClick(e, tab.path)}
              className={`group flex items-center h-full px-3 text-xs border-r border-border-subtle cursor-pointer transition-colors relative min-w-[120px] max-w-[200px] ${
                isActive
                  ? 'bg-canvas text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface/50'
              }`}
            >
              {/* Active tab top indicator line */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent" />
              )}

              <FileText className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${isActive ? 'text-accent' : 'text-text-dim'}`} />

              <span className="truncate flex-1">{tab.title}</span>

              {/* Dirty indicator or close button */}
              <div className="flex items-center ml-2 flex-shrink-0">
                {tab.isDirty ? (
                  <div
                    onClick={e => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-surface-hover"
                    title="Unsaved changes - click to close"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"></span>
                    <X className="w-3 h-3 text-text-muted hover:text-text-primary hidden group-hover:block" />
                  </div>
                ) : (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    title="Close tab (Cmd+W)"
                    className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-text-primary hover:bg-surface-hover opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New tab button */}
      <button
        onClick={() => createNewNote()}
        title="Create New Note"
        className="px-2 py-1 mx-1 rounded text-text-dim hover:text-text-primary hover:bg-surface transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
