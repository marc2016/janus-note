import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Table as TableIcon,
  Tag,
  CheckSquare,
  FolderOpen,
  Sparkles,
  ShieldCheck,
  FileCode2,
  Plus,
  FileText,
  Layers,
  Inbox,
  SendToBack
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { CompanionBlock } from './CompanionBlock';
import { TriageModal } from './TriageModal';

// Custom NodeView for codeblocks that intercepts 'tasks' and 'chart'
const CustomCodeBlockView: React.FC<any> = ({ node }) => {
  const language = node.attrs.language || '';
  const textContent = node.textContent;

  if (language === 'tasks' || language === 'chart') {
    return (
      <NodeViewWrapper className="companion-node-view my-2">
        <CompanionBlock type={language} rawCode={textContent} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="code-block-wrapper relative my-3">
      <div className="flex items-center justify-between px-3 py-1 bg-surface-hover/80 rounded-t-lg border-t border-x border-border-subtle text-[11px] text-text-muted font-mono select-none">
        <span>{language || 'code'}</span>
      </div>
      <pre className="p-3 bg-surface rounded-b-lg border border-border-subtle overflow-x-auto text-xs font-mono text-text-primary">
        <NodeViewContent className="code-content" />
      </pre>
    </NodeViewWrapper>
  );
};

const ExtendedCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CustomCodeBlockView);
  }
});

