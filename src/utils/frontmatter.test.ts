import { describe, it, expect } from 'vitest';
import { parseMarkdownWithFrontmatter, serializeMarkdownWithFrontmatter } from './frontmatter';

describe('YAML Frontmatter Extraction and Serialization', () => {
  it('should extract YAML frontmatter and separate body text cleanly', () => {
    const raw = `---
title: Janus Note Architecture
tags: [architecture, tauri, rust]
status: in-progress
---

# Architecture Overview

This document outlines the foundation of Janus Note.
`;

    const result = parseMarkdownWithFrontmatter(raw);
    expect(result.frontmatter.title).toBe('Janus Note Architecture');
    expect(result.frontmatter.tags).toEqual(['architecture', 'tauri', 'rust']);
    expect(result.frontmatter.status).toBe('in-progress');
    expect(result.body).toContain('# Architecture Overview');
  });

  it('should handle markdown files with no frontmatter gracefully', () => {
    const raw = '# Just Plain Markdown\n\nNo frontmatter here.';
    const result = parseMarkdownWithFrontmatter(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(raw);
  });

  it('should preserve metadata and serialize correctly across save cycles', () => {
    const originalMetadata = {
      title: 'Sprint Planning',
      sprint: 1,
      tags: ['sprint', 'planning'],
      companion: 'sprint-1.tasks.json'
    };
    const body = '## Goals\n\n- Complete Foundation tasks';

    const serialized = serializeMarkdownWithFrontmatter(originalMetadata, body);
    expect(serialized).toContain('title: Sprint Planning');
    expect(serialized).toContain('sprint: 1');
    expect(serialized).toContain('companion: sprint-1.tasks.json');
    expect(serialized).toContain('## Goals');

    // Parse again to verify roundtrip preservation
    const parsedAgain = parseMarkdownWithFrontmatter(serialized);
    expect(parsedAgain.frontmatter.title).toBe(originalMetadata.title);
    expect(parsedAgain.frontmatter.sprint).toBe(originalMetadata.sprint);
    expect(parsedAgain.frontmatter.companion).toBe(originalMetadata.companion);
    expect(parsedAgain.body).toContain(body);
  });

  it('should return untouched body when frontmatter object is empty', () => {
    const body = '# Title\n\nContent';
    const serialized = serializeMarkdownWithFrontmatter({}, body);
    expect(serialized).toBe(body);
  });
});
