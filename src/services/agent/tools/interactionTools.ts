import { AgentTool } from './types';

export const askClarificationTool: AgentTool<{
  question: string;
  options?: string[];
  context?: string;
}> = {
  name: 'ask_clarification',
  description: 'Asks the user a clarifying question with optional multiple-choice options when requirements or intent are ambiguous.',
  definition: {
    name: 'ask_clarification',
    description: 'Asks the user a clarifying question with optional multiple-choice options when requirements or intent are ambiguous.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The clarifying question to present to the user.',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of recommended choices / quick replies for the user.',
        },
        context: {
          type: 'string',
          description: 'Optional brief explanation of why clarification is needed.',
        },
      },
      required: ['question'],
    },
  },
  async execute({ question, options }) {
    // When invoked in the graph, this triggers an interrupt
    return JSON.stringify({ question, options, status: 'awaiting_user_input' });
  },
};

export const requestFileApprovalTool: AgentTool<{
  path: string;
  action: 'overwrite' | 'delete';
  diff?: string;
  proposedContent?: string;
}> = {
  name: 'request_file_approval',
  description: 'Requests explicit user approval before performing a destructive file action (e.g. overwriting an existing file).',
  definition: {
    name: 'request_file_approval',
    description: 'Requests explicit user approval before performing a destructive file action (e.g. overwriting an existing file).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file path.',
        },
        action: {
          type: 'string',
          enum: ['overwrite', 'delete'],
          description: 'Action requiring confirmation.',
        },
        diff: {
          type: 'string',
          description: 'Diff preview of what will change.',
        },
        proposedContent: {
          type: 'string',
          description: 'The full proposed replacement content.',
        },
      },
      required: ['path', 'action'],
    },
  },
  async execute({ path, action, diff }) {
    return JSON.stringify({ path, action, diff, status: 'awaiting_approval' });
  },
};

export const interactionTools = [
  askClarificationTool,
  requestFileApprovalTool,
];
