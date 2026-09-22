import { AgentTool } from './types';
import { noteTools } from './noteTools';
import { taskTools } from './taskTools';
import { diagramTools } from './diagramTools';
import { researchTools } from './researchTools';
import { interactionTools } from './interactionTools';

export * from './types';
export * from './noteTools';
export * from './taskTools';
export * from './diagramTools';
export * from './researchTools';
export * from './interactionTools';

export const allAgentTools: AgentTool[] = [
  ...noteTools,
  ...taskTools,
  ...diagramTools,
  ...researchTools,
  ...interactionTools,
];

export const agentToolMap = new Map<string, AgentTool>(
  allAgentTools.map((t) => [t.name, t])
);
