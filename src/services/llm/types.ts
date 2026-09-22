export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface LlmToolCallChunk {
  index?: number;
  id?: string;
  name?: string;
  deltaArgs?: string;
}

export interface LlmMessage {
  role: LlmRole;
  content: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface LlmModel {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  description?: string;
}

export interface LlmChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LlmToolDefinition[];
  signal?: AbortSignal;
}

export interface LlmChatRequest {
  messages: LlmMessage[];
  options?: LlmChatOptions;
}

export interface LlmStreamChunk {
  deltaText?: string;
  deltaToolCalls?: LlmToolCallChunk[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens?: number;
  };
}

export interface LlmChatResponse {
  message: LlmMessage;
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens?: number;
  };
}

export interface LlmProvider {
  readonly id: string;
  readonly name: string;
  listModels(): Promise<LlmModel[]>;
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
  chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk>;
  checkConnection?(): Promise<{ ok: boolean; message?: string }>;
}
