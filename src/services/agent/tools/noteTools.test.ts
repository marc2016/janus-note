import { describe, it, expect, beforeEach } from 'vitest';
import {
  readNoteTool,
  createNoteTool,
  editNoteTool,
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

    // Test patch section
    await editNoteTool.execute({
      path: 'test_doc.md',
      mode: 'patch',
      targetSection: '## Section A',
      content: '## Section A\nUpdated content.',
    });
    content = await vaultService.readFile('test_doc.md');
    expect(content).toContain('Updated content.');
    expect(content).toContain('## Section B');
  });

  it('lists files and searches content', async () => {
    const listRes = await listVaultFilesTool.execute({ extension: '.md' });
    expect(listRes).toContain('test_doc.md');

    const searchRes = await searchVaultTool.execute({ query: 'Original' });
    expect(searchRes).toContain('test_doc.md');
  });
});
