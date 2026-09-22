import { vaultService } from '../../vaultService';
import { AgentTool } from './types';

export interface ChartNode {
  id: string;
  label: string;
}

export interface ChartEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ChartFileData {
  title: string;
  nodes: ChartNode[];
  edges?: ChartEdge[];
}

export function validateMermaidSyntax(code: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, errors: ['Mermaid code cannot be empty.'] };
  }

  const validHeaders = [
    'graph',
    'flowchart',
    'sequencediagram',
    'classdiagram',
    'statediagram',
    'statediagram-v2',
    'erdiagram',
    'gantt',
    'pie',
    'gitgraph',
    'mindmap',
    'timeline',
    'quadrantchart',
    'c4context',
  ];

  const firstLine = trimmed.split('\n')[0].trim().toLowerCase();
  const startsWithHeader = validHeaders.some((header) => firstLine.startsWith(header));

  if (!startsWithHeader) {
    errors.push(
      `Mermaid code must start with a valid diagram type header (e.g. "flowchart TD", "sequenceDiagram", "mindmap"). Found: "${firstLine}".`
    );
  }

  // Bracket balance check
  const pairs: Record<string, string> = { '[': ']', '(': ')', '{': '}' };
  const stack: string[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (['[', '(', '{'].includes(char)) {
      stack.push(char);
    } else if ([']', ')', '}'].includes(char)) {
      const last = stack.pop();
      if (!last || pairs[last] !== char) {
        errors.push(`Unmatched or unbalanced bracket "${char}" in Mermaid syntax.`);
        break;
      }
    }
  }
  if (stack.length > 0) {
    errors.push(`Unclosed bracket "${stack[stack.length - 1]}" in Mermaid syntax.`);
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

export function validateChartFileData(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Chart data must be a valid JSON object.'] };
  }
  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('Chart data must include a non-empty "title" string.');
  }
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    errors.push('Chart data must include a non-empty "nodes" array.');
  } else {
    data.nodes.forEach((node: any, idx: number) => {
      if (!node || typeof node !== 'object') {
        errors.push(`Node at index ${idx} must be an object.`);
        return;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        errors.push(`Node at index ${idx} must have an "id".`);
      }
      if (typeof node.label !== 'string' || !node.label.trim()) {
        errors.push(`Node at index ${idx} must have a "label".`);
      }
    });
  }

  if (data.edges && Array.isArray(data.edges)) {
    data.edges.forEach((edge: any, idx: number) => {
      if (!edge || typeof edge !== 'object') {
        errors.push(`Edge at index ${idx} must be an object.`);
        return;
      }
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
        errors.push(`Edge at index ${idx} must have "source" and "target" strings.`);
      }
    });
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

export const validateDiagramSyntaxTool: AgentTool<{
  type: 'mermaid' | 'chart_json';
  content: string;
}> = {
  name: 'validate_diagram_syntax',
  description: 'Validates the syntax and structure of Mermaid code or Chart companion JSON.',
  definition: {
    name: 'validate_diagram_syntax',
    description: 'Validates the syntax and structure of Mermaid code or Chart companion JSON.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['mermaid', 'chart_json'],
          description: 'Type of diagram content to validate.',
        },
        content: {
          type: 'string',
          description: 'The raw Mermaid code string or JSON string to validate.',
        },
      },
      required: ['type', 'content'],
    },
  },
  async execute({ type, content }) {
    if (type === 'mermaid') {
      const res = validateMermaidSyntax(content);
      return res.valid
        ? 'Mermaid syntax is valid.'
        : `Mermaid validation errors: ${res.errors?.join('; ')}`;
    } else {
      try {
        const parsed = JSON.parse(content);
        const res = validateChartFileData(parsed);
        return res.valid
          ? 'Chart JSON schema is valid.'
          : `Chart JSON validation errors: ${res.errors?.join('; ')}`;
      } catch (err: any) {
        return `Chart JSON parsing failed: ${err.message || String(err)}`;
      }
    }
  },
};

