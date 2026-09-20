import React, { useState } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

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
  const { activeTab, updateActiveContent } = useVault();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: "Hello! I'm Janus, your local-first AI copilot. I work directly with your Markdown notes and schema-validated companion files without sending your Vault to the cloud.",
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!userText) setInput('');
    setIsTyping(true);

    // Simulate Agent response
    setTimeout(() => {
      let agentResponse: Message;

      if (textToSend.toLowerCase().includes('task') || textToSend.toLowerCase().includes('sprint')) {
        agentResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `I've analyzed ${activeTab ? `"${activeTab.title}"` : 'your notes'} and can create or update companion task files. Here is the companion block embed you can include:`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCall: {
            name: 'vault_write_file',
            target: 'tasks/sprint-1.tasks.json',
            status: 'success'
          }
        };
      } else if (textToSend.toLowerCase().includes('chart') || textToSend.toLowerCase().includes('roadmap')) {
        agentResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: "I can construct a schema-validated chart companion file for this note.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCall: {
            name: 'vault_write_file',
            target: 'charts/architecture.chart.json',
            status: 'success'
          }
        };
      } else {
        agentResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `I'm tracking active note context ${
            activeTab ? `("${activeTab.title}")` : '(No note open)'
          }. How can I assist with your planning or prose today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      setMessages(prev => [...prev, agentResponse]);
      setIsTyping(false);
    }, 600);
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
        <div className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
          <ShieldCheck className="w-3 h-3" />
          <span>Local Sandbox</span>
        </div>
      </div>

      {/* Active Note Context Pill */}
      {activeTab && (
        <div className="px-3 py-1.5 bg-surface/30 border-b border-border-subtle/30 flex items-center text-[11px] text-text-muted flex-shrink-0">
          <FileText className="w-3 h-3 mr-1.5 text-accent" />
          <span className="truncate">Context: <span className="text-text-secondary font-medium">{activeTab.title}</span></span>
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
              className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border-subtle text-text-primary'
              }`}
            >
              {msg.text}

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
          <div className="flex items-center space-x-1.5 text-text-muted text-xs bg-surface/50 border border-border-subtle rounded-lg px-3 py-2 w-24">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]"></span>
          </div>
        )}
      </div>

      {/* Suggested Action Chips */}
      <div className="px-3 py-1.5 flex items-center space-x-1.5 overflow-x-auto flex-shrink-0 text-[10px]">
        <button
          onClick={() => handleSend('Extract sprint tasks for this note')}
          className="flex items-center space-x-1 px-2 py-1 rounded bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle whitespace-nowrap transition-colors"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Sprint Tasks</span>
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
            placeholder="Ask Janus Agent..."
            className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-dim focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-1 rounded text-accent hover:text-accent-hover disabled:text-text-dim transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
