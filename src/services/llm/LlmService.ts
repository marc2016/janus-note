import {
  LlmProvider,
  LlmModel,
  LlmChatRequest,
  LlmChatResponse,
  LlmStreamChunk,
} from './types';
import { LlmError } from './errors';
import { OllamaProvider } from './providers/OllamaProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { AiSettingsService, aiSettingsService } from '../settings/aiSettingsService';

export class LlmService {
  private providers: Map<string, LlmProvider> = new Map();
  private settingsService: AiSettingsService;
  private unsubscribeSettings: () => void;

  constructor(settingsService: AiSettingsService = aiSettingsService) {
    this.settingsService = settingsService;

    // Register default providers
    const initialSettings = this.settingsService.getSettings();
    const ollama = new OllamaProvider({
      baseUrl: initialSettings.ollama.baseUrl,
      defaultModel: initialSettings.ollama.selectedModel,
    });
    const gemini = new GeminiProvider({
      apiKey: initialSettings.gemini.apiKey,
      defaultModel: initialSettings.gemini.selectedModel,
    });

    this.registerProvider(ollama);
    this.registerProvider(gemini);

    // Sync settings updates with registered providers
    this.unsubscribeSettings = this.settingsService.subscribe(settings => {
      if (this.providers.has('ollama')) {
        const p = this.providers.get('ollama') as OllamaProvider;
        p.setBaseUrl(settings.ollama.baseUrl);
        p.setDefaultModel(settings.ollama.selectedModel);
      }
      if (this.providers.has('gemini')) {
        const p = this.providers.get('gemini') as GeminiProvider;
        p.setApiKey(settings.gemini.apiKey);
        p.setDefaultModel(settings.gemini.selectedModel);
      }
    });
  }

  public destroy() {
    this.unsubscribeSettings();
  }

  public registerProvider(provider: LlmProvider): void {
    this.providers.set(provider.id, provider);
  }

  public unregisterProvider(id: string): void {
    this.providers.delete(id);
  }

  public getProvider(id?: string): LlmProvider {
    const providerId = id || this.settingsService.getSettings().activeProviderId;
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new LlmError(`LLM provider '${providerId}' is not registered`, {
        provider: providerId,
      });
    }

    return provider;
  }

  public listProviders(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
    }));
  }

  public getActiveProvider(): LlmProvider {
    return this.getProvider();
  }

  public getActiveModel(providerId?: string): string {
    const settings = this.settingsService.getSettings();
    const pId = providerId || settings.activeProviderId;
    if (pId === 'gemini') {
      return settings.gemini.selectedModel;
    }
    return settings.ollama.selectedModel;
  }

  public async listModels(providerId?: string): Promise<LlmModel[]> {
    const provider = this.getProvider(providerId);
    return provider.listModels();
  }

  public async checkConnection(providerId?: string): Promise<{ ok: boolean; message?: string }> {
    const provider = this.getProvider(providerId);
    if (typeof provider.checkConnection === 'function') {
      return provider.checkConnection();
    }
    return { ok: true, message: 'Provider does not require connection verification' };
  }

  public async chat(request: LlmChatRequest, providerId?: string): Promise<LlmChatResponse> {
    const provider = this.getProvider(providerId);
    const resolvedRequest = this.ensureDefaultModel(request, provider.id);
    return provider.chat(resolvedRequest);
  }

  public async *chatStream(request: LlmChatRequest, providerId?: string): AsyncIterable<LlmStreamChunk> {
    const provider = this.getProvider(providerId);
    const resolvedRequest = this.ensureDefaultModel(request, provider.id);
    yield* provider.chatStream(resolvedRequest);
  }

  private ensureDefaultModel(request: LlmChatRequest, providerId: string): LlmChatRequest {
    if (request.options?.model) {
      return request;
    }

    return {
      ...request,
      options: {
        ...request.options,
        model: this.getActiveModel(providerId),
      },
    };
  }
}

export const llmService = new LlmService();
