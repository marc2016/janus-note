import React, { useState, useEffect, useRef } from 'react';
import { X, Inbox, FolderPlus, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

interface TriageModalProps {
  /** The text snippet to triage. If empty, the entire Inbox content will be used. */
  snippet: string;
  onClose: () => void;
}

export const TriageModal: React.FC<TriageModalProps> = ({ snippet, onClose }) => {
  const { fileTree, triageContent } = useVault();
  const [destPath, setDestPath] = useState('');
  const [mode, setMode] = useState<'create' | 'append'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collect all existing notes for autocomplete suggestions
  const getAllNotes = (nodes: typeof fileTree): string[] => {
    const result: string[] = [];
    for (const n of nodes) {
      if (!n.is_dir && n.path.endsWith('.md') && n.path.toLowerCase() !== 'inbox.md') {
        result.push(n.path);
      }
      if (n.children) result.push(...getAllNotes(n.children));
    }
    return result;
  };

  const allNotes = getAllNotes(fileTree);
  const suggestions = destPath.trim()
    ? allNotes.filter(p => p.toLowerCase().includes(destPath.toLowerCase()))
    : [];

  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDest = destPath.trim();
    if (!cleanDest) {
      setError('Please enter a destination path');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await triageContent(snippet, cleanDest, mode);
      setSuccess(true);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message || 'Failed to triage content');
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = (path: string) => {
    setDestPath(path);
    setMode('append');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const previewLines = snippet.trim().split('\n').slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-sidebar border border-border-subtle rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle/60">
          <div className="flex items-center space-x-2">
            <Inbox className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-text-primary">Triage Inbox Snippet</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Snippet preview */}
        <div className="mx-4 mt-3 p-3 bg-surface/60 border border-border-subtle/50 rounded-lg">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-semibold">Snippet to file</div>
          <div className="text-xs text-text-secondary font-mono leading-relaxed">
            {previewLines.map((line, i) => (
              <div key={i} className="truncate">{line || <span className="text-text-dim">—</span>}</div>
            ))}
            {snippet.trim().split('\n').length > 4 && (
              <div className="text-text-dim mt-0.5">… ({snippet.trim().split('\n').length - 4} more lines)</div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Destination path */}
          <div className="relative">
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-semibold">
              Destination note path
            </label>
            <input
              ref={inputRef}
              type="text"
              value={destPath}
              onChange={e => {
                setDestPath(e.target.value);
                setShowSuggestions(true);
                setMode(allNotes.includes(e.target.value) ? 'append' : 'create');
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. projects/janus/ideas.md"
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/80 focus:ring-1 focus:ring-accent/30 transition-all"
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-sidebar border border-border-subtle rounded-lg shadow-xl overflow-hidden z-10 max-h-40 overflow-y-auto">
                {suggestions.slice(0, 8).map(note => (
                  <div
                    key={note}
                    onMouseDown={() => handleSuggestionClick(note)}
                    className="flex items-center space-x-2 px-3 py-1.5 hover:bg-surface-hover cursor-pointer text-xs text-text-secondary"
                  >
                    <FileText className="w-3 h-3 text-text-muted flex-shrink-0" />
                    <span className="truncate">{note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mode selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-semibold">
              Action
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  mode === 'create'
                    ? 'bg-accent/20 border-accent/60 text-accent'
                    : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create new note</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('append')}
                className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  mode === 'append'
                    ? 'bg-accent/20 border-accent/60 text-accent'
                    : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Append to note</span>
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="px-4 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover text-white rounded-lg transition-all disabled:opacity-60 flex items-center space-x-1.5"
            >
              {success ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /><span>Filed!</span></>
              ) : isSubmitting ? (
                <span>Filing…</span>
              ) : (
                <><Inbox className="w-3.5 h-3.5" /><span>Move & Clean Inbox</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
