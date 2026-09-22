import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { llmService } from '../../services/llm/LlmService';
import { aiSettingsService } from '../../services/settings/aiSettingsService';
import { LlmMessage } from '../../services/llm/types';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    target: string;
    status: 'success' | 'running';
  };
}

export const JanusAgentPanel: React.FC = () => {
  const { activeTab, updateActiveContent, openNote } = useVault();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: "Hallo! Ich bin Janus, dein KI-Assistent. Ich arbeite direkt mit deinen Notizen und Companion-Dateien. Stelle mir Fragen zu deiner aktuellen Notiz oder lass mich Aufgaben planen.",
      timestamp: 'Jetzt'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeModelName, setActiveModelName] = useState(() => llmService.getActiveModel());
  const [activeProviderName, setActiveProviderName] = useState(() => aiSettingsService.getSettings().activeProviderId);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Keep active model/provider in sync with settings
  useEffect(() => {
    return aiSettingsService.subscribe(s => {
      setActiveProviderName(s.activeProviderId);
      setActiveModelName(llmService.getActiveModel(s.activeProviderId));
    });
  }, []);

  // Auto-scroll to bottom on new messages or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!userText) setInput('');
    setIsTyping(true);

    const agentMsgId = (Date.now() + 1).toString();
    const initialAgentMsg: Message = {
      id: agentMsgId,
      sender: 'agent',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, initialAgentMsg]);

    try {
      const settings = aiSettingsService.getSettings();
      const currentModel = llmService.getActiveModel();

      if (!currentModel) {
        throw new Error(
          `Kein Modell für ${settings.activeProviderId === 'ollama' ? 'Ollama' : 'Google Gemini'} ausgewählt.\nBitte klicke links auf 'AI Config', um die Verbindung herzustellen und ein Modell auszuwählen.`
        );
      }

      // Prepare conversation messages
      const promptMessages: LlmMessage[] = [];

      // System prompt + active note context
      let systemContent = settings.systemPrompt || 'You are Janus Assistant, an intelligent note-taking AI copilot.';
      if (activeTab) {
        systemContent += `\n\n[Aktive Notiz im Editor]\nTitel: "${activeTab.title}"\nPfad: "${activeTab.path}"\nInhalt:\n${activeTab.content}`;
      }
      promptMessages.push({ role: 'system', content: systemContent });

      // Conversation turns
      for (const m of newMessages) {
        promptMessages.push({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        });
      }

      let fullText = '';
      for await (const chunk of llmService.chatStream({ messages: promptMessages })) {
        if (chunk.deltaText) {
          fullText += chunk.deltaText;
          setMessages(prev =>
            prev.map(m => (m.id === agentMsgId ? { ...m, text: fullText } : m))
          );
        }
      }

      if (!fullText.trim()) {
        setMessages(prev =>
          prev.map(m =>
            m.id === agentMsgId
              ? { ...m, text: 'Keine Textantwort vom Modell erhalten.' }
              : m
          )
        );
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Verbindung zum LLM fehlgeschlagen.';
      setMessages(prev =>
        prev.map(m =>
          m.id === agentMsgId
            ? {
                ...m,
                text: `⚠️ **Verbindungsfehler:**\n${errorMsg}\n\n*Tipp:* Klicke oben auf das Modell-Badge oder links auf **AI Config**, um Modell und Verbindung zu prüfen.`
              }
            : m
        )
      );
    } finally {
      setIsTyping(false);
    }
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
        <div className="px-3 py-1.5 bg-surface/30 border-b border-border-subtle/30 flex items-center text-[11px] text-text-muted flex-shrink-0">
          <FileText className="w-3 h-3 mr-1.5 text-accent" />
          <span className="truncate">Kontext: <span className="text-text-secondary font-medium">{activeTab.title}</span></span>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border-subtle text-text-primary'
              }`}
            >
              {msg.text || (isTyping && msg.id === messages[messages.length - 1]?.id ? (
                <span className="inline-block w-1.5 h-3.5 bg-accent animate-pulse" />
              ) : null)}

              {msg.toolCall && (
                <div className="mt-2 pt-2 border-t border-border-subtle/80 flex items-center justify-between text-[10px] text-text-muted">
                  <div className="flex items-center space-x-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Tool: {msg.toolCall.name}</span>
                  </div>
                  <span className="font-mono text-[9px] text-text-dim truncate max-w-[120px]">
                    {msg.toolCall.target}
                  </span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-text-dim mt-0.5 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-1.5 text-text-muted text-xs bg-surface/50 border border-border-subtle rounded-lg px-3 py-2 w-20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]"></span>
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
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-1.5 bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 focus-within:border-accent transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Frage den Janus Agent..."
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
