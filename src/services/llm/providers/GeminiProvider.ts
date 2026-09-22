import {
  LlmProvider,
  LlmModel,
  LlmChatRequest,
  LlmChatResponse,
  LlmStreamChunk,
  LlmToolCall,
  LlmToolDefinition,
} from '../types';
import { LlmAuthError, LlmConnectionError, LlmError, LlmQuotaError } from '../errors';

export interface GeminiProviderOptions {
  apiKey?: string;
  defaultModel?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class GeminiProvider implements LlmProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini';

  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;
  private fetch: typeof fetch;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey || '';
    this.defaultModel = options.defaultModel || '';
    this.baseUrl = (options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.fetch = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public setDefaultModel(model: string) {
    this.defaultModel = model;
  }

  public async checkConnection(): Promise<{ ok: boolean; message?: string }> {
    if (!this.apiKey.trim()) {
      return { ok: false, message: 'Gemini API key is not configured' };
    }

    try {
      const url = `${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}&pageSize=1`;
      const res = await this.fetch(url, { method: 'GET' });

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        return {
          ok: false,
          message: errJson.error?.message || 'Invalid or unauthorized Gemini API key',
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          message: `Gemini API returned status ${res.status}: ${res.statusText}`,
        };
      }

      return { ok: true, message: 'Gemini API key is valid' };
    } catch (err: any) {
      return {
        ok: false,
        message: `Failed to connect to Google Gemini: ${err.message || 'Network error'}`,
      };
    }
  }

