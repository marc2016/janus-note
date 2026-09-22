import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiSettingsService, DEFAULT_AI_SETTINGS } from '../aiSettingsService';

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return this.store[key] || null;
  }
  key(index: number) {
    return Object.keys(this.store)[index] || null;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
}

describe('AiSettingsService', () => {
  let mockStorage: MockStorage;
  let service: AiSettingsService;

  beforeEach(() => {
    mockStorage = new MockStorage();
    service = new AiSettingsService(mockStorage as any);
  });

  it('should initialize with default settings when storage is empty', () => {
    const settings = service.getSettings();
    expect(settings.activeProviderId).toBe(DEFAULT_AI_SETTINGS.activeProviderId);
    expect(settings.ollama.baseUrl).toBe(DEFAULT_AI_SETTINGS.ollama.baseUrl);
    expect(settings.gemini.apiKey).toBe('');
  });

  it('should update partial settings and persist to storage', () => {
    service.updateSettings({
      activeProviderId: 'gemini',
      gemini: { apiKey: 'my-secret-key', selectedModel: 'gemini-1.5-pro' },
    });

    const updated = service.getSettings();
    expect(updated.activeProviderId).toBe('gemini');
    expect(updated.gemini.apiKey).toBe('my-secret-key');
    expect(updated.gemini.selectedModel).toBe('gemini-1.5-pro');
    expect(updated.ollama.baseUrl).toBe(DEFAULT_AI_SETTINGS.ollama.baseUrl);

    // Verify storage serialization
    const storedRaw = mockStorage.getItem('janus_ai_settings');
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw!);
    expect(stored.gemini.apiKey).toBe('my-secret-key');
  });

  it('should notify subscribers on change', () => {
    const subscriber = vi.fn();
    const unsubscribe = service.subscribe(subscriber);

    service.updateSettings({
      ollama: { baseUrl: 'http://192.168.1.50:11434', selectedModel: 'mistral' },
    });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        ollama: expect.objectContaining({ baseUrl: 'http://192.168.1.50:11434' }),
      })
    );

    unsubscribe();
    service.updateSettings({ activeProviderId: 'gemini' });
    expect(subscriber).toHaveBeenCalledTimes(1); // not called again
  });
});
