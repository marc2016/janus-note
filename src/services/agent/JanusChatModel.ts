import { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
  isAIMessage,
  isHumanMessage,
  isSystemMessage,
  isToolMessage,
} from '@langchain/core/messages';
import { ChatGenerationChunk, ChatResult } from '@langchain/core/outputs';
import { RunnableBinding, Runnable } from '@langchain/core/runnables';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { llmService as defaultLlmService, LlmService } from '../llm/LlmService';
import { LlmChatOptions, LlmMessage, LlmToolCall, LlmToolDefinition } from '../llm/types';

export interface JanusChatModelParams {
  llmService?: LlmService;
  defaultOptions?: LlmChatOptions;
}

export interface JanusCallOptions extends BaseChatModelCallOptions {
  tools?: LlmToolDefinition[];
}

export class JanusChatModel extends BaseChatModel<JanusCallOptions> {
  private service: LlmService;
  private defaultOptions?: LlmChatOptions;

  constructor(fields?: JanusChatModelParams) {
    super({});
    this.service = fields?.llmService ?? defaultLlmService;
    this.defaultOptions = fields?.defaultOptions;
  }

  _llmType(): string {
    return 'janus-chat-model';
  }

  override bindTools(
    tools: (LlmToolDefinition | any)[],
    kwargs?: Partial<JanusCallOptions>
  ): Runnable<any, any, JanusCallOptions> {
    const normalizedTools: LlmToolDefinition[] = tools.map((t) => {
      if (t && typeof t === 'object' && 'name' in t && 'parameters' in t) {
        return t as LlmToolDefinition;
      }
      // LangChain StructuredTool / Function tool mapping
      return {
        name: t.name,
        description: t.description || '',
        parameters: t.schema?.jsonSchema || t.schema || { type: 'object', properties: {} },
      };
    });

    return new RunnableBinding({
      bound: this,
      config: {},
      kwargs: {
        tools: normalizedTools,
        ...kwargs,
      },
    });
  }

  private convertMessages(messages: BaseMessage[]): LlmMessage[] {
    return messages.map((m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);

      if (isSystemMessage(m) || m.getType() === 'system') {
        return { role: 'system', content };
      }

      if (isHumanMessage(m) || m.getType() === 'human') {
        return { role: 'user', content };
      }

      if (isToolMessage(m) || m.getType() === 'tool') {
        const toolMsg = m as any;
        return {
          role: 'tool',
          content,
          toolCallId: toolMsg.tool_call_id,
          name: toolMsg.name,
        };
      }

      if (isAIMessage(m) || m.getType() === 'ai') {
        const aiMsg = m as any;
        const toolCalls: LlmToolCall[] | undefined = aiMsg.tool_calls?.map((tc: any) => ({
          id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
          name: tc.name,
          args: typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args || {},
        }));

        return {
          role: 'assistant',
          content,
          toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        };
      }

      return { role: 'user', content };
    });
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const llmMessages = this.convertMessages(messages);
    const tools = (options as any)?.tools || this.defaultOptions?.tools;

    const chatOptions: LlmChatOptions = {
      ...this.defaultOptions,
      tools,
      signal: options?.signal,
    };

    let textAccumulator = '';
    const toolCallsMap = new Map<number, { id: string; name: string; deltaArgs: string }>();

    for await (const chunk of this.service.chatStream({ messages: llmMessages, options: chatOptions })) {
      if (chunk.deltaText) {
        textAccumulator += chunk.deltaText;
      }

      if (chunk.deltaToolCalls) {
        for (const tc of chunk.deltaToolCalls) {
          const index = tc.index ?? 0;
          const existing = toolCallsMap.get(index) || {
            id: tc.id || `call_${index}`,
            name: tc.name || '',
            deltaArgs: '',
          };

          if (tc.name) existing.name = tc.name;
          if (tc.id) existing.id = tc.id;
          if (tc.deltaArgs) existing.deltaArgs += tc.deltaArgs;

          toolCallsMap.set(index, existing);
        }
      }
    }

    const tool_calls = Array.from(toolCallsMap.values()).map((tc) => {
      let args = {};
      try {
        args = tc.deltaArgs ? JSON.parse(tc.deltaArgs) : {};
      } catch (err) {
        console.warn('Failed parsing tool call args JSON:', tc.deltaArgs, err);
      }
      return {
        id: tc.id,
        name: tc.name,
        args,
      };
    });

    const aiMessage = new AIMessage({
      content: textAccumulator,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
    });

    return {
      generations: [
        {
          text: textAccumulator,
          message: aiMessage,
        },
      ],
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const llmMessages = this.convertMessages(messages);
    const tools = (options as any)?.tools || this.defaultOptions?.tools;

    const chatOptions: LlmChatOptions = {
      ...this.defaultOptions,
      tools,
      signal: options?.signal,
    };

    for await (const chunk of this.service.chatStream({ messages: llmMessages, options: chatOptions })) {
      const toolCallChunks = chunk.deltaToolCalls?.map((tc) => ({
        index: tc.index,
        id: tc.id,
        name: tc.name,
        args: tc.deltaArgs,
      }));

      const messageChunk = new AIMessageChunk({
        content: chunk.deltaText || '',
        tool_call_chunks: toolCallChunks,
      });

      yield new ChatGenerationChunk({
        message: messageChunk,
        text: chunk.deltaText || '',
      });
    }
  }
}
