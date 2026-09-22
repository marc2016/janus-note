import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider } from '../providers/GeminiProvider';
import { LlmAuthError, LlmQuotaError } from '../errors';

describe('GeminiProvider', () => {
  it('should throw LlmAuthError if API key is missing when chatting', async () => {
    const provider = new GeminiProvider({ apiKey: '' });
    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'Hello' }] })
    ).rejects.toThrow(LlmAuthError);
  });

  it('should return empty model list when no API key is configured (no invented models)', async () => {
    const provider = new GeminiProvider({ apiKey: '' });
    const models = await provider.listModels();
    expect(models).toEqual([]);
  });

  it('should list models from Gemini API when key is configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding-004',
            displayName: 'Embedding',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      }),
    });

    const provider = new GeminiProvider({ apiKey: 'valid-key', fetchFn: mockFetch as any });
    const models = await provider.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('gemini-2.0-flash');
    expect(models[0].name).toBe('Gemini 2.0 Flash');
  });

  it('should check connection reachability and validate key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: 'models/gemini-2.0-flash' }] }),
    });

    const provider = new GeminiProvider({ apiKey: 'valid-test-key', fetchFn: mockFetch as any });
    const status = await provider.checkConnection();

    expect(status.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('key=valid-test-key'),
      expect.any(Object)
    );
  });

  it('should report invalid key in checkConnection', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'API key not valid' } }),
    });

    const provider = new GeminiProvider({ apiKey: 'invalid-key', fetchFn: mockFetch as any });
    const status = await provider.checkConnection();

    expect(status.ok).toBe(false);
    expect(status.message).toContain('API key not valid');
  });

  it('should execute chat and parse text and functionCall parts', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'I am creating the tasks.' },
                {
                  functionCall: {
                    name: 'patch_tasks_json',
                    args: { title: 'New companion task' },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 24,
          totalTokenCount: 36,
        },
      }),
    });

    const provider = new GeminiProvider({ apiKey: 'dummy-key', fetchFn: mockFetch as any });
    const response = await provider.chat({
      messages: [
        { role: 'system', content: 'You are Janus Assistant' },
        { role: 'user', content: 'Create task' },
      ],
      options: {
        tools: [
          {
            name: 'patch_tasks_json',
            description: 'Create a task',
            parameters: {
              type: 'object',
              properties: { title: { type: 'string' } },
            },
          },
        ],
      },
    });

    expect(response.message.content).toBe('I am creating the tasks.');
    expect(response.message.toolCalls).toHaveLength(1);
    expect(response.message.toolCalls![0].name).toBe('patch_tasks_json');
    expect(response.message.toolCalls![0].args).toEqual({ title: 'New companion task' });
    expect(response.finishReason).toBe('tool_calls');
    expect(response.usage?.totalTokens).toBe(36);
  });

  it('should stream SSE chunks from Gemini streamGenerateContent', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":" from Gemini!"}]},"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":20}}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    const provider = new GeminiProvider({ apiKey: 'dummy-key', fetchFn: mockFetch as any });
    const chunks: any[] = [];

    for await (const chunk of provider.chatStream({
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].deltaText).toBe('Hello');
    expect(chunks[1].deltaText).toBe(' from Gemini!');
    expect(chunks[1].finishReason).toBe('stop');
  });

  it('should throw LlmQuotaError on HTTP 429', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'Quota exceeded' } }),
    });

    const provider = new GeminiProvider({ apiKey: 'dummy-key', fetchFn: mockFetch as any });
    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow(LlmQuotaError);
  });
});
