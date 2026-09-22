import { describe, it, expect, beforeEach } from 'vitest';
import {
  readNoteTool,
  createNoteTool,
  editNoteTool,
  searchAndReplaceNoteTool,
  listVaultFilesTool,
  searchVaultTool,
} from './noteTools';
import { vaultService } from '../../vaultService';

describe('noteTools', () => {
  beforeEach(async () => {
    // Reset/seed vault for test
    await vaultService.writeFile('test_doc.md', '# Main Title\n\n## Section A\nOriginal content.\n\n## Section B\nKeep this.');
  });

  it('reads note content successfully', async () => {
    const res = await readNoteTool.execute({ path: 'test_doc.md' });
    expect(res).toContain('# Main Title');
  });

  it('creates new notes in the vault', async () => {
    const res = await createNoteTool.execute({ path: 'new_note.md', content: 'Brand new!' });
    expect(res).toContain('Successfully created note');
    const content = await vaultService.readFile('new_note.md');
    expect(content).toBe('Brand new!');
  });

  it('appends and patches sections in existing notes', async () => {
    // Test append
    await editNoteTool.execute({
      path: 'test_doc.md',
      mode: 'append',
      content: '## Section C\nAppended.',
    });
    let content = await vaultService.readFile('test_doc.md');
    expect(content).toContain('## Section C\nAppended.');

    // Test patch section with stripped heading name
    await editNoteTool.execute({
      path: 'test_doc.md',
      mode: 'patch',
      targetSection: 'Section A',
      content: '## Section A\nUpdated content.',
    });
    content = await vaultService.readFile('test_doc.md');
    expect(content).toContain('Updated content.');
    expect(content).toContain('## Section B');
  });

  it('replaces targeted text passages using search_and_replace_note', async () => {
    const res = await searchAndReplaceNoteTool.execute({
      path: 'test_doc.md',
      searchString: 'Original content.',
      replacement: 'Precisely replaced paragraph.',
    });
    expect(res).toContain('Successfully replaced text');

    const updated = await vaultService.readFile('test_doc.md');
    expect(updated).toContain('Precisely replaced paragraph.');
    expect(updated).not.toContain('Original content.');
    expect(updated).toContain('## Section B');
  });

  it('handles search_and_replace_note ambiguity and missing target', async () => {
    // Missing string
    const notFound = await searchAndReplaceNoteTool.execute({
      path: 'test_doc.md',
      searchString: 'Non-existent text',
      replacement: 'Something',
    });
    expect(notFound).toContain('Could not find searchString');

    // Seed file with duplicates
    await vaultService.writeFile('dups.md', 'repeat word and repeat word');
    const duplicateMatch = await searchAndReplaceNoteTool.execute({
      path: 'dups.md',
      searchString: 'repeat word',
      replacement: 'unique word',
    });
    expect(duplicateMatch).toContain('found 2 times');
  });

  it('lists files and searches content', async () => {
    const listRes = await listVaultFilesTool.execute({ extension: '.md' });
    expect(listRes).toContain('test_doc.md');

    const searchRes = await searchVaultTool.execute({ query: 'Original' });
    expect(searchRes).toContain('test_doc.md');
  });
});
