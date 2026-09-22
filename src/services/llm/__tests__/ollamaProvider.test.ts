import { describe, it, expect, vi } from 'vitest';
import { OllamaProvider } from '../providers/OllamaProvider';

describe('OllamaProvider', () => {
  it('should list models from /api/tags', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'llama3.2:latest',
            model: 'llama3.2:latest',
            details: { parameter_size: '3B', family: 'llama' },
          },
          {
            name: 'mistral:latest',
            model: 'mistral:latest',
            details: { parameter_size: '7B', family: 'llama' },
          },
        ],
      }),
    });

    const provider = new OllamaProvider({ fetchFn: mockFetch as any });
    const models = await provider.listModels();

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', expect.any(Object));
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('llama3.2:latest');
    expect(models[0].provider).toBe('ollama');
    expect(models[0].description).toContain('3B');
  });

  it('should check connection reachability', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '0.3.12' }),
    });

    const provider = new OllamaProvider({ fetchFn: mockFetch as any });
    const status = await provider.checkConnection();

    expect(status.ok).toBe(true);
    expect(status.version).toBe('0.3.12');
  });

  it('should handle unreachable connection gracefully in checkConnection', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const provider = new OllamaProvider({ fetchFn: mockFetch as any });
    const status = await provider.checkConnection();

    expect(status.ok).toBe(false);
    expect(status.message).toContain('Failed to connect');
  });

  it('should execute non-streaming chat with message & tool calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          role: 'assistant',
          content: 'I will check your tasks.',
          tool_calls: [
            {
              function: {
                name: 'patch_task',
                arguments: JSON.stringify({ taskId: '123', done: true }),
              },
            },
          ],
        },
        done: true,
        prompt_eval_count: 15,
        eval_count: 30,
      }),
    });

    const provider = new OllamaProvider({ fetchFn: mockFetch as any });
    const response = await provider.chat({
      messages: [{ role: 'user', content: 'Mark task 123 as done' }],
      options: {
        model: 'llama3.2',
        tools: [
          {
            name: 'patch_task',
            description: 'Updates a task status',
            parameters: {
              type: 'object',
              properties: { taskId: { type: 'string' }, done: { type: 'boolean' } },
            },
          },
        ],
      },
    });

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toBe('I will check your tasks.');
    expect(response.finishReason).toBe('tool_calls');
    expect(response.message.toolCalls).toBeDefined();
    expect(response.message.toolCalls![0].name).toBe('patch_task');
    expect(response.message.toolCalls![0].args).toEqual({ taskId: '123', done: true });
    expect(response.usage?.totalTokens).toBe(45);
  });

  it('should stream chunks and parse NDJSON lines', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"role":"assistant","content":"Hello"},"done":false}\n'));
        controller.enqueue(encoder.encode('{"message":{"role":"assistant","content":" world!"},"done":true,"prompt_eval_count":5,"eval_count":10}\n'));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const provider = new OllamaProvider({ fetchFn: mockFetch as any });
    const chunks: any[] = [];

    for await (const chunk of provider.chatStream({
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].deltaText).toBe('Hello');
    expect(chunks[1].deltaText).toBe(' world!');
    expect(chunks[1].finishReason).toBe('stop');
    expect(chunks[1].usage?.totalTokens).toBe(15);
  });
});
