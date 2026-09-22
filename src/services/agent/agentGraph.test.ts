import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgentGraph } from './agentGraph';
import { JanusChatModel } from './JanusChatModel';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { vaultService } from '../vaultService';

describe('agentGraph', () => {
  beforeEach(async () => {
    await vaultService.writeFile('Notes.md', '# Initial Notes');
  });

  it('executes tools and completes successfully', async () => {
    let callCount = 0;
    const mockChatModel = {
      bindTools: vi.fn().mockReturnThis(),
      invoke: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new AIMessage({
            content: 'I will read the note.',
            tool_calls: [{ id: 'tc1', name: 'read_note', args: { path: 'Notes.md' } }],
          });
        }
        return new AIMessage({ content: 'Here is what was in Notes.md: # Initial Notes' });
      }),
    } as unknown as JanusChatModel;

    const graph = createAgentGraph(mockChatModel);
    const config = { configurable: { thread_id: 'test-thread-1' } };

    const result = await graph.invoke(
      { messages: [new HumanMessage('Read Notes.md for me')] },
      config
    );

    expect(callCount).toBe(2);
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.content).toContain('Here is what was in Notes.md');
  });

  it('triggers reflection loop when schema validation fails and retries', async () => {
    let callCount = 0;
    const mockChatModel = {
      bindTools: vi.fn().mockReturnThis(),
      invoke: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Invalid mermaid syntax (missing valid header)
          return new AIMessage({
            content: 'Generating diagram',
            tool_calls: [
              {
                id: 'tc_bad',
                name: 'insert_mermaid_diagram',
                args: { notePath: 'Notes.md', syntax: 'badHeader\n A --> B' },
              },
            ],
          });
        }
        if (callCount === 2) {
          // Self-corrected after receiving reflection message
          return new AIMessage({
            content: 'Corrected diagram',
            tool_calls: [
              {
                id: 'tc_good',
                name: 'insert_mermaid_diagram',
                args: { notePath: 'Notes.md', syntax: 'flowchart TD\n A --> B' },
              },
            ],
          });
        }
        return new AIMessage({ content: 'Diagram inserted successfully.' });
      }),
    } as unknown as JanusChatModel;

    const graph = createAgentGraph(mockChatModel);
    const config = { configurable: { thread_id: 'test-thread-reflect' } };

    const result = await graph.invoke(
      { messages: [new HumanMessage('Insert diagram')] },
      config
    );

    expect(result.messages.length).toBeGreaterThan(0);
    expect(callCount).toBe(3);
    const updatedNote = await vaultService.readFile('Notes.md');
    expect(updatedNote).toContain('flowchart TD\n A --> B');
  });

  it('interrupts for clarification and resumes with user answer', async () => {
    let callCount = 0;
    const mockChatModel = {
      bindTools: vi.fn().mockReturnThis(),
      invoke: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new AIMessage({
            content: 'Clarification needed',
            tool_calls: [
              {
                id: 'clarify_1',
                name: 'ask_clarification',
                args: {
                  question: 'Which view would you prefer?',
                  options: ['Kanban Board', 'List View'],
                },
              },
            ],
          });
        }
        return new AIMessage({ content: 'Understood, setting up Kanban Board!' });
      }),
    } as unknown as JanusChatModel;

    const graph = createAgentGraph(mockChatModel);
    const config = { configurable: { thread_id: 'test-thread-interrupt' } };

    // 1. Initial invoke -> pauses at interruptBefore
    const res1 = await graph.invoke(
      { messages: [new HumanMessage('Create a project task list')] },
      config
    );

    expect(callCount).toBe(1);
    expect(res1.clarification).toBeDefined();
    expect(res1.clarification?.question).toBe('Which view would you prefer?');

    // 2. Resume with user choice
    await graph.updateState(config, {
      messages: [new HumanMessage('Kanban Board')],
    });
    const res2 = await graph.invoke(null, config);

    expect(callCount).toBe(2);
    const lastMsg = res2.messages[res2.messages.length - 1];
    expect(lastMsg.content).toContain('setting up Kanban Board!');
  });

  it('interrupts for destructive file approval and writes only upon approval', async () => {
    let callCount = 0;
    await vaultService.writeFile('Protected.md', 'Important critical data.');

    const mockChatModel = {
      bindTools: vi.fn().mockReturnThis(),
      invoke: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Attempting to overwrite existing file via create_note
          return new AIMessage({
            content: 'Overwriting file',
            tool_calls: [
              {
                id: 'ov_1',
                name: 'create_note',
                args: { path: 'Protected.md', content: 'Replaced completely.' },
              },
            ],
          });
        }
        return new AIMessage({ content: 'Finished.' });
      }),
    } as unknown as JanusChatModel;

    const graph = createAgentGraph(mockChatModel);
    const config = { configurable: { thread_id: 'test-thread-approval' } };

    // Initial call -> pauses at interruptBefore
    const res1 = await graph.invoke(
      { messages: [new HumanMessage('Rewrite Protected.md')] },
      config
    );

    expect(res1.pendingApproval).toBeDefined();
    expect(res1.pendingApproval?.path).toBe('Protected.md');
    // Content should NOT be modified yet
    expect(await vaultService.readFile('Protected.md')).toBe('Important critical data.');

    // User approves
    await graph.updateState(config, { approvalDecision: 'approved' });
    await graph.invoke(null, config);

    // Now file is overwritten
    expect(await vaultService.readFile('Protected.md')).toBe('Replaced completely.');
  });
});