export const TipTapEditor: React.FC = () => {
  const {
    vaultInfo,
    activeTab,
    fileTree,
    openNote,
    createNewNote,
    viewMode,
    updateActiveContent,
    selectVault,
    openSampleVault,
    externalModificationBanner,
    dismissBanner,
    reloadExternalFile
  } = useVault();

  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const isInbox = activeTab?.path === 'Inbox.md';

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef<number>(0);

  // Synchronize scroll position between Edit and Reading mode
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      scrollPosRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollPosRef.current;
    }
  }, [viewMode]);

  const editor = useEditor({
    editorProps: {
      attributes: {
        class: 'focus:outline-none outline-none border-none ring-0 min-h-[400px]',
      },
    },
    extensions: [
      StarterKit.configure({
        codeBlock: false
      }),
      ExtendedCodeBlock,
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder: 'Write your thoughts, plans, or insert companion blocks...'
      })
    ],
    content: activeTab?.content || '',
    editable: viewMode === 'edit',
    onUpdate: ({ editor }) => {
      // TipTap text or HTML update
      const html = editor.getHTML();
      updateActiveContent(html);
    }
  });

  // Update editor content when active tab changes or content is externally reset (e.g. after triage)
  useEffect(() => {
    if (editor && activeTab) {
      if (editor.getHTML() !== activeTab.content) {
        editor.commands.setContent(activeTab.content);
      }
    }
  }, [activeTab?.path, activeTab?.contentVersion, editor]);

  // Update editable property when viewMode toggles
  useEffect(() => {
    if (editor) {
      editor.setEditable(viewMode === 'edit');
    }
  }, [viewMode, editor]);

  // State 1: No Vault selected yet -> Onboarding Hero
  if (!vaultInfo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-canvas select-none overflow-y-auto">
        <div className="max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-surface border border-border-strong flex items-center justify-center text-accent shadow-xl mb-5">
            <Layers className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-2">
            Welcome to Janus Note
          </h2>

          <p className="text-xs text-text-secondary leading-relaxed mb-6">
            Janus Note is a local-first workspace pairing standard Markdown prose with structured companion data files. Choose a local folder to get started.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full mb-8">
            <button
              onClick={selectVault}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-accent text-white font-medium text-xs hover:bg-accent-hover shadow-lg transition-all"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Select Vault Folder</span>
            </button>

            <button
              onClick={openSampleVault}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-surface border border-border-strong text-text-primary font-medium text-xs hover:bg-surface-hover hover:border-purple-500/50 transition-all"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Open Sample Vault</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full text-left">
            <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1.5" />
              <div className="text-[11px] font-semibold text-text-primary">100% Local</div>
              <div className="text-[10px] text-text-muted mt-0.5">Your files stay on your machine</div>
            </div>

            <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle">
              <FileCode2 className="w-4 h-4 text-purple-400 mb-1.5" />
              <div className="text-[11px] font-semibold text-text-primary">Companion Files</div>
              <div className="text-[10px] text-text-muted mt-0.5">Embed tasks & charts directly</div>
            </div>

            <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle">
              <CheckSquare className="w-4 h-4 text-accent mb-1.5" />
              <div className="text-[11px] font-semibold text-text-primary">Block Editor</div>
              <div className="text-[10px] text-text-muted mt-0.5">WYSIWYG & Reading modes</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Vault selected, but no note open -> Launchpad
  if (!activeTab) {
    const markdownNotes = fileTree.filter(f => !f.is_dir && f.path.endsWith('.md'));

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-canvas select-none overflow-y-auto">
        <div className="max-w-sm w-full flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center text-accent mb-3">
            <FolderOpen className="w-6 h-6" />
          </div>

          <h3 className="text-base font-semibold text-text-primary mb-1">
            Vault: {vaultInfo.name}
          </h3>

          <p className="text-xs text-text-muted mb-5">
            Select a document from the File Explorer on the left, or create a new note to start writing.
          </p>

          <button
            onClick={() => createNewNote()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors shadow-sm mb-6"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Note</span>
          </button>

          {markdownNotes.length > 0 && (
            <div className="w-full text-left">
              <div className="text-[10px] uppercase font-semibold text-text-dim px-1 mb-2">
                Available Notes in Vault
              </div>
              <div className="space-y-1">
                {markdownNotes.map(n => (
                  <div
                    key={n.path}
                    onClick={() => openNote(n.path)}
                    className="flex items-center px-3 py-2 rounded-lg bg-surface/60 border border-border-subtle hover:border-accent/60 cursor-pointer text-xs transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-accent mr-2" />
                    <span className="truncate font-medium text-text-primary">{n.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const frontmatterKeys = Object.keys(activeTab.frontmatter || {}).filter(k => !k.startsWith('_'));

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden relative">
      {/* External modification warning banner */}
      {externalModificationBanner && (
        <div className="bg-amber-950/70 border-b border-amber-700/60 px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-20 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>{externalModificationBanner}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => reloadExternalFile(activeTab.path)}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-[11px] transition-colors"
            >
              Reload from Disk
            </button>
            <button
              onClick={dismissBanner}
              className="px-2 py-1 bg-surface/80 hover:bg-surface text-amber-200 rounded font-medium text-[11px] transition-colors"
            >
              Keep My Edits
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode Formatting Toolbar */}
      {viewMode === 'edit' && editor && (
        <div className="px-4 py-1.5 border-b border-border-subtle bg-sidebar-subtle/40 flex items-center space-x-1 overflow-x-auto flex-shrink-0 select-none z-10">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('bold') ? 'bg-surface text-accent font-bold' : 'text-text-secondary'
            }`}
            title="Bold (Cmd+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('italic') ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Italic (Cmd+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-border-subtle mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-border-subtle mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('bulletList') ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('orderedList') ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('taskList') ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Task Checklist"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('blockquote') ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded hover:bg-surface transition-colors ${
              editor.isActive('codeBlock') ? 'bg-surface text-accent' : 'text-text-secondary'
            }`}
            title="Code Block"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            className="p-1.5 rounded hover:bg-surface text-text-secondary transition-colors"
            title="Insert Table"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Inbox Action Banner — shown only when Inbox.md is the active note */}
      {isInbox && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-950/30 border-b border-amber-800/40 flex-shrink-0">
          <div className="flex items-center space-x-2 text-xs text-amber-300/80">
            <Inbox className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">Quick-capture Inbox</span>
            <span className="text-amber-500/60">— schreibe einfach drauf los, dann einsortieren</span>
          </div>
          <button
            id="inbox-triage-button"
            onClick={() => setIsTriageOpen(true)}
            title="Einsortieren (Cmd+Shift+T)"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400/60 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-all"
          >
            <SendToBack className="w-3.5 h-3.5" />
            <span>Einsortieren</span>
            <span className="text-[9px] font-mono text-amber-400/50 ml-0.5">⌘⇧T</span>
          </button>
        </div>
      )}

      {/* Triage Modal */}
      {isTriageOpen && isInbox && (
        <TriageModal
          snippet={activeTab?.content?.trim() ?? ''}
          onClose={() => setIsTriageOpen(false)}
        />
      )}

      {/* Editor Main Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 md:px-12 py-8"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {/* YAML Frontmatter Metadata Banner */}
          {frontmatterKeys.length > 0 && (
            <div className="p-3.5 rounded-xl bg-surface/50 border border-border-subtle select-none">
              <div className="flex items-center space-x-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span>Frontmatter Metadata</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {frontmatterKeys.map(key => {
                  const val = activeTab.frontmatter[key];
                  const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
                  return (
                    <div
                      key={key}
                      className="px-2.5 py-1 rounded-md bg-surface border border-border-subtle flex items-center space-x-1.5"
                    >
                      <span className="text-text-dim font-medium">{key}:</span>
                      <span className="text-text-primary font-mono">{displayVal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TipTap Document Render */}
          <div
            className={`prose prose-invert max-w-none focus:outline-none ${
              viewMode === 'preview' ? 'reading-mode' : 'edit-mode'
            }`}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
};
