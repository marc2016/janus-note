import { vaultService } from '../../vaultService';
import { FileNode } from '../../../types/vault';
import { AgentTool } from './types';

function flattenFiles(nodes: FileNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.is_dir && node.children) {
      result.push(...flattenFiles(node.children));
    } else if (!node.is_dir) {
      result.push(node.path);
    }
  }
  return result;
}

export const findRelatedNotesTool: AgentTool<{
  topic: string;
  tags?: string[];
}> = {
  name: 'find_related_notes',
  description: 'Discovers related notes across the vault matching a topic or frontmatter tags.',
  definition: {
    name: 'find_related_notes',
    description: 'Discovers related notes across the vault matching a topic or frontmatter tags.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The search topic or keyword to find relevant notes.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of tags to filter or match in frontmatter.',
        },
      },
      required: ['topic'],
    },
  },
  async execute({ topic, tags }) {
    try {
      const nodes = await vaultService.listFiles();
      const markdownFiles = flattenFiles(nodes).filter((p) => p.endsWith('.md'));
      const lowerTopic = topic.toLowerCase();
      const lowerTags = tags?.map((t) => t.toLowerCase()) || [];

      const results: { path: string; score: number; matchReason: string }[] = [];

      for (const path of markdownFiles) {
        try {
          const content = await vaultService.readFile(path);
          const lowerContent = content.toLowerCase();

          let score = 0;
          const reasons: string[] = [];

          if (path.toLowerCase().includes(lowerTopic)) {
            score += 10;
            reasons.push('Title match');
          }

          const topicOccurrences = (lowerContent.match(new RegExp(lowerTopic, 'g')) || []).length;
          if (topicOccurrences > 0) {
            score += Math.min(topicOccurrences * 2, 20);
            reasons.push(`${topicOccurrences} occurrences in content`);
          }

          for (const tag of lowerTags) {
            if (lowerContent.includes(`tags:`) && lowerContent.includes(tag)) {
              score += 15;
              reasons.push(`Tag match: "${tag}"`);
            }
          }

          if (score > 0) {
            results.push({ path, score, matchReason: reasons.join(', ') });
          }
        } catch {
          // ignore unreadable notes
        }
      }

      results.sort((a, b) => b.score - a.score);

      return results.length > 0
        ? JSON.stringify(results.slice(0, 10), null, 2)
        : `No related notes found for topic "${topic}".`;
    } catch (err: any) {
      return `Error finding related notes: ${err.message || String(err)}`;
    }
  },
};

export const getNoteBacklinksTool: AgentTool<{ notePath: string }> = {
  name: 'get_note_backlinks',
  description: 'Finds all notes in the vault that link to the target note via [[WikiLinks]] or markdown links.',
  definition: {
    name: 'get_note_backlinks',
    description: 'Finds all notes in the vault that link to the target note via [[WikiLinks]] or markdown links.',
    parameters: {
      type: 'object',
      properties: {
        notePath: {
          type: 'string',
          description: 'The path or title of the target note.',
        },
      },
      required: ['notePath'],
    },
  },
  async execute({ notePath }) {
    try {
      const nodes = await vaultService.listFiles();
      const markdownFiles = flattenFiles(nodes).filter((p) => p.endsWith('.md'));

      const cleanName = notePath.split('/').pop()?.replace(/\.md$/, '') || notePath;
      const wikiLinkRegex = new RegExp(`\\[\\[${cleanName}(\\|[^\\]]+)?\\]\\]`, 'i');
      const mdLinkRegex = new RegExp(`\\]\\([^)]*${cleanName}(\\.md)?\\)`, 'i');

      const backlinks: { linkingNote: string; previewSnippet: string }[] = [];

      for (const path of markdownFiles) {
        if (path === notePath) continue;

        try {
          const content = await vaultService.readFile(path);
          const lines = content.split('\n');

          for (const line of lines) {
            if (wikiLinkRegex.test(line) || mdLinkRegex.test(line)) {
              backlinks.push({
                linkingNote: path,
                previewSnippet: line.trim(),
              });
              break;
            }
          }
        } catch {
          // ignore unreadable
        }
      }

      return backlinks.length > 0
        ? JSON.stringify(backlinks, null, 2)
        : `No backlinks found referencing "${notePath}".`;
    } catch (err: any) {
      return `Error finding backlinks: ${err.message || String(err)}`;
    }
  },
};

