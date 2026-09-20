import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Inbox } from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { TriageModal } from '../editor/TriageModal';

export const TabBar: React.FC = () => {
  const { openTabs, activeTabPath, activeTab, setActiveTab, closeTab, createNewNote } = useVault();
  const [isTriageOpen, setIsTriageOpen] = useState(false);

  const isInboxActive = activeTabPath === 'Inbox.md';
  // Use the full inbox body as snippet (selection-based snippet is Phase 2)
  const inboxSnippet = activeTab?.content?.trim() ?? '';

  // Keyboard shortcut: Cmd+Shift+T to open Triage modal when Inbox is active
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 't' && isInboxActive) {
        e.preventDefault();
        setIsTriageOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isInboxActive]);

  const handleAuxClick = (e: React.MouseEvent, path: string) => {
    // Middle-click closes the tab
    if (e.button === 1) {
      e.preventDefault();
      closeTab(path);
    }
  };

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="h-9 bg-sidebar border-b border-border-subtle flex items-center select-none overflow-x-auto no-scrollbar flex-shrink-0">
        <div className="flex items-center h-full">
          {openTabs.map(tab => {
            const isActive = tab.path === activeTabPath;
            const isInbox = tab.path === 'Inbox.md';

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

                {isInbox ? (
                  <Inbox className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${isActive ? 'text-amber-400' : 'text-text-dim'}`} />
                ) : (
                  <FileText className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${isActive ? 'text-accent' : 'text-text-dim'}`} />
                )}

                <span className="truncate flex-1">{tab.title}</span>

                {/* Dirty indicator or close button — Inbox cannot be deleted/closed hides close */}
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

        {/* Triage button — only visible when Inbox.md is the active tab */}
        {isInboxActive && (
          <button
            onClick={() => setIsTriageOpen(true)}
            title="Triage Inbox (Cmd+Shift+T)"
            className="flex items-center space-x-1.5 px-3 h-full text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border-r border-border-subtle transition-all"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Triage</span>
            <span className="text-[9px] font-mono text-amber-400/60 ml-0.5">⌘⇧T</span>
          </button>
        )}

        {/* New tab button */}
        <button
          onClick={() => createNewNote()}
          title="Create New Note"
          className="px-2 py-1 mx-1 rounded text-text-dim hover:text-text-primary hover:bg-surface transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Triage Modal */}
      {isTriageOpen && (
        <TriageModal
          snippet={inboxSnippet}
          onClose={() => setIsTriageOpen(false)}
        />
      )}
    </>
  );
};
