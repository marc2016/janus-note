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

export const readNoteTool: AgentTool<{ path: string }> = {
  name: 'read_note',
  description: 'Reads the entire content of a note or file from the vault.',
  definition: {
    name: 'read_note',
    description: 'Reads the entire content of a note or file from the vault.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to the note or file in the vault (e.g. "Inbox.md" or "projects/app.md").',
        },
      },
      required: ['path'],
    },
  },
  async execute({ path }) {
    try {
      const content = await vaultService.readFile(path);
      return content;
    } catch (err: any) {
      return `Error reading file "${path}": ${err.message || String(err)}`;
    }
  },
};

export const createNoteTool: AgentTool<{ path: string; content: string }> = {
  name: 'create_note',
  description: 'Creates a new note with the specified markdown content in the vault.',
  definition: {
    name: 'create_note',
    description: 'Creates a new note with the specified markdown content in the vault.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative file path for the new note (must end with .md or desired extension).',
        },
        content: {
          type: 'string',
          description: 'The markdown content to write.',
        },
      },
      required: ['path', 'content'],
    },
  },
  async execute({ path, content }) {
    try {
      await vaultService.writeFile(path, content);
      return `Successfully created note "${path}".`;
    } catch (err: any) {
      return `Error creating note "${path}": ${err.message || String(err)}`;
    }
  },
};

function cleanMarkdown(text: string): string {
  let cleaned = text;
  // Strip HTML paragraph/br tags if leftover from previous sessions
  if (cleaned.includes('<p>') || cleaned.includes('</p>')) {
    cleaned = cleaned
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n');
  }
  // Ensure headings that were glued to preceding text get their own line
  cleaned = cleaned.replace(/([^#\r\n])\s+(#{1,6}\s+)/g, '$1\n\n$2');

  return cleaned.trim();
}

export const editNoteTool: AgentTool<{
  path: string;
  mode?: 'append' | 'replace' | 'patch';
  content: string;
  targetSection?: string;
}> = {
  name: 'edit_note',
  description: 'Edits an existing note by appending, replacing whole content, or replacing a specific section.',
  definition: {
    name: 'edit_note',
    description: 'Edits an existing note by appending, replacing whole content, or replacing a specific section.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to the note to edit.',
        },
        mode: {
          type: 'string',
          enum: ['append', 'replace', 'patch'],
          description: 'The edit mode: "append" adds content to the bottom; "replace" replaces entire file; "patch" replaces a targeted section.',
        },
        content: {
          type: 'string',
          description: 'The new or appended content.',
        },
        targetSection: {
          type: 'string',
          description: 'Optional heading title of the section to replace when using mode "patch" (e.g. "## Key Features").',
        },
      },
      required: ['path', 'content'],
    },
  },
  async execute({ path, mode, content, targetSection }) {
    try {
      const existing = await vaultService.readFile(path);
      const cleanExisting = cleanMarkdown(existing);
      const cleanContent = cleanMarkdown(content);
      let updated = cleanExisting;
      const actualMode = mode || (targetSection ? 'patch' : 'append');

      if (actualMode === 'append') {
        updated = cleanExisting.trimEnd() + '\n\n' + cleanContent.trimStart();
      } else if (actualMode === 'replace') {
        updated = cleanContent;
      } else if (actualMode === 'patch') {
        if (!targetSection) {
          return `Error: "targetSection" must be provided when using mode "patch".`;
        }
        const sectionIndex = cleanExisting.indexOf(targetSection);
        if (sectionIndex === -1) {
          return `Error: Target section "${targetSection}" not found in "${path}".`;
        }
        // Find next heading of same or higher level, or end of file
        const levelMatch = targetSection.match(/^(#+)/);
        const hashes = levelMatch ? levelMatch[1] : '##';
        const restOfFile = cleanExisting.slice(sectionIndex + targetSection.length);
        const nextHeadingRegex = new RegExp(`\n(?=#{1,${hashes.length}}\\s+)`);
        const nextHeadingMatch = restOfFile.search(nextHeadingRegex);

        const before = cleanExisting.slice(0, sectionIndex);
        const after = nextHeadingMatch !== -1 ? restOfFile.slice(nextHeadingMatch) : '';
        updated = before + cleanContent + after;
      }

      await vaultService.writeFile(path, updated);
      return `Successfully edited note "${path}".`;
    } catch (err: any) {
      return `Error editing note "${path}": ${err.message || String(err)}`;
    }
  },
};

export const listVaultFilesTool: AgentTool<{ folder?: string; extension?: string }> = {
  name: 'list_vault_files',
  description: 'Lists all files and directories in the vault, optionally filtered by folder or extension.',
  definition: {
    name: 'list_vault_files',
    description: 'Lists all files and directories in the vault, optionally filtered by folder or extension.',
    parameters: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description: 'Optional folder path to filter files.',
        },
        extension: {
          type: 'string',
          description: 'Optional extension filter (e.g. ".md" or ".tasks.json").',
        },
      },
    },
  },
  async execute({ folder, extension }) {
    try {
      const nodes = await vaultService.listFiles();
      let paths = flattenFiles(nodes);

      if (folder) {
        const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
        paths = paths.filter((p) => p.startsWith(cleanFolder + '/') || p === cleanFolder);
      }

      if (extension) {
        const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
        paths = paths.filter((p) => p.endsWith(cleanExt));
      }

      return JSON.stringify(paths, null, 2);
    } catch (err: any) {
      return `Error listing vault files: ${err.message || String(err)}`;
    }
  },
};

export const searchVaultTool: AgentTool<{ query: string; searchContent?: boolean }> = {
  name: 'search_vault',
  description: 'Searches note titles and optionally file contents across the vault for keywords.',
  definition: {
    name: 'search_vault',
    description: 'Searches note titles and optionally file contents across the vault for keywords.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or keyword.',
        },
        searchContent: {
          type: 'boolean',
          description: 'If true, searches file contents in addition to filenames (default: true).',
        },
      },
      required: ['query'],
    },
  },
  async execute({ query, searchContent = true }) {
    try {
      const nodes = await vaultService.listFiles();
      const allPaths = flattenFiles(nodes);
      const lowerQuery = query.toLowerCase();
      const matches: { path: string; snippet?: string }[] = [];

      for (const p of allPaths) {
        const pathMatches = p.toLowerCase().includes(lowerQuery);
        if (pathMatches) {
          matches.push({ path: p, snippet: 'Matched file path' });
          continue;
        }

        if (searchContent && p.endsWith('.md')) {
          try {
            const content = await vaultService.readFile(p);
            const contentLower = content.toLowerCase();
            const idx = contentLower.indexOf(lowerQuery);
            if (idx !== -1) {
              const start = Math.max(0, idx - 40);
              const end = Math.min(content.length, idx + query.length + 40);
              const snippet = '...' + content.slice(start, end).replace(/\n/g, ' ') + '...';
              matches.push({ path: p, snippet });
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }

      return matches.length > 0
        ? JSON.stringify(matches, null, 2)
        : `No matches found for query "${query}".`;
    } catch (err: any) {
      return `Error searching vault: ${err.message || String(err)}`;
    }
  },
};

export const noteTools = [
  readNoteTool,
  createNoteTool,
  editNoteTool,
  listVaultFilesTool,
  searchVaultTool,
];
