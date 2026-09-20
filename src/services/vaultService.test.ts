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
