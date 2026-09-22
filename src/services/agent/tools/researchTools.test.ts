import { describe, it, expect, beforeEach } from 'vitest';
import {
  findRelatedNotesTool,
  getNoteBacklinksTool,
  extractKeyConceptsTool,
  synthesizeSummaryTool,
} from './researchTools';
import { vaultService } from '../../vaultService';

describe('researchTools', () => {
  beforeEach(async () => {
    await vaultService.writeFile(
      'ConceptA.md',
      '---\ntags: [design, architecture]\n---\n# Concept A\n\n- Local-first architecture\n- Tauri v2 backend\n\nReferences [[ConceptB]] for details.'
    );
    await vaultService.writeFile(
      'ConceptB.md',
      '# Concept B\n\n- Companion files integration\n- TipTap block editor'
    );
  });

  it('finds related notes based on topic and tags', async () => {
    const res = await findRelatedNotesTool.execute({ topic: 'Tauri', tags: ['design'] });
    expect(res).toContain('ConceptA.md');
  });

  it('finds backlinks referencing another note', async () => {
    const res = await getNoteBacklinksTool.execute({ notePath: 'ConceptB.md' });
    expect(res).toContain('ConceptA.md');
    expect(res).toContain('[[ConceptB]]');
  });

  it('extracts key concepts and headings', async () => {
    const res = await extractKeyConceptsTool.execute({ paths: ['ConceptA.md', 'ConceptB.md'] });
    const parsed = JSON.parse(res);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].headings).toContain('# Concept A');
    expect(parsed[0].keyPoints).toContain('Local-first architecture');
  });

  it('synthesizes summary and saves to target note', async () => {
    const res = await synthesizeSummaryTool.execute({
      sourcePaths: ['ConceptA.md', 'ConceptB.md'],
      targetNotePath: 'Summary.md',
      focusPrompt: 'Architecture overview',
    });
    expect(res).toContain('Successfully synthesized summary');

    const summaryContent = await vaultService.readFile('Summary.md');
    expect(summaryContent).toContain('Architecture overview');
    expect(summaryContent).toContain('ConceptA.md');
    expect(summaryContent).toContain('ConceptB.md');
  });
});
