import { LlmToolDefinition } from '../../llm/types';

export interface AgentTool<T = any> {
  name: string;
  description: string;
  definition: LlmToolDefinition;
  execute: (args: T) => Promise<string>;
}