export const createChartCompanionTool: AgentTool<{
  companionPath: string;
  title: string;
  nodes: ChartNode[];
  edges?: ChartEdge[];
  embedInNotePath?: string;
}> = {
  name: 'create_chart_companion',
  description: 'Creates a structured *.chart.json companion file and optionally embeds it in a markdown note.',
  definition: {
    name: 'create_chart_companion',
    description: 'Creates a structured *.chart.json companion file and optionally embeds it in a markdown note.',
    parameters: {
      type: 'object',
      properties: {
        companionPath: {
          type: 'string',
          description: 'Path for the chart companion file (e.g. "charts/architecture.chart.json").',
        },
        title: {
          type: 'string',
          description: 'Title of the diagram.',
        },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['id', 'label'],
          },
          description: 'Diagram nodes.',
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['source', 'target'],
          },
          description: 'Optional diagram connections/edges.',
        },
        embedInNotePath: {
          type: 'string',
          description: 'Optional path of a markdown note where the chart block should be embedded.',
        },
      },
      required: ['companionPath', 'title', 'nodes'],
    },
  },
  async execute({ companionPath, title, nodes, edges, embedInNotePath }) {
    try {
      const normalizedPath = companionPath.endsWith('.chart.json')
        ? companionPath
        : `${companionPath}.chart.json`;

      const chartData: ChartFileData = {
        title,
        nodes,
        edges,
      };

      const validation = validateChartFileData(chartData);
      if (!validation.valid) {
        return `Validation failed: ${validation.errors?.join('; ')}`;
      }

      await vaultService.writeFile(normalizedPath, JSON.stringify(chartData, null, 2));

      let embedMsg = '';
      if (embedInNotePath) {
        try {
          const noteContent = await vaultService.readFile(embedInNotePath);
          const block = `\n\n\`\`\`chart\nsrc: "${normalizedPath}"\ntype: "diagram"\n\`\`\`\n`;
          await vaultService.writeFile(embedInNotePath, noteContent.trimEnd() + block);
          embedMsg = ` and embedded into note "${embedInNotePath}"`;
        } catch (err: any) {
          embedMsg = ` (note embedding failed: ${err.message})`;
        }
      }

      return `Successfully created chart "${normalizedPath}" with ${nodes.length} nodes${embedMsg}.`;
    } catch (err: any) {
      return `Error creating chart companion: ${err.message || String(err)}`;
    }
  },
};

export const insertMermaidDiagramTool: AgentTool<{
  notePath: string;
  syntax: string;
  caption?: string;
}> = {
  name: 'insert_mermaid_diagram',
  description: 'Validates and inserts a Mermaid diagram code block directly into a markdown note.',
  definition: {
    name: 'insert_mermaid_diagram',
    description: 'Validates and inserts a Mermaid diagram code block directly into a markdown note.',
    parameters: {
      type: 'object',
      properties: {
        notePath: {
          type: 'string',
          description: 'Target note path in the vault.',
        },
        syntax: {
          type: 'string',
          description: 'Mermaid syntax (e.g. "flowchart TD\\n  A[Start] --> B[Process]").',
        },
        caption: {
          type: 'string',
          description: 'Optional heading or caption preceding the diagram.',
        },
      },
      required: ['notePath', 'syntax'],
    },
  },
  async execute({ notePath, syntax, caption }) {
    const validation = validateMermaidSyntax(syntax);
    if (!validation.valid) {
      return `Mermaid syntax validation failed: ${validation.errors?.join('; ')}`;
    }

    try {
      const existing = await vaultService.readFile(notePath);
      const heading = caption ? `\n\n### ${caption}\n` : '\n\n';
      const block = `${heading}\`\`\`mermaid\n${syntax.trim()}\n\`\`\`\n`;

      await vaultService.writeFile(notePath, existing.trimEnd() + block);
      return `Successfully inserted Mermaid diagram into "${notePath}".`;
    } catch (err: any) {
      return `Error inserting Mermaid diagram: ${err.message || String(err)}`;
    }
  },
};

export const updateDiagramTool: AgentTool<{
  target: string;
  type: 'chart_json' | 'mermaid';
  content: string;
}> = {
  name: 'update_diagram',
  description: 'Updates an existing chart companion file or replaces a Mermaid diagram in a note.',
  definition: {
    name: 'update_diagram',
    description: 'Updates an existing chart companion file or replaces a Mermaid diagram in a note.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'File path to *.chart.json or markdown note.',
        },
        type: {
          type: 'string',
          enum: ['chart_json', 'mermaid'],
          description: 'Format type of diagram.',
        },
        content: {
          type: 'string',
          description: 'Updated chart JSON string or replacement Mermaid code.',
        },
      },
      required: ['target', 'type', 'content'],
    },
  },
  async execute({ target, type, content }) {
    if (type === 'chart_json') {
      try {
        const parsed = JSON.parse(content);
        const val = validateChartFileData(parsed);
        if (!val.valid) {
          return `Chart validation failed: ${val.errors?.join('; ')}`;
        }
        await vaultService.writeFile(target, JSON.stringify(parsed, null, 2));
        return `Successfully updated chart "${target}".`;
      } catch (err: any) {
        return `Error updating chart: ${err.message || String(err)}`;
      }
    } else {
      const val = validateMermaidSyntax(content);
      if (!val.valid) {
        return `Mermaid validation failed: ${val.errors?.join('; ')}`;
      }
      try {
        const note = await vaultService.readFile(target);
        const regex = /```mermaid[\s\S]*?```/;
        if (!regex.test(note)) {
          return `No existing \`\`\`mermaid block found in "${target}" to update.`;
        }
        const updated = note.replace(regex, `\`\`\`mermaid\n${content.trim()}\n\`\`\``);
        await vaultService.writeFile(target, updated);
        return `Successfully updated Mermaid diagram in "${target}".`;
      } catch (err: any) {
        return `Error updating Mermaid diagram: ${err.message || String(err)}`;
      }
    }
  },
};

export const diagramTools = [
  validateDiagramSyntaxTool,
  createChartCompanionTool,
  insertMermaidDiagramTool,
  updateDiagramTool,
];
