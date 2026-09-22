import { describe, it, expect } from 'vitest';
import { vaultService } from './vaultService';

describe('vaultService folder creation', () => {
  it('should support creating folders and nested subfolders in browser mock mode', async () => {
    await vaultService.createFolder('docs/architecture/adr');
    const files = await vaultService.listFiles();
    
    const docsDir = files.find(f => f.name === 'docs');
    expect(docsDir).toBeDefined();
    expect(docsDir?.is_dir).toBe(true);
  });
});

describe('vaultService path relocation', () => {
  it('should move a file into an existing or new folder in browser mock mode', async () => {
    await vaultService.writeFile('temp/note.md', '# Temp Note');
    await vaultService.createFolder('archive');

    const moved = await vaultService.movePaths(['temp/note.md'], 'archive');
    expect(moved).toEqual(['archive/note.md']);

    const content = await vaultService.readFile('archive/note.md');
    expect(content).toBe('# Temp Note');
  });

  it('should move multiple files in batch to destination folder', async () => {
    await vaultService.writeFile('batch1.md', '# 1');
    await vaultService.writeFile('batch2.md', '# 2');
    await vaultService.createFolder('target-batch');

    const moved = await vaultService.movePaths(['batch1.md', 'batch2.md'], 'target-batch');
    expect(moved.length).toBe(2);
    expect(moved).toContain('target-batch/batch1.md');
    expect(moved).toContain('target-batch/batch2.md');

    const files = await vaultService.listFiles();
    const targetDir = files.find(f => f.name === 'target-batch');
    expect(targetDir?.children?.length).toBe(2);
  });

  it('should move a directory into another directory', async () => {
    await vaultService.writeFile('source-dir/doc.md', '# In Source');
    await vaultService.createFolder('dest-parent');

    const moved = await vaultService.movePaths(['source-dir'], 'dest-parent');
    expect(moved).toEqual(['dest-parent/source-dir']);

    const content = await vaultService.readFile('dest-parent/source-dir/doc.md');
    expect(content).toBe('# In Source');
  });

  it('should reject circular moves into itself or subdirectories', async () => {
    await vaultService.writeFile('cycle-folder/sub/item.md', 'data');

    await expect(
      vaultService.movePaths(['cycle-folder'], 'cycle-folder/sub')
    ).rejects.toThrow(/Cannot move directory/);
  });
});

describe('vaultService self-write suppression', () => {
  it('should identify recent writes as self-writes', async () => {
    const testPath = 'self-write-test.md';
    const testContent = '# Self Write Test Content';

    expect(vaultService.isSelfWrite(testPath)).toBe(false);

    await vaultService.writeFile(testPath, testContent);

    // Should recognize self-write by path
    expect(vaultService.isSelfWrite(testPath)).toBe(true);
    // Path with leading slash should also match
    expect(vaultService.isSelfWrite(`/${testPath}`)).toBe(true);
    // Should match when exact content is provided
    expect(vaultService.isSelfWrite(testPath, testContent)).toBe(true);
    // Should NOT match if different content is provided
    expect(vaultService.isSelfWrite(testPath, '# Different Content')).toBe(false);
  });
});
