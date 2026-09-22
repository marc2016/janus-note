import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Inbox,
  FolderPlus,
  FileText,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Loader2,
  SlidersHorizontal,
  AlertCircle
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { aiTriageService, TriageRecommendation } from '../../services/triage/aiTriageService';
import { vaultService } from '../../services/vaultService';

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
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState<TriageRecommendation | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ai' | 'manual'>('ai');
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Run AI triage recommendation on mount by default
  const runAiAnalysis = async (contentToTriage: string) => {
    setIsAiAnalyzing(true);
    setAiError(null);

    try {
      let text = contentToTriage.trim();
      if (!text) {
        text = await vaultService.readFile('Inbox.md');
      }

      if (!text.trim()) {
        setIsAiAnalyzing(false);
        setViewMode('manual');
        return;
      }

      const rec = await aiTriageService.suggestTriage(text);
      setAiRecommendation(rec);
      setDestPath(rec.destPath);
      setMode(rec.mode);
      setViewMode('ai');
    } catch (err: any) {
      const msg = err?.message || 'AI triage could not analyze the note';
      setAiError(msg);
      // Fallback smoothly to manual mode on failure
      setViewMode('manual');
    } finally {
      setIsAiAnalyzing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  useEffect(() => {
    runAiAnalysis(snippet);
  }, [snippet]);

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
      setTimeout(() => onClose(), 700);
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

  const previewLines = snippet.trim()
    ? snippet.trim().split('\n').slice(0, 3)
    : ['(Full Inbox content)'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-sidebar border border-border-subtle rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle/60">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-md bg-accent/10 text-accent">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-text-primary">
                {viewMode === 'ai' ? 'AI Inbox Triage' : 'Manual Inbox Triage'}
              </span>
              <span className="text-[10px] text-text-muted ml-2 font-mono">
                {viewMode === 'ai' ? 'Default' : 'Custom'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'ai') {
                  setViewMode('manual');
                } else {
                  if (aiRecommendation) {
                    setViewMode('ai');
                  } else {
                    runAiAnalysis(snippet);
                  }
                }
              }}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-xs flex items-center space-x-1"
              title={viewMode === 'ai' ? 'Switch to manual input' : 'Switch to AI recommendation'}
            >
              {viewMode === 'ai' ? (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Manual</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px]">Use AI</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Snippet preview */}
        <div className="mx-4 mt-3 p-2.5 bg-surface/60 border border-border-subtle/50 rounded-lg">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1 font-semibold flex items-center space-x-1">
            <Inbox className="w-3 h-3 text-amber-400" />
            <span>Content to file</span>
          </div>
          <div className="text-xs text-text-secondary font-mono leading-relaxed">
            {previewLines.map((line, i) => (
              <div key={i} className="truncate">
                {line || <span className="text-text-dim">—</span>}
              </div>
            ))}
            {snippet.trim().split('\n').length > 3 && (
              <div className="text-text-dim mt-0.5">
                … ({snippet.trim().split('\n').length - 3} more lines)
              </div>
            )}
          </div>
        </div>

        {/* AI Loading State */}
        {isAiAnalyzing && (
          <div className="mx-4 mt-3 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              <div>
                <div className="text-xs font-medium text-text-primary">
                  AI is analyzing vault structure…
                </div>
                <div className="text-[11px] text-text-muted">
                  Finding optimal note destination and context
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAiAnalyzing(false);
                setViewMode('manual');
              }}
              className="text-[11px] text-text-secondary hover:text-accent font-medium px-2 py-1 rounded hover:bg-surface transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {/* AI Recommendation Card (When AI mode is active and resolved) */}
        {!isAiAnalyzing && viewMode === 'ai' && aiRecommendation && (
          <div className="mx-4 mt-3 p-3.5 bg-gradient-to-r from-accent/10 via-surface to-accent/5 border border-accent/30 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5 text-accent text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Recommendation</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                  mode === 'append'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {mode === 'append' ? 'Append to note' : 'Create new note'}
              </span>
            </div>
            <div className="text-xs text-text-secondary italic mb-2">
              „{aiRecommendation.reason}“
            </div>
            <div className="text-[11px] text-text-muted flex items-center space-x-1.5">
              <span className="font-semibold text-text-primary">Destination:</span>
              <code className="text-accent font-mono bg-sidebar/80 px-1.5 py-0.5 rounded border border-border-subtle">
                {destPath}
              </code>
            </div>
          </div>
        )}

        {/* AI Error / Fallback hint */}
        {aiError && (
          <div className="mx-4 mt-3 px-3 py-2 bg-amber-950/40 border border-amber-800/40 rounded-lg flex items-center space-x-2 text-xs text-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 truncate">
              {aiError} — <span className="text-text-muted">Manual filing active</span>
            </div>
          </div>
        )}

        {/* Triage Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Destination path */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Destination note path
              </label>
              {viewMode === 'ai' && aiRecommendation && (
                <span className="text-[10px] text-accent/80">Editable below</span>
              )}
            </div>
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
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent/80 focus:ring-1 focus:ring-accent/30 transition-all font-mono"
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-sidebar border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 max-h-40 overflow-y-auto">
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
                    ? 'bg-accent/20 border-accent/60 text-accent font-semibold'
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
                    ? 'bg-accent/20 border-accent/60 text-accent font-semibold'
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
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                disabled={isSubmitting || success || isAiAnalyzing || !destPath.trim()}
                className="px-4 py-2 text-xs font-semibold bg-accent hover:bg-accent-hover text-white rounded-lg transition-all disabled:opacity-50 flex items-center space-x-1.5 shadow-sm"
              >
                {success ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Filed!</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Filing…</span>
                  </>
                ) : viewMode === 'ai' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>File with AI (Enter)</span>
                  </>
                ) : (
                  <>
                    <Inbox className="w-3.5 h-3.5" />
                    <span>Move & Clean Inbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
