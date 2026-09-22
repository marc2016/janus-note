import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  FileText,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  Check,
  Wrench,
  Loader2,
  Copy,
} from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { useVault } from '../../context/VaultContext';
import { llmService } from '../../services/llm/LlmService';
import { aiSettingsService } from '../../services/settings/aiSettingsService';
import { createAgentGraph, PendingApprovalData, ClarificationData } from '../../services/agent/agentGraph';
import { HumanMessage } from '@langchain/core/messages';

interface ToolBadge {
  name: string;
  status: 'running' | 'success' | 'failed';
  detail?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  toolBadges?: ToolBadge[];
  clarification?: ClarificationData;
  pendingApproval?: PendingApprovalData;
}

export const JanusAgentPanel: React.FC = () => {
  const {
    activeTab,
    updateActiveContent,
    openNote,
    refreshFiles,
    reloadExternalFile,
    editorSelection,
  } = useVault();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: 'Hallo! Ich bin Janus, dein autonomer Projekt- und Wissensassistent. Ich kann deine Notizen durchsuchen, bearbeiten, Tasklisten (*.tasks.json) und Diagramme (*.chart.json / Mermaid) erstellen und strukturieren.',
      timestamp: 'Jetzt',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentStepText, setCurrentStepText] = useState<string | null>(null);
  const [activeModelName, setActiveModelName] = useState(() => llmService.getActiveModel());
  const [activeProviderName, setActiveProviderName] = useState(() => aiSettingsService.getSettings().activeProviderId);

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (msgId: string, text: string) => {
    if (!text.trim()) return;
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedMessageId(msgId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    }
  };

  // Active thread ID for LangGraph checkpointer
  const [threadId] = useState(() => `thread_${Date.now()}`);
  const agentGraph = useMemo(() => createAgentGraph(), []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Keep active model/provider in sync with settings
  useEffect(() => {
    return aiSettingsService.subscribe((s) => {
      setActiveProviderName(s.activeProviderId);
      setActiveModelName(llmService.getActiveModel(s.activeProviderId));
    });
  }, []);

  // Auto-scroll to bottom on new messages or step updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, currentStepText]);

  // Find if there is an active pending approval or clarification in the latest message
  const activeApproval = messages[messages.length - 1]?.pendingApproval;
  const activeClarification = messages[messages.length - 1]?.clarification;

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userText) setInput('');
    setIsTyping(true);
    setCurrentStepText('Analysiere Anfrage...');

    const agentMsgId = (Date.now() + 1).toString();
    const initialAgentMsg: Message = {
      id: agentMsgId,
      sender: 'agent',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      toolBadges: [],
    };

    setMessages((prev) => [...prev, initialAgentMsg]);

    try {
      const settings = aiSettingsService.getSettings();
      const currentModel = llmService.getActiveModel();

      if (!currentModel) {
        throw new Error(
          `Kein Modell für ${settings.activeProviderId === 'ollama' ? 'Ollama' : 'Google Gemini'} ausgewählt.\nBitte klicke oben auf das Modell-Badge, um die AI Config zu öffnen.`
        );
      }

      // Prepare context if active note exists
      let promptContent = textToSend.trim();
      if (activeTab) {
        const truncatedContent =
          activeTab.content.length > 25000
            ? activeTab.content.slice(0, 25000) + '\n...[Inhalt gekürzt]'
            : activeTab.content;

        let noteContext = `[Aktive Notiz im Editor: "${activeTab.title}" (${activeTab.path})]\n[Inhalt der aktiven Notiz:\n${truncatedContent}\n]`;
        if (editorSelection && editorSelection.trim().length > 0) {
          noteContext += `\n[Aktuell im Editor markierter Textauszug:\n"${editorSelection.trim()}"\n]`;
        }
        promptContent = `${noteContext}\n\n[Anfrage des Nutzers:]\n${promptContent}`;
      }

      const config = { configurable: { thread_id: threadId } };
      let result: any;

      if (activeClarification) {
        await agentGraph.updateState(config, {
          messages: [new HumanMessage(textToSend.trim())],
        });
        result = await agentGraph.invoke(null, config);
      } else {
        result = await agentGraph.invoke(
          { messages: [new HumanMessage(promptContent)] },
          config
        );
      }

      // Extract last AI message and any interrupted state
      const allMsgs = result.messages || [];
      const lastAiMsg = [...allMsgs].reverse().find((m: any) => m.getType() === 'ai');
      const toolMessages = allMsgs.filter((m: any) => m.getType() === 'tool');

      const toolBadges: ToolBadge[] = toolMessages.map((tm: any) => ({
        name: tm.name || 'tool',
        status: tm.content.startsWith('Error') ? 'failed' : 'success',
        detail: tm.content.slice(0, 50),
      }));

      const finalContent =
        lastAiMsg?.content ||
        (result.clarification
          ? 'Ich habe eine kurze Rückfrage:'
          : result.pendingApproval
          ? 'Bestätigung erforderlich:'
          : 'Aktion abgeschlossen.');

      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text: typeof finalContent === 'string' ? finalContent : JSON.stringify(finalContent),
                toolBadges,
                clarification: result.clarification || undefined,
                pendingApproval: result.pendingApproval || undefined,
              }
            : {
                ...m,
                clarification: undefined,
                pendingApproval: undefined,
              }
        )
      );

      // Refresh file tree and reload active note in editor so user sees changes immediately
      await refreshFiles();
      if (activeTab) {
        await reloadExternalFile(activeTab.path);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Ausführung durch den Agenten fehlgeschlagen.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text: `⚠️ **Fehler bei der Agenten-Ausführung:**\n${errorMsg}\n\n*Tipp:* Überprüfe deine AI Config Verbindung.`,
              }
            : m
        )
      );
    } finally {
      setIsTyping(false);
      setCurrentStepText(null);
    }
  };

  const handleResumeApproval = async (approved: boolean) => {
    if (!activeApproval || isTyping) return;

    setIsTyping(true);
    setCurrentStepText(approved ? 'Wende genehmigte Änderungen an...' : 'Verwerfe Änderung...');

    const agentMsgId = Date.now().toString();
    const config = { configurable: { thread_id: threadId } };

    try {
      await agentGraph.updateState(config, {
        approvalDecision: approved ? 'approved' : 'rejected',
      });
      const result = await agentGraph.invoke(null, config);

      const allMsgs = result.messages || [];
      const lastAiMsg = [...allMsgs].reverse().find((m: any) => m.getType() === 'ai');

      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, pendingApproval: undefined })),
        {
          id: agentMsgId,
          sender: 'agent',
          text: (lastAiMsg?.content as string) || (approved ? 'Änderung angewendet.' : 'Änderung abgebrochen.'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      // Refresh file tree and reload active note in editor
      await refreshFiles();
      if (activeTab) {
        await reloadExternalFile(activeTab.path);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: 'agent',
          text: `⚠️ Fehler beim Anwenden: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
      setCurrentStepText(null);
    }
  };

  const handleResumeClarification = (choice: string) => {
    handleSend(choice);
  };

  const handleEmbedTasks = () => {
    if (!activeTab) return;
    const taskEmbed = '\n\n```tasks\nsrc: "tasks/sprint-1.tasks.json"\nview: "board"\n```\n';
    updateActiveContent(activeTab.content + taskEmbed);
  };

  return (
    <div className="flex flex-col h-full bg-sidebar select-none overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border-subtle/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Janus Agent
          </span>
        </div>

        {/* Model & Config Shortcut Badge */}
        <button
          onClick={() => openNote('virtual:ai-config')}
          title="Klicken, um AI-Konfiguration zu öffnen"
          className="flex items-center space-x-1 text-[10px] text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30 px-2 py-0.5 rounded transition-colors"
        >
          <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate max-w-[110px] font-medium">
            {activeModelName || (activeProviderName === 'ollama' ? 'Ollama' : 'Gemini')}
          </span>
        </button>
      </div>

      {/* Active Note Context Pill */}
      {activeTab && (
        <div className="px-3 py-1.5 bg-surface/30 border-b border-border-subtle/30 flex items-center justify-between text-[11px] text-text-muted flex-shrink-0">
          <div className="flex items-center truncate">
            <FileText className="w-3 h-3 mr-1.5 text-accent flex-shrink-0" />
            <span className="truncate">
              Kontext: <span className="text-text-secondary font-medium">{activeTab.title}</span>
            </span>
          </div>
          {editorSelection && editorSelection.trim().length > 0 && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-medium border border-accent/25 truncate max-w-[130px]"
              title={`Markierter Text: "${editorSelection.slice(0, 100)}..."`}
            >
              Markiert ({editorSelection.trim().length} Zeichen)
            </span>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`relative group/msg max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.text && msg.text.trim().length > 0 ? 'pr-7' : ''
              } ${
                msg.sender === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border-subtle text-text-primary'
              }`}
            >
              {msg.text && msg.text.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => handleCopyMessage(msg.id, msg.text)}
                  className={`absolute top-1.5 right-1.5 p-1 rounded transition-all flex items-center space-x-1 ${
                    copiedMessageId === msg.id
                      ? 'opacity-100 pointer-events-auto'
                      : 'opacity-0 group-hover/msg:opacity-100 focus:opacity-100'
                  } ${
                    msg.sender === 'user'
                      ? 'text-white/80 hover:text-white bg-black/15 hover:bg-black/25'
                      : 'text-text-muted hover:text-text-primary bg-surface/90 hover:bg-surface-hover border border-border-subtle shadow-xs'
                  }`}
                  title={copiedMessageId === msg.id ? 'Kopiert!' : 'Nachricht kopieren'}
                  aria-label={copiedMessageId === msg.id ? 'Kopiert!' : 'Nachricht kopieren'}
                >
                  {copiedMessageId === msg.id ? (
                    <span className="flex items-center space-x-0.5 text-[10px] text-emerald-400">
                      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span className="font-medium">Kopiert!</span>
                    </span>
                  ) : (
                    <Copy className="w-3 h-3 flex-shrink-0" />
                  )}
                </button>
              )}

              {msg.text || (isTyping && msg.id === messages[messages.length - 1]?.id ? (
                <span className="inline-block w-1.5 h-3.5 bg-accent animate-pulse" />
              ) : null)}

              {/* Tool Execution Badges */}
              {msg.toolBadges && msg.toolBadges.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-subtle/70 flex flex-wrap gap-1">
                  {msg.toolBadges.map((badge, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded bg-surface/90 border border-border-subtle text-text-secondary"
                      title={badge.detail}
                    >
                      <Wrench className="w-2.5 h-2.5 text-accent" />
                      <span>{badge.name}</span>
                      {badge.status === 'success' ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Clarification Card */}
              {msg.clarification && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
                  <div className="flex items-center space-x-1.5 font-medium text-xs mb-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>Rückfrage des Agenten:</span>
                  </div>
                  <p className="text-xs mb-2 text-text-primary">{msg.clarification.question}</p>
                  {msg.clarification.options && msg.clarification.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.clarification.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => handleResumeClarification(opt)}
                          disabled={isTyping}
                          className="text-[11px] px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors disabled:opacity-50"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Diff Approval Card */}
              {msg.pendingApproval && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs">
                  <div className="flex items-center space-x-1.5 font-medium text-rose-300 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span>
                      Bestätigung erforderlich: {msg.pendingApproval.action === 'overwrite' ? 'Überschreiben' : 'Löschen'}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-text-muted mb-1 truncate">
                    {msg.pendingApproval.path}
                  </div>
                  {msg.pendingApproval.diff && (
                    <div className="text-[10px] font-mono bg-surface/90 rounded border border-border-subtle max-h-40 overflow-y-auto mb-2.5 p-1.5 space-y-0.5">
                      {msg.pendingApproval.diff.split('\n').map((line, lIdx) => {
                        let lineStyle = 'text-text-muted';
                        if (line.startsWith('+') && !line.startsWith('+++')) {
                          lineStyle = 'text-emerald-400 bg-emerald-500/15 px-1 rounded-sm';
                        } else if (line.startsWith('-') && !line.startsWith('---')) {
                          lineStyle = 'text-rose-400 bg-rose-500/15 px-1 rounded-sm';
                        } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
                          lineStyle = 'text-accent/80 font-semibold';
                        }
                        return (
                          <div key={lIdx} className={`${lineStyle} whitespace-pre-wrap break-all leading-tight`}>
                            {line || ' '}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleResumeApproval(true)}
                      disabled={isTyping}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center space-x-1 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      <span>Genehmigen</span>
                    </button>
                    <button
                      onClick={() => handleResumeApproval(false)}
                      disabled={isTyping}
                      className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border-subtle text-text-muted hover:text-text-primary text-[11px] transition-colors disabled:opacity-50"
                    >
                      <span>Ablehnen</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span className="text-[9px] text-text-dim mt-0.5 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-2 text-text-muted text-xs bg-surface/50 border border-border-subtle rounded-lg px-3 py-2 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]"></span>
            {currentStepText && <span className="text-[11px] text-text-secondary ml-1">{currentStepText}</span>}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Action Chips */}
      <div className="px-3 py-1.5 flex items-center space-x-1.5 overflow-x-auto flex-shrink-0 text-[10px]">
        <button
          onClick={() => handleSend('Fasse die Hauptpunkte dieser Notiz kurz zusammen.')}
          className="flex items-center space-x-1 px-2 py-1 rounded bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle whitespace-nowrap transition-colors"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Zusammenfassen</span>
        </button>

        <button
          onClick={() => handleSend('Erstelle eine Taskliste für die nächste Projektphase als companion Datei.')}
          className="flex items-center space-x-1 px-2 py-1 rounded bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle whitespace-nowrap transition-colors"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Taskliste planen</span>
        </button>

        {activeTab && (
          <button
            onClick={handleEmbedTasks}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-purple-950/40 text-purple-300 hover:bg-purple-900/40 border border-purple-800/40 whitespace-nowrap transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
            <span>Embed Tasks Block</span>
          </button>
        )}
      </div>

      {/* Input box */}
      <div className="p-3 border-t border-border-subtle/50 flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-1.5 bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 focus-within:border-accent transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeClarification
                ? 'Wähle eine Option oder antworte direkt...'
                : activeApproval
                ? 'Bitte bestätige die Dateiänderung oben...'
                : 'Frage den Janus Agent...'
            }
            className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-dim focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-1 rounded text-accent hover:text-accent-hover disabled:text-text-dim transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
