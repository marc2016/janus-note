import {
  Annotation,
  StateGraph,
  START,
  END,
  MemorySaver,
  CompiledStateGraph,
} from '@langchain/langgraph';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { JanusChatModel } from './JanusChatModel';
import { allAgentTools, agentToolMap } from './tools';
import { validateTasksFileData } from './tools/taskTools';
import { validateMermaidSyntax, validateChartFileData } from './tools/diagramTools';
import { vaultService } from '../vaultService';

export interface PendingApprovalData {
  toolCallId: string;
  path: string;
  action: 'overwrite' | 'delete' | 'create';
  diff?: string;
  proposedContent?: string;
}

export interface ClarificationData {
  toolCallId: string;
  question: string;
  options?: string[];
  context?: string;
}

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  currentGoal: Annotation<string | undefined>({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => undefined,
  }),
  pendingApproval: Annotation<PendingApprovalData | null>({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  clarification: Annotation<ClarificationData | null>({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  approvalDecision: Annotation<'approved' | 'rejected' | null>({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  validationErrors: Annotation<string[]>({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => [],
  }),
  retryCount: Annotation<number>({
    reducer: (curr, update) => (update === 0 ? 0 : curr + update),
    default: () => 0,
  }),
  activeStep: Annotation<string | undefined>({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => undefined,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

const SYSTEM_INSTRUCTION = `You are Janus AI, an autonomous knowledge, note-taking, and project management agent for Janus Note.
Janus Note pairs Markdown prose notes with structured companion data files:
- Markdown files (.md): general documentation, concepts, and reading prose.
- Tasks companion files (*.tasks.json): task boards embedded via \`\`\`tasks block.
- Chart companion files (*.chart.json): architecture maps embedded via \`\`\`chart block.
- Mermaid diagrams: inline \`\`\`mermaid code blocks inside markdown notes.

CRITICAL OPERATIONAL RULES:
1. ALWAYS EXECUTE TOOLS: When the user asks you to edit, append, write, update, summarize, or create a note, task list, or diagram, DO NOT simply output the modified markdown in the chat window. You MUST call the corresponding tool to apply the change directly to the vault!
   - To edit/append to an existing note: use "edit_note" (with mode "append", "patch", or "replace").
   - To create a new note: use "create_note".
   - To create a companion task list: use "create_task_list".
   - To add tasks to an existing list: use "add_tasks".
   - To update task status/details: use "update_task".
   - To insert a Mermaid diagram into a note: use "insert_mermaid_diagram".
   - To create a structured chart companion: use "create_chart_companion".
   - To research across the vault: use "search_vault", "read_note", or "find_related_notes".
2. TARGET PATHS: When modifying the active note currently open in the editor, use the file path specified in the user's active note context (e.g. "Inbox.md" or "welcome.md").
3. AMBIGUITY: If requirements are ambiguous or critical decisions are needed, call "ask_clarification".
4. SAFETY: If overwriting or deleting an existing file with different content, call "request_file_approval".
5. Keep your final conversational response concise, summarizing the actions you performed.`;

export function createAgentGraph(chatModel?: JanusChatModel): CompiledStateGraph<any, any, any, any, any, any> {
  const model = chatModel || new JanusChatModel();
  const toolDefinitions = allAgentTools.map((t) => t.definition);
  const boundModel = model.bindTools(toolDefinitions);

  const plannerNode = async (state: AgentState) => {
    let msgs = state.messages;
    if (msgs.length === 0 || msgs[0].getType() !== 'system') {
      msgs = [new SystemMessage(SYSTEM_INSTRUCTION), ...msgs];
    }

    const response = await boundModel.invoke(msgs);
    return {
      messages: [response],
      activeStep: 'Planning next steps',
    };
  };

  const toolExecutorNode = async (state: AgentState) => {
    const lastMsg = state.messages[state.messages.length - 1];
    if (!lastMsg || lastMsg.getType() !== 'ai') {
      return { activeStep: undefined };
    }

    const aiMsg = lastMsg as AIMessage;
    const toolCalls = aiMsg.tool_calls || [];

    if (toolCalls.length === 0) {
      return { activeStep: undefined };
    }

    const newMessages: BaseMessage[] = [];
    const validationErrors: string[] = [];
    let pendingApproval: PendingApprovalData | null = null;
    let clarification: ClarificationData | null = null;

    for (const tc of toolCalls) {
      // 1. Check for clarification tool
      if (tc.name === 'ask_clarification') {
        clarification = {
          toolCallId: tc.id || 'clarify',
          question: tc.args.question,
          options: tc.args.options,
          context: tc.args.context,
        };
        newMessages.push(
          new ToolMessage({
            tool_call_id: tc.id || 'clarify',
            name: tc.name,
            content: `Clarification requested: "${tc.args.question}"`,
          })
        );
        continue;
      }

      // 2. Check for destructive approval tool
      if (tc.name === 'request_file_approval') {
        pendingApproval = {
          toolCallId: tc.id || 'approval',
          path: tc.args.path,
          action: tc.args.action || 'overwrite',
          diff: tc.args.diff,
          proposedContent: tc.args.proposedContent,
        };
        newMessages.push(
          new ToolMessage({
            tool_call_id: tc.id || 'approval',
            name: tc.name,
            content: `Approval requested for ${tc.args.action} on "${tc.args.path}".`,
          })
        );
        continue;
      }

      // 3. Destructive safety check: if tool is create_note or write_file and file already exists, require approval
      if (tc.name === 'create_note' && tc.args.path) {
        try {
          const existing = await vaultService.readFile(tc.args.path);
          if (existing && existing.trim().length > 0) {
            pendingApproval = {
              toolCallId: tc.id || 'approval',
              path: tc.args.path,
              action: 'overwrite',
              diff: `Replacing existing file (${existing.length} chars) with new content (${tc.args.content?.length || 0} chars)`,
              proposedContent: tc.args.content,
            };
            newMessages.push(
              new ToolMessage({
                tool_call_id: tc.id || 'approval',
                name: tc.name,
                content: `File "${tc.args.path}" already exists. Requesting user confirmation before overwrite.`,
              })
            );
            continue;
          }
        } catch {
          // File does not exist yet, safe to proceed
        }
      }

      // 4. Schema reflection checks
      if (tc.name === 'create_task_list' || tc.name === 'add_tasks') {
        const dummyTasks = { title: tc.args.title || 'Tasks', tasks: tc.args.tasks || [] };
        const val = validateTasksFileData(dummyTasks);
        if (!val.valid) {
          validationErrors.push(...(val.errors || []));
          continue;
        }
      } else if (tc.name === 'insert_mermaid_diagram') {
        const val = validateMermaidSyntax(tc.args.syntax || '');
        if (!val.valid) {
          validationErrors.push(...(val.errors || []));
          continue;
        }
      } else if (tc.name === 'create_chart_companion') {
        const dummyChart = { title: tc.args.title, nodes: tc.args.nodes, edges: tc.args.edges };
        const val = validateChartFileData(dummyChart);
        if (!val.valid) {
          validationErrors.push(...(val.errors || []));
          continue;
        }
      }

      // 5. Execute normal tool
      const tool = agentToolMap.get(tc.name);
      if (!tool) {
        newMessages.push(
          new ToolMessage({
            tool_call_id: tc.id || 'unknown',
            name: tc.name,
            content: `Error: Unknown tool "${tc.name}".`,
          })
        );
        continue;
      }

      try {
        const result = await tool.execute(tc.args);
        newMessages.push(
          new ToolMessage({
            tool_call_id: tc.id || tool.name,
            name: tc.name,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          })
        );
      } catch (err: any) {
        newMessages.push(
          new ToolMessage({
            tool_call_id: tc.id || tool.name,
            name: tc.name,
            content: `Tool execution failed: ${err.message || String(err)}`,
          })
        );
      }
    }

    return {
      messages: newMessages,
      validationErrors,
      pendingApproval,
      clarification,
      activeStep: 'Executed tools',
    };
  };

  const reflectionNode = async (state: AgentState) => {
    const errors = state.validationErrors;
    const feedback = `The previous tool call output produced schema or syntax validation errors:\n- ${errors.join('\n- ')}\nPlease correct the syntax or parameters and re-invoke the tool.`;

    return {
      messages: [new HumanMessage(feedback)],
      validationErrors: [],
      retryCount: 1,
      activeStep: 'Correcting syntax via reflection',
    };
  };

  const humanInterruptNode = async (state: AgentState) => {
    const resumeMessages: BaseMessage[] = [];
    const lastMsg = state.messages[state.messages.length - 1];

    if (state.pendingApproval) {
      const isApproved =
        state.approvalDecision === 'approved' ||
        (state.approvalDecision !== 'rejected' &&
          typeof lastMsg?.content === 'string' &&
          /ja|yes|genehmig|ok|mach das/i.test(lastMsg.content));

      if (isApproved) {
        // User approved destructive action: apply the write
        if (state.pendingApproval.path && state.pendingApproval.proposedContent) {
          await vaultService.writeFile(
            state.pendingApproval.path,
            state.pendingApproval.proposedContent
          );
        }
        resumeMessages.push(
          new HumanMessage(
            `User approved the action for "${state.pendingApproval.path}". Successfully applied.`
          )
        );
      } else {
        resumeMessages.push(
          new HumanMessage(
            `User rejected the action for "${state.pendingApproval.path}". Do not modify the file.`
          )
        );
      }
    }

    return {
      messages: resumeMessages,
      pendingApproval: null,
      clarification: null,
      approvalDecision: null,
      activeStep: 'Resumed with user response',
    };
  };

  const routeAfterTools = (state: AgentState) => {
    if (state.validationErrors.length > 0 && (state.retryCount || 0) < 2) {
      return 'reflection';
    }
    if (state.clarification || state.pendingApproval) {
      return 'human_interrupt';
    }
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.getType() === 'tool') {
      return 'planner';
    }
    return END;
  };

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('planner', plannerNode)
    .addNode('tools', toolExecutorNode)
    .addNode('reflection', reflectionNode)
    .addNode('human_interrupt', humanInterruptNode)
    .addEdge(START, 'planner')
    .addConditionalEdges('planner', (state: AgentState) => {
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && (lastMsg as AIMessage).tool_calls && (lastMsg as AIMessage).tool_calls!.length > 0) {
        return 'tools';
      }
      return END;
    })
    .addConditionalEdges('tools', routeAfterTools)
    .addEdge('reflection', 'planner')
    .addEdge('human_interrupt', 'planner');

  return graph.compile({
    checkpointer: new MemorySaver(),
    interruptBefore: ['human_interrupt'],
  });
}

export const agentGraph = createAgentGraph();