  public async listModels(): Promise<LlmModel[]> {
    if (!this.apiKey.trim()) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`;
      const res = await this.fetch(url, { method: 'GET' });

      if (!res.ok) {
        this.handleHttpError(res.status, await res.text().catch(() => ''));
      }

      const data = await res.json();
      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      return data.models
        .filter((m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          !m.name.includes('embedding')
        )
        .map((m: any) => {
          const modelId = m.name.replace(/^models\//, '');
          return {
            id: modelId,
            name: m.displayName || modelId,
            provider: this.id,
            contextLength: m.inputTokenLimit,
            description: m.description,
          };
        });
    } catch (err: any) {
      if (err instanceof LlmError) throw err;
      throw new LlmConnectionError(`Failed to fetch Gemini models: ${err.message}`, {
        provider: this.id,
        details: err,
      });
    }
  }

  public async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    this.ensureApiKey();
    const model = request.options?.model || this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const payload = this.buildGeminiPayload(request);

    let res: Response;
    try {
      res = await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: request.options?.signal,
      });

      if (res.status === 503) {
        await new Promise(r => setTimeout(r, 1200));
        res = await this.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: request.options?.signal,
        });
      }
    } catch (err: any) {
      throw new LlmConnectionError(`Gemini request failed: ${err.message}`, {
        provider: this.id,
        details: err,
      });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.handleHttpError(res.status, errorText);
    }

    const data = await res.json();
    return this.parseGeminiResponse(data);
  }

  public async *chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    this.ensureApiKey();
    const model = request.options?.model || this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const payload = this.buildGeminiPayload(request);

    let res: Response;
    try {
      res = await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: request.options?.signal,
      });

      if (res.status === 503) {
        await new Promise(r => setTimeout(r, 1200));
        res = await this.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: request.options?.signal,
        });
      }
    } catch (err: any) {
      throw new LlmConnectionError(`Gemini streaming request failed: ${err.message}`, {
        provider: this.id,
        details: err,
      });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.handleHttpError(res.status, errorText);
    }

    if (!res.body) {
      throw new LlmError('Gemini response body is null', { provider: this.id });
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
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataPayload = trimmed.replace(/^data:\s*/, '');
          if (dataPayload === '[DONE]') {
            yield { finishReason: 'stop' };
            continue;
          }

          try {
            const data = JSON.parse(dataPayload);
            const candidate = data.candidates?.[0];
            const chunk: LlmStreamChunk = {};

            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  chunk.deltaText = (chunk.deltaText || '') + part.text;
                }
                if (part.functionCall) {
                  chunk.deltaToolCalls = chunk.deltaToolCalls || [];
                  chunk.deltaToolCalls.push({
                    name: part.functionCall.name,
                    deltaArgs: typeof part.functionCall.args === 'string'
                      ? part.functionCall.args
                      : JSON.stringify(part.functionCall.args || {}),
                  });
                }
              }
            }

            if (candidate?.finishReason) {
              chunk.finishReason = candidate.finishReason === 'STOP'
                ? 'stop'
                : candidate.finishReason === 'MAX_TOKENS'
                ? 'length'
                : 'stop';
            }

            if (data.usageMetadata) {
              chunk.usage = {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
              };
            }

            yield chunk;
          } catch {
            // Ignore malformed individual SSE events
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private ensureApiKey() {
    if (!this.apiKey.trim()) {
      throw new LlmAuthError('Google Gemini API key is missing. Please configure it in AI Settings.', {
        provider: this.id,
      });
    }
  }

  private handleHttpError(status: number, text: string): never {
    let parsedMessage = text;
    try {
      const errObj = JSON.parse(text);
      if (errObj.error?.message) {
        parsedMessage = errObj.error.message;
      }
    } catch {
      // keep raw text
    }

    if (status === 400 || status === 401 || status === 403) {
      throw new LlmAuthError(`Gemini authentication error (HTTP ${status}): ${parsedMessage}`, {
        provider: this.id,
        statusCode: status,
      });
    }
    if (status === 429) {
      throw new LlmQuotaError(`Gemini rate limit exceeded (HTTP 429): ${parsedMessage}`, {
        provider: this.id,
        statusCode: status,
      });
    }
    if (status === 503) {
      throw new LlmConnectionError(
        `Gemini-Modell ist temporär überlastet (HTTP 503 - Service Unavailable). Bitte versuche es in wenigen Sekunden erneut oder wechsle in 'AI Config' auf ein anderes Modell (z.B. 'gemini-2.0-flash'). Details: ${parsedMessage}`,
        {
          provider: this.id,
          statusCode: 503,
        }
      );
    }

    throw new LlmError(`Gemini API error (HTTP ${status}): ${parsedMessage}`, {
      provider: this.id,
      statusCode: status,
    });
  }

  private buildGeminiPayload(request: LlmChatRequest): any {
    const contents: any[] = [];
    let systemInstruction: any = undefined;

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: msg.content }],
        };
        continue;
      }

      if (msg.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.name || 'tool',
                response: {
                  content: msg.content,
                },
              },
            },
          ],
        });
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: any[] = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.args,
            },
          });
        }
      }

      contents.push({ role, parts });
    }

    const payload: any = { contents };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    if (request.options?.temperature !== undefined || request.options?.maxTokens !== undefined) {
      payload.generationConfig = {};
      if (request.options.temperature !== undefined) {
        payload.generationConfig.temperature = request.options.temperature;
      }
      if (request.options.maxTokens !== undefined) {
        payload.generationConfig.maxOutputTokens = request.options.maxTokens;
      }
    }

    if (request.options?.tools && request.options.tools.length > 0) {
      payload.tools = [
        {
          functionDeclarations: request.options.tools.map(this.mapToolDefinition),
        },
      ];
    }

    return payload;
  }

  private mapToolDefinition(t: LlmToolDefinition): any {
    return {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    };
  }

  private parseGeminiResponse(data: any): LlmChatResponse {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let textContent = '';
    const toolCalls: LlmToolCall[] = [];

    for (const [idx, part] of parts.entries()) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `gemini_call_${Date.now()}_${idx}`,
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }

    let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';
    if (toolCalls.length > 0) {
      finishReason = 'tool_calls';
    } else if (candidate?.finishReason === 'MAX_TOKENS') {
      finishReason = 'length';
    }

    return {
      message: {
        role: 'assistant',
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finishReason,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }
}
