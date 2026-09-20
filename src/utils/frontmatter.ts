import * as yaml from 'js-yaml';

export interface ParsedMarkdown {
  frontmatter: Record<string, any>;
  body: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseMarkdownWithFrontmatter(rawContent: string): ParsedMarkdown {
  const match = rawContent.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      frontmatter: {},
      body: rawContent
    };
  }

  const yamlBlock = match[1];
  const body = rawContent.slice(match[0].length);

  try {
    const parsed = yaml.load(yamlBlock);
    const frontmatter = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, any>) : {};
    return {
      frontmatter,
      body
    };
  } catch (err) {
    console.warn('Failed to parse YAML frontmatter:', err);
    return {
      frontmatter: { _parseError: String(err) },
      body
    };
  }
}

export function serializeMarkdownWithFrontmatter(frontmatter: Record<string, any>, body: string): string {
  // If no frontmatter or empty object, return body as is
  const keys = Object.keys(frontmatter).filter(k => !k.startsWith('_'));
  if (keys.length === 0) {
    return body;
  }

  const cleanFrontmatter: Record<string, any> = {};
  for (const key of keys) {
    cleanFrontmatter[key] = frontmatter[key];
  }

  try {
    const yamlString = yaml.dump(cleanFrontmatter, { lineWidth: -1 }).trim();
    return `---\n${yamlString}\n---\n\n${body.trimStart()}`;
  } catch (err) {
    console.warn('Failed to serialize YAML frontmatter:', err);
    return body;
  }
}
