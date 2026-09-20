import React from 'react';
import { 
  FolderOpen, 
  PanelLeft, 
  PanelRight, 
  Edit3, 
  BookOpen, 
  Save, 
  FileText,
  CheckCircle2
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { usePanelRegistry } from '../../context/PanelRegistryContext';

export const WindowHeader: React.FC = () => {
  const { 
    vaultInfo, 
    activeTab, 
    selectVault, 
    viewMode, 
    toggleViewMode, 
    saveActiveNote,
    isLoading
  } = useVault();

  const { 
    isLeftCollapsed, 
    isRightCollapsed, 
    toggleLeftCollapse, 
    toggleRightCollapse 
  } = usePanelRegistry();

  return (
    <header 
      data-tauri-drag-region 
      className="h-10 border-b border-border-subtle bg-sidebar flex items-center justify-between px-3 select-none flex-shrink-0 z-30"
    >
      {/* Left side: Mac traffic lights spacing & Left sidebar toggle & Vault picker */}
      <div className="flex items-center space-x-2 pl-18 md:pl-20">
        <button
          onClick={toggleLeftCollapse}
          title={isLeftCollapsed ? "Expand Left Sidebar (Cmd+B)" : "Collapse Left Sidebar"}
          className={`p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors ${
            !isLeftCollapsed ? 'bg-surface text-accent' : ''
          }`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={selectVault}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all border border-border-subtle"
          title="Click to switch or select active Vault folder"
        >
          <FolderOpen className="w-3.5 h-3.5 text-accent" />
          <span className="truncate max-w-[130px] font-semibold text-text-primary">
            {vaultInfo?.name || "Open Vault..."}
          </span>
        </button>
      </div>

      {/* Center: Note Title Breadcrumb & Save Status */}
      <div className="flex items-center space-x-2 text-xs text-text-muted truncate max-w-[320px] md:max-w-md pointer-events-none">
        {activeTab ? (
          <>
            <FileText className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
            <span className="truncate font-medium text-text-primary">
              {activeTab.title}
            </span>
            {activeTab.isDirty ? (
              <span className="flex items-center text-amber-400 font-normal space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Unsaved</span>
              </span>
            ) : (
              <span className="flex items-center text-emerald-400/80 font-normal space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Saved</span>
              </span>
            )}
          </>
        ) : (
          <span className="italic text-text-dim">No note open</span>
        )}
      </div>

      {/* Right side: View mode toggle, Save button & Right sidebar toggle */}
      <div className="flex items-center space-x-1.5">
        {activeTab && (
          <>
            <button
              onClick={saveActiveNote}
              title="Save Note (Cmd+S)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab.isDirty
                  ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              onClick={toggleViewMode}
              title={`Switch to ${viewMode === 'edit' ? 'Reading Mode' : 'Edit Mode'} (Cmd+E)`}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border border-border-subtle ${
                viewMode === 'preview'
                  ? 'bg-purple-900/30 text-purple-300 border-purple-700/50 hover:bg-purple-900/50'
                  : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {viewMode === 'edit' ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-accent" />
                  <span className="hidden sm:inline">Reading Mode</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Edit Mode</span>
                </>
              )}
            </button>
          </>
        )}

        <button
          onClick={toggleRightCollapse}
          title={isRightCollapsed ? "Expand Janus Agent Sidebar" : "Collapse Janus Agent Sidebar"}
          className={`p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors ${
            !isRightCollapsed ? 'bg-surface text-accent' : ''
          }`}
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