export const extractKeyConceptsTool: AgentTool<{ paths: string[] }> = {
  name: 'extract_key_concepts',
  description: 'Extracts headings, bullet items, and core concepts from multiple notes into a structured digest.',
  definition: {
    name: 'extract_key_concepts',
    description: 'Extracts headings, bullet items, and core concepts from multiple notes into a structured digest.',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of note paths to inspect.',
        },
      },
      required: ['paths'],
    },
  },
  async execute({ paths }) {
    try {
      const digest: { path: string; headings: string[]; keyPoints: string[] }[] = [];

      for (const path of paths) {
        try {
          const content = await vaultService.readFile(path);
          const lines = content.split('\n');

          const headings: string[] = [];
          const keyPoints: string[] = [];

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
              headings.push(trimmed);
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              if (keyPoints.length < 15) {
                keyPoints.push(trimmed.slice(2).trim());
              }
            }
          }

          digest.push({ path, headings, keyPoints });
        } catch (err: any) {
          digest.push({ path, headings: [], keyPoints: [`Failed to read: ${err.message}`] });
        }
      }

      return JSON.stringify(digest, null, 2);
    } catch (err: any) {
      return `Error extracting concepts: ${err.message || String(err)}`;
    }
  },
};

export const synthesizeSummaryTool: AgentTool<{
  sourcePaths: string[];
  targetNotePath?: string;
  focusPrompt?: string;
}> = {
  name: 'synthesize_summary',
  description: 'Aggregates content from multiple notes and creates a synthesized summary document.',
  definition: {
    name: 'synthesize_summary',
    description: 'Aggregates content from multiple notes and creates a synthesized summary document.',
    parameters: {
      type: 'object',
      properties: {
        sourcePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source note paths to summarize.',
        },
        targetNotePath: {
          type: 'string',
          description: 'Optional path where the summary note should be written.',
        },
        focusPrompt: {
          type: 'string',
          description: 'Optional specific focus angle for the summary (e.g. "Architecture decisions" or "Next steps").',
        },
      },
      required: ['sourcePaths'],
    },
  },
  async execute({ sourcePaths, targetNotePath, focusPrompt }) {
    try {
      const contents: { path: string; content: string }[] = [];
      for (const path of sourcePaths) {
        try {
          const content = await vaultService.readFile(path);
          contents.push({ path, content });
        } catch {
          // ignore
        }
      }

      if (contents.length === 0) {
        return 'Error: None of the requested source notes could be read.';
      }

      let summaryMarkdown = `# Research Summary\n\n`;
      if (focusPrompt) {
        summaryMarkdown += `> **Focus**: ${focusPrompt}\n\n`;
      }
      summaryMarkdown += `Synthesized from ${contents.length} notes: ${contents.map((c) => `\`${c.path}\``).join(', ')}.\n\n`;

      summaryMarkdown += `## Key Findings\n\n`;
      for (const item of contents) {
        summaryMarkdown += `### ${item.path}\n`;
        const lines = item.content.split('\n').filter((l) => l.trim().length > 0);
        const snippet = lines.slice(0, 5).join('\n');
        summaryMarkdown += `${snippet}\n\n`;
      }

      if (targetNotePath) {
        await vaultService.writeFile(targetNotePath, summaryMarkdown);
        return `Successfully synthesized summary and saved to "${targetNotePath}".`;
      }

      return summaryMarkdown;
    } catch (err: any) {
      return `Error synthesizing summary: ${err.message || String(err)}`;
    }
  },
};

export const researchTools = [
  findRelatedNotesTool,
  getNoteBacklinksTool,
  extractKeyConceptsTool,
  synthesizeSummaryTool,
];
