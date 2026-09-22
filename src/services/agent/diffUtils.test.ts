import { describe, it, expect } from 'vitest';
import { generateUnifiedDiff } from './diffUtils';

describe('diffUtils', () => {
  it('returns No changes when text is identical', () => {
    expect(generateUnifiedDiff('doc.md', 'hello', 'hello')).toBe('No changes.');
  });

  it('generates unified diff with deletions and additions', () => {
    const oldText = 'Line 1\nLine 2\nLine 3';
    const newText = 'Line 1\nLine 2 modified\nLine 3';
    const diff = generateUnifiedDiff('doc.md', oldText, newText);

    expect(diff).toContain('--- a/doc.md');
    expect(diff).toContain('+++ b/doc.md');
    expect(diff).toContain('- Line 2');
    expect(diff).toContain('+ Line 2 modified');
  });

  it('handles multi-line additions and replacements', () => {
    const oldText = '# Title\n\nOld intro.';
    const newText = '# Title\n\nNew intro.\nNew paragraph.';
    const diff = generateUnifiedDiff('note.md', oldText, newText);

    expect(diff).toContain('- Old intro.');
    expect(diff).toContain('+ New intro.');
    expect(diff).toContain('+ New paragraph.');
  });
});
