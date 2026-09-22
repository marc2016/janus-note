import {
  LlmProvider,
  LlmModel,
  LlmChatRequest,
  LlmChatResponse,
  LlmStreamChunk,
  LlmMessage,
  LlmToolCall,
  LlmToolDefinition,
} from '../types';
import { LlmConnectionError, LlmError } from '../errors';

export interface OllamaProviderOptions {
  baseUrl?: string;
  defaultModel?: string;
  fetchFn?: typeof fetch;
}

export class OllamaProvider implements LlmProvider {
  public readonly id = 'ollama';
  public readonly name = 'Ollama (Local)';

  private baseUrl: string;
  private defaultModel: string;
  private fetch: typeof fetch;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = options.defaultModel || '';
    this.fetch = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public setDefaultModel(model: string) {
    this.defaultModel = model;
  }

  public async checkConnection(): Promise<{ ok: boolean; message?: string; version?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await this.fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          ok: false,
          message: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      return {
        ok: true,
        message: 'Ollama is reachable',
        version: data.version,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.name === 'AbortError'
          ? `Connection timed out to ${this.baseUrl}`
          : `Failed to connect to Ollama at ${this.baseUrl}: ${err.message || 'Server offline'}`,
      };
    }
  }

  public async listModels(): Promise<LlmModel[]> {
    try {
      const res = await this.fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!res.ok) {
        throw new LlmError(`Ollama listModels failed: HTTP ${res.status}`, {
          provider: this.id,
          statusCode: res.status,
        });
      }

      const data = await res.json();
      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      return data.models.map((m: any) => ({
        id: m.model || m.name,
        name: m.name || m.model,
        provider: this.id,
        description: m.details?.parameter_size ? `${m.details.parameter_size} - ${m.details.family || 'model'}` : undefined,
      }));
    } catch (err: any) {
      if (err instanceof LlmError) throw err;
      throw new LlmConnectionError(`Could not list Ollama models: ${err.message}`, {
        provider: this.id,
        details: err,
      });
    }
  }

  public async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const payload = this.buildChatPayload(request, false);
    let res: Response;

    try {
      res = await this.fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: request.options?.signal,
      });
    } catch (err: any) {
      throw new LlmConnectionError(`Ollama chat connection failed: ${err.message}`, {
        provider: this.id,
        details: err,
      });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new LlmError(`Ollama chat error HTTP ${res.status}: ${errorText}`, {
        provider: this.id,
        statusCode: res.status,
      });
    }

    const data = await res.json();
    const message = this.parseOllamaMessage(data.message);

    let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';
    if (message.toolCalls && message.toolCalls.length > 0) {
      finishReason = 'tool_calls';
    }

    return {
      message,
      finishReason,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  public async *chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const payload = this.buildChatPayload(request, true);
    let res: Response;

    try {
      res = await this.fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: request.options?.signal,
      });
    } catch (err: any) {
      throw new LlmConnectionError(`Ollama chatStream connection failed: ${err.message}`, {
        provider: this.id,
        details: err,
      });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new LlmError(`Ollama chatStream error HTTP ${res.status}: ${errorText}`, {
        provider: this.id,
        statusCode: res.status,
      });
    }

    if (!res.body) {
      throw new LlmError('Response body is null', { provider: this.id });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);
            const chunk: LlmStreamChunk = {};

            if (data.message?.content) {
              chunk.deltaText = data.message.content;
            }

            if (data.message?.tool_calls && Array.isArray(data.message.tool_calls)) {
              chunk.deltaToolCalls = data.message.tool_calls.map((tc: any, index: number) => ({
                index,
                id: tc.id || `call_${Date.now()}_${index}`,
                name: tc.function?.name,
                deltaArgs: typeof tc.function?.arguments === 'string'
                  ? tc.function.arguments
                  : JSON.stringify(tc.function?.arguments || {}),
              }));
            }

            if (data.done) {
              chunk.finishReason = chunk.deltaToolCalls?.length ? 'tool_calls' : 'stop';
              chunk.usage = {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
              };
            }

            yield chunk;
          } catch (jsonErr) {
            // Ignore corrupted individual lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          yield {
            deltaText: data.message?.content,
            finishReason: data.done ? 'stop' : undefined,
          };
        } catch {
          // Ignore trailing fragment
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildChatPayload(request: LlmChatRequest, stream: boolean): any {
    const model = request.options?.model || this.defaultModel;

    const messages = request.messages.map(m => {
      const ollamaMsg: any = {
        role: m.role,
        content: m.content || '',
      };

      if (m.toolCalls && m.toolCalls.length > 0) {
        ollamaMsg.tool_calls = m.toolCalls.map(tc => ({
          function: {
            name: tc.name,
            arguments: tc.args,
          },
        }));
      }

      return ollamaMsg;
    });

    const payload: any = {
      model,
      messages,
      stream,
    };

    if (request.options?.temperature !== undefined) {
      payload.options = payload.options || {};
      payload.options.temperature = request.options.temperature;
    }

    if (request.options?.maxTokens !== undefined) {
      payload.options = payload.options || {};
      payload.options.num_predict = request.options.maxTokens;
    }

    if (request.options?.tools && request.options.tools.length > 0) {
      payload.tools = request.options.tools.map(this.mapToolDefinition);
    }

    return payload;
  }

  private mapToolDefinition(t: LlmToolDefinition): any {
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    };
  }

  private parseOllamaMessage(msg: any): LlmMessage {
    const toolCalls: LlmToolCall[] = [];

    if (msg?.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const [idx, tc] of msg.tool_calls.entries()) {
        const fn = tc.function || {};
        let parsedArgs: Record<string, any> = {};
        if (typeof fn.arguments === 'string') {
          try {
            parsedArgs = JSON.parse(fn.arguments);
          } catch {
            parsedArgs = { raw: fn.arguments };
          }
        } else if (typeof fn.arguments === 'object' && fn.arguments !== null) {
          parsedArgs = fn.arguments;
        }

        toolCalls.push({
          id: tc.id || `call_${Date.now()}_${idx}`,
          name: fn.name || 'unknown_tool',
          args: parsedArgs,
        });
      }
    }

    return {
      role: msg?.role || 'assistant',
      content: msg?.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
