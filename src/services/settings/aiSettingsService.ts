export interface AiSettings {
  activeProviderId: string;
  ollama: {
    baseUrl: string;
    selectedModel: string;
  };
  gemini: {
    apiKey: string;
    selectedModel: string;
  };
  systemPrompt?: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  activeProviderId: 'ollama',
  ollama: {
    baseUrl: 'http://127.0.0.1:11434',
    selectedModel: '',
  },
  gemini: {
    apiKey: '',
    selectedModel: '',
  },
  systemPrompt:
    'You are Janus Assistant, an AI companion in Janus Note. You assist with writing, thinking, and managing structured companion files.',
};

const STORAGE_KEY = 'janus_ai_settings';

export class AiSettingsService {
  private currentSettings: AiSettings;
  private subscribers: Set<(settings: AiSettings) => void> = new Set();
  private storage: Storage | null;

  constructor(customStorage?: Storage) {
    this.storage = customStorage !== undefined ? customStorage : (typeof window !== 'undefined' ? window.localStorage : null);
    this.currentSettings = this.load();
  }

  public getSettings(): AiSettings {
    return {
      ...this.currentSettings,
      ollama: { ...this.currentSettings.ollama },
      gemini: { ...this.currentSettings.gemini },
    };
  }

  public updateSettings(patch: Partial<AiSettings> | ((prev: AiSettings) => AiSettings)): AiSettings {
    const updated = typeof patch === 'function' ? patch(this.getSettings()) : { ...this.currentSettings, ...patch };

    // Deep merge provider configs if provided
    if (typeof patch === 'object') {
      if (patch.ollama) {
        updated.ollama = { ...this.currentSettings.ollama, ...patch.ollama };
      }
      if (patch.gemini) {
        updated.gemini = { ...this.currentSettings.gemini, ...patch.gemini };
      }
    }

    this.currentSettings = updated;
    this.save(updated);
    this.notify();
    return this.getSettings();
  }

  public resetSettings(): AiSettings {
    this.currentSettings = { ...DEFAULT_AI_SETTINGS };
    this.save(this.currentSettings);
    this.notify();
    return this.getSettings();
  }

  public subscribe(fn: (settings: AiSettings) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private load(): AiSettings {
    if (!this.storage) return { ...DEFAULT_AI_SETTINGS };
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_AI_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_AI_SETTINGS,
        ...parsed,
        ollama: { ...DEFAULT_AI_SETTINGS.ollama, ...(parsed.ollama || {}) },
        gemini: { ...DEFAULT_AI_SETTINGS.gemini, ...(parsed.gemini || {}) },
      };
    } catch {
      return { ...DEFAULT_AI_SETTINGS };
    }
  }

  private save(settings: AiSettings) {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error('Failed to save AI settings to storage:', err);
    }
  }

  private notify() {
    const copy = this.getSettings();
    for (const fn of this.subscribers) {
      try {
        fn(copy);
      } catch (err) {
        console.error('Error in AI settings subscriber:', err);
      }
    }
  }
}

export const aiSettingsService = new AiSettingsService();
