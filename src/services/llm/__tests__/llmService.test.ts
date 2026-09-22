import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmService } from '../LlmService';
import { AiSettingsService } from '../../settings/aiSettingsService';
import { LlmProvider } from '../types';

class MockStorage implements Storage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] || null; }
  key(index: number) { return Object.keys(this.store)[index] || null; }
  removeItem(key: string) { delete this.store[key]; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
}

describe('LlmService', () => {
  let settingsService: AiSettingsService;
  let llmService: LlmService;

  beforeEach(() => {
    const storage = new MockStorage();
    settingsService = new AiSettingsService(storage as any);
    llmService = new LlmService(settingsService);
  });

  it('should list registered default providers', () => {
    const providers = llmService.listProviders();
    expect(providers.map(p => p.id)).toEqual(['ollama', 'gemini']);
  });

  it('should return the active provider based on settings', () => {
    expect(llmService.getActiveProvider().id).toBe('ollama');

    settingsService.updateSettings({ activeProviderId: 'gemini' });
    expect(llmService.getActiveProvider().id).toBe('gemini');
  });

  it('should throw error when accessing unregistered provider', () => {
    expect(() => llmService.getProvider('nonexistent')).toThrow();
  });

  it('should register and route chat to a custom provider', async () => {
    const customProvider: LlmProvider = {
      id: 'custom-ai',
      name: 'Custom AI',
      listModels: vi.fn().mockResolvedValue([{ id: 'custom-v1', name: 'Custom V1', provider: 'custom-ai' }]),
      chat: vi.fn().mockResolvedValue({
        message: { role: 'assistant', content: 'Custom response' },
        finishReason: 'stop',
      }),
      chatStream: vi.fn(),
    };

    llmService.registerProvider(customProvider);
    expect(llmService.listProviders().some(p => p.id === 'custom-ai')).toBe(true);

    const res = await llmService.chat(
      { messages: [{ role: 'user', content: 'Ping' }] },
      'custom-ai'
    );

    expect(res.message.content).toBe('Custom response');
    expect(customProvider.chat).toHaveBeenCalled();
  });

  it('should auto-populate default model if not provided in chat request', async () => {
    settingsService.updateSettings({
      activeProviderId: 'ollama',
      ollama: { baseUrl: 'http://localhost:11434', selectedModel: 'qwen2.5:7b' },
    });

    const mockOllama = llmService.getProvider('ollama');
    const chatSpy = vi.spyOn(mockOllama, 'chat').mockResolvedValue({
      message: { role: 'assistant', content: 'Hi' },
      finishReason: 'stop',
    });

    await llmService.chat({ messages: [{ role: 'user', content: 'Hello' }] });

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ model: 'qwen2.5:7b' }),
      })
    );
  });
});
