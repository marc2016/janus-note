import { describe, it, expect } from 'vitest';
import { JanusChatModel } from './JanusChatModel';
import { HumanMessage, SystemMessage, ToolMessage, AIMessage } from '@langchain/core/messages';
import { LlmService } from '../llm/LlmService';
import { LlmChatRequest, LlmStreamChunk } from '../llm/types';

describe('JanusChatModel', () => {
  it('correctly maps LangChain messages to LlmMessages and accumulates response', async () => {
    let capturedMessages: any[] = [];
    let capturedOptions: any = null;

    const mockLlmService = {
      async *chatStream(req: LlmChatRequest) {
        capturedMessages = req.messages;
        capturedOptions = req.options;

        yield { deltaText: 'Hello ' } as LlmStreamChunk;
        yield { deltaText: 'there!' } as LlmStreamChunk;
      },
    } as unknown as LlmService;

    const model = new JanusChatModel({ llmService: mockLlmService });

    const messages = [
      new SystemMessage('You are Janus Note AI.'),
      new HumanMessage('Hello!'),
      new AIMessage({
        content: 'I will call a tool',
        tool_calls: [{ id: 'c1', name: 'search_vault', args: { query: 'todo' } }],
      }),
      new ToolMessage({
        content: 'Result: Found 3 notes',
        tool_call_id: 'c1',
        name: 'search_vault',
      }),
    ];

    const result = await model.invoke(messages);

    expect(capturedMessages).toHaveLength(4);
    expect(capturedMessages[0]).toEqual({ role: 'system', content: 'You are Janus Note AI.' });
    expect(capturedMessages[1]).toEqual({ role: 'user', content: 'Hello!' });
    expect(capturedMessages[2].role).toBe('assistant');
    expect(capturedMessages[2].toolCalls).toEqual([
      { id: 'c1', name: 'search_vault', args: { query: 'todo' } },
    ]);
    expect(capturedMessages[3]).toEqual({
      role: 'tool',
      content: 'Result: Found 3 notes',
      toolCallId: 'c1',
      name: 'search_vault',
    });

    expect(result.content).toBe('Hello there!');
    expect(capturedOptions).toBeDefined();
  });

  it('correctly parses streaming tool call chunks into AIMessage.tool_calls', async () => {
    const mockLlmService = {
      async *chatStream() {
        yield {
          deltaToolCalls: [
            { index: 0, id: 'call_123', name: 'create_note', deltaArgs: '{"path":"' },
          ],
        } as LlmStreamChunk;
        yield {
          deltaToolCalls: [
            { index: 0, deltaArgs: 'test.md","content":"Hi"}' },
          ],
        } as LlmStreamChunk;
      },
    } as unknown as LlmService;

    const model = new JanusChatModel({ llmService: mockLlmService });
    const result = await model.invoke([new HumanMessage('Create test.md')]);

    expect(result.tool_calls).toBeDefined();
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0]).toEqual({
      id: 'call_123',
      name: 'create_note',
      args: { path: 'test.md', content: 'Hi' },
    });
  });

  it('correctly maps bound tools to options when invoking', async () => {
    let capturedOptions: any = null;

    const mockLlmService = {
      async *chatStream(req: LlmChatRequest) {
        capturedOptions = req.options;
        yield { deltaText: 'OK' } as LlmStreamChunk;
      },
    } as unknown as LlmService;

    const model = new JanusChatModel({ llmService: mockLlmService });

    const tools = [
      {
        name: 'read_note',
        description: 'Reads note',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ];

    const boundModel = model.bindTools(tools);
    await boundModel.invoke([new HumanMessage('Read me')]);

    expect(capturedOptions?.tools).toBeDefined();
    expect(capturedOptions?.tools[0].name).toBe('read_note');
  });
});
