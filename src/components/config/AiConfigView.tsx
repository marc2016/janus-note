import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sparkles, 
  Server, 
  Cloud, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Check, 
  RotateCcw,
  Cpu,
  AlertCircle
} from 'lucide-react';
import { aiSettingsService, AiSettings } from '../../services/settings/aiSettingsService';
import { llmService } from '../../services/llm/LlmService';
import { LlmModel } from '../../services/llm/types';

export const AiConfigView: React.FC = () => {
  const [settings, setSettings] = useState<AiSettings>(() => aiSettingsService.getSettings());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savedNotification, setSavedNotification] = useState(false);

  // Ollama state
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ checked: boolean; ok: boolean; message?: string }>({
    checked: false,
    ok: false,
  });
  const [ollamaModels, setOllamaModels] = useState<LlmModel[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);

  // Gemini state
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<{ checked: boolean; ok: boolean; message?: string }>({
    checked: false,
    ok: false,
  });
  const [geminiModels, setGeminiModels] = useState<LlmModel[]>([]);
  const [isLoadingGeminiModels, setIsLoadingGeminiModels] = useState(false);

  const geminiDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to external settings changes
  useEffect(() => {
    return aiSettingsService.subscribe(newSettings => {
      setSettings(newSettings);
    });
  }, []);

  const handleUpdate = (patch: Partial<AiSettings>) => {
    const updated = aiSettingsService.updateSettings(patch);
    setSettings(updated);
    showSavedToast();
  };

  const showSavedToast = () => {
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  // ----------------------------------------------------
  // Ollama model fetching & connection
  // ----------------------------------------------------
  const loadOllamaModels = useCallback(async () => {
    if (!settings.ollama.baseUrl.trim()) {
      setOllamaModels([]);
      return;
    }

    setIsLoadingOllamaModels(true);
    try {
      const models = await llmService.listModels('ollama');
      setOllamaModels(models);

      if (models.length > 0) {
        // If current selectedModel is empty or not in the retrieved list, pick first real model
        if (!settings.ollama.selectedModel || !models.some(m => m.id === settings.ollama.selectedModel)) {
          handleUpdate({
            ollama: {
              ...settings.ollama,
              selectedModel: models[0].id,
            },
          });
        }
      } else {
        handleUpdate({
          ollama: {
            ...settings.ollama,
            selectedModel: '',
          },
        });
      }
    } catch (err: any) {
      console.warn('Could not auto-list Ollama models:', err.message);
      setOllamaModels([]);
    } finally {
      setIsLoadingOllamaModels(false);
    }
  }, [settings.ollama]);

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    try {
      const res = await llmService.checkConnection('ollama');
      setOllamaStatus({ checked: true, ok: res.ok, message: res.message });
      if (res.ok) {
        await loadOllamaModels();
      } else {
        setOllamaModels([]);
      }
    } finally {
      setIsTestingOllama(false);
    }
  };

  // ----------------------------------------------------
  // Gemini model fetching & connection
  // ----------------------------------------------------
  const loadGeminiModels = useCallback(async (apiKeyOverride?: string) => {
    const key = apiKeyOverride !== undefined ? apiKeyOverride : settings.gemini.apiKey;
    if (!key || !key.trim()) {
      setGeminiModels([]);
      setGeminiStatus({ checked: false, ok: false });
      return;
    }

    setIsLoadingGeminiModels(true);
    try {
      const models = await llmService.listModels('gemini');
      setGeminiModels(models);

      if (models.length > 0) {
        setGeminiStatus({ checked: true, ok: true, message: `${models.length} Modelle verfügbar` });
        if (!settings.gemini.selectedModel || !models.some(m => m.id === settings.gemini.selectedModel)) {
          handleUpdate({
            gemini: {
              ...settings.gemini,
              selectedModel: models[0].id,
            },
          });
        }
      } else {
        setGeminiStatus({ checked: true, ok: false, message: 'Keine Modelle mit Berechtigung gefunden' });
        setGeminiModels([]);
        handleUpdate({
          gemini: {
            ...settings.gemini,
            selectedModel: '',
          },
        });
      }
    } catch (err: any) {
      setGeminiStatus({ checked: true, ok: false, message: err.message || 'Key-Validierung fehlgeschlagen' });
      setGeminiModels([]);
    } finally {
      setIsLoadingGeminiModels(false);
    }
  }, [settings.gemini]);

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    try {
      const res = await llmService.checkConnection('gemini');
      setGeminiStatus({ checked: true, ok: res.ok, message: res.message });
      if (res.ok) {
        await loadGeminiModels();
      } else {
        setGeminiModels([]);
      }
    } finally {
      setIsTestingGemini(false);
    }
  };

  // Auto-fetch on mount: Ollama if URL is set; Gemini if API key is set
  useEffect(() => {
    if (settings.ollama.baseUrl.trim()) {
      loadOllamaModels();
    }
    if (settings.gemini.apiKey.trim()) {
      loadGeminiModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user edits Gemini API key: debounce auto-fetch once user stops typing
  const handleGeminiKeyChange = (newKey: string) => {
    handleUpdate({ gemini: { ...settings.gemini, apiKey: newKey, selectedModel: '' } });
    setGeminiModels([]);
    setGeminiStatus({ checked: false, ok: false });

    if (geminiDebounceTimer.current) {
      clearTimeout(geminiDebounceTimer.current);
    }

    if (newKey.trim().length >= 10) {
      geminiDebounceTimer.current = setTimeout(() => {
        loadGeminiModels(newKey);
      }, 700);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all AI settings to factory defaults?')) {
      const reset = aiSettingsService.resetSettings();
      setSettings(reset);
      setOllamaModels([]);
      setGeminiModels([]);
      setOllamaStatus({ checked: false, ok: false });
      setGeminiStatus({ checked: false, ok: false });
      showSavedToast();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-canvas p-6 max-w-4xl mx-auto w-full text-text-primary select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-border-subtle">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">AI & Model Configuration</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Configure local and cloud-based Large Language Models for the embedded Janus Agent.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {savedNotification && (
            <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium animate-fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>Settings saved</span>
            </span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border-subtle hover:bg-surface text-text-muted hover:text-text-primary text-xs transition-colors"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="mb-8">
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-3">
          Active AI Provider
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Ollama Card */}
          <div
            onClick={() => handleUpdate({ activeProviderId: 'ollama' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start space-x-3.5 ${
              settings.activeProviderId === 'ollama'
                ? 'bg-accent/10 border-accent text-text-primary shadow-sm ring-1 ring-accent/30'
                : 'bg-surface/50 border-border-subtle text-text-muted hover:border-border-strong hover:bg-surface'
            }`}
          >
            <div className={`p-2 rounded-lg ${settings.activeProviderId === 'ollama' ? 'bg-accent text-canvas' : 'bg-surface text-text-dim'}`}>
              <Server className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">Ollama (Local-First)</span>
                {settings.activeProviderId === 'ollama' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-accent/20 text-accent rounded-full border border-accent/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                100% offline, privacy-focused execution on your local hardware. No API keys or cloud subscriptions needed.
              </p>
            </div>
          </div>

          {/* Gemini Card */}
          <div
            onClick={() => handleUpdate({ activeProviderId: 'gemini' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start space-x-3.5 ${
              settings.activeProviderId === 'gemini'
                ? 'bg-accent/10 border-accent text-text-primary shadow-sm ring-1 ring-accent/30'
                : 'bg-surface/50 border-border-subtle text-text-muted hover:border-border-strong hover:bg-surface'
            }`}
          >
            <div className={`p-2 rounded-lg ${settings.activeProviderId === 'gemini' ? 'bg-accent text-canvas' : 'bg-surface text-text-dim'}`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">Google Gemini (Cloud)</span>
                {settings.activeProviderId === 'gemini' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-accent/20 text-accent rounded-full border border-accent/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                High-capacity cloud reasoning with long context windows and fast tool calling using your Google AI API key.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ollama Section */}
      <div className="mb-8 p-5 bg-surface/40 rounded-xl border border-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-text-primary">Ollama Configuration</h2>
          </div>
          {ollamaStatus.checked && (
            <span className={`flex items-center space-x-1.5 text-xs ${ollamaStatus.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {ollamaStatus.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{ollamaStatus.message || (ollamaStatus.ok ? 'Connected' : 'Offline')}</span>
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Server Endpoint URL</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={settings.ollama.baseUrl}
                onChange={e => {
                  handleUpdate({ ollama: { ...settings.ollama, baseUrl: e.target.value, selectedModel: '' } });
                  setOllamaStatus({ checked: false, ok: false });
                }}
                placeholder="http://127.0.0.1:11434"
                className="flex-1 bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleTestOllama}
                disabled={isTestingOllama}
                className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isTestingOllama && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isTestingOllama ? 'Verbinde...' : 'Verbindung testen'}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-secondary">Verfügbares Modell</label>
              <button
                onClick={loadOllamaModels}
                disabled={isLoadingOllamaModels}
                className="text-[11px] text-accent hover:underline flex items-center space-x-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingOllamaModels ? 'animate-spin' : ''}`} />
                <span>Modelle aktualisieren</span>
              </button>
            </div>

            {isLoadingOllamaModels ? (
              <div className="flex items-center space-x-2 text-xs text-text-muted py-2 px-3 bg-surface/30 rounded-lg border border-border-subtle">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                <span>Verfügbare Modelle werden von Ollama abgerufen...</span>
              </div>
            ) : ollamaModels.length > 0 ? (
              <select
                value={settings.ollama.selectedModel}
                onChange={e => handleUpdate({ ollama: { ...settings.ollama, selectedModel: e.target.value } })}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {!settings.ollama.selectedModel && (
                  <option value="" disabled>-- Bitte Modell auswählen --</option>
                )}
                {ollamaModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.description ? `(${m.description})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-surface/30 border border-dashed border-border-subtle rounded-lg text-xs text-text-muted flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-text-dim" />
                  <span>Keine installierten Modelle gefunden. Stelle sicher, dass Ollama läuft.</span>
                </div>
                <button
                  type="button"
                  onClick={handleTestOllama}
                  className="text-xs text-accent hover:underline font-medium ml-2 flex-shrink-0"
                >
                  Jetzt abrufen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gemini Section */}
      <div className="mb-8 p-5 bg-surface/40 rounded-xl border border-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Cloud className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-text-primary">Google Gemini Configuration</h2>
          </div>
          {geminiStatus.checked && (
            <span className={`flex items-center space-x-1.5 text-xs ${geminiStatus.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {geminiStatus.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{geminiStatus.message}</span>
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Google AI API Key</label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={settings.gemini.apiKey}
                  onChange={e => handleGeminiKeyChange(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 pr-9 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={isTestingGemini || !settings.gemini.apiKey.trim()}
                className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isTestingGemini && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isTestingGemini ? 'Prüfe...' : 'Key prüfen & Modelle laden'}</span>
              </button>
            </div>
            <p className="text-[11px] text-text-dim mt-1.5">
              Wird sicher im lokalen App-Speicher abgelegt. Wird niemals in Notizen oder Git committet.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Verfügbares Gemini Modell</label>
            {!settings.gemini.apiKey.trim() ? (
              <div className="p-3 bg-surface/30 border border-dashed border-border-subtle rounded-lg text-xs text-text-dim flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 text-text-dim flex-shrink-0" />
                <span>Bitte zuerst den Google AI API-Key eingeben, um verfügbare Modelle abzurufen.</span>
              </div>
            ) : isLoadingGeminiModels ? (
              <div className="flex items-center space-x-2 text-xs text-text-muted py-2 px-3 bg-surface/30 rounded-lg border border-border-subtle">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                <span>Verfügbare Modelle werden von Google Gemini abgerufen...</span>
              </div>
            ) : geminiModels.length > 0 ? (
              <select
                value={settings.gemini.selectedModel}
                onChange={e => handleUpdate({ gemini: { ...settings.gemini, selectedModel: e.target.value } })}
                className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {!settings.gemini.selectedModel && (
                  <option value="" disabled>-- Bitte Modell auswählen --</option>
                )}
                {geminiModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-surface/30 border border-dashed border-border-subtle rounded-lg text-xs text-text-muted flex items-center justify-between">
                <span className="text-rose-400">Keine Modelle abgerufen (Key ungültig oder nicht verifiziert).</span>
                <button
                  type="button"
                  onClick={() => loadGeminiModels()}
                  className="text-xs text-accent hover:underline font-medium ml-2 flex-shrink-0"
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Prompt / Agent Personality */}
      <div className="p-5 bg-surface/40 rounded-xl border border-border-subtle">
        <div className="flex items-center space-x-2 mb-3">
          <Cpu className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold text-text-primary">Janus Agent System Prompt</h2>
        </div>
        <textarea
          rows={3}
          value={settings.systemPrompt || ''}
          onChange={e => handleUpdate({ systemPrompt: e.target.value })}
          placeholder="Du bist der Janus Assistent..."
          className="w-full bg-canvas border border-border-subtle rounded-lg p-3 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none leading-relaxed"
        />
        <p className="text-[11px] text-text-dim mt-1.5">
          Wird als globale Systemanweisung an das ausgewählte Modell gesendet.
        </p>
      </div>
    </div>
  );
};
