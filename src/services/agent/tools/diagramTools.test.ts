import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateMermaidSyntax,
  validateChartFileData,
  validateDiagramSyntaxTool,
  createChartCompanionTool,
  insertMermaidDiagramTool,
  updateDiagramTool,
} from './diagramTools';
import { vaultService } from '../../vaultService';

describe('diagramTools', () => {
  beforeEach(async () => {
    await vaultService.writeFile('Architecture.md', '# Architecture\nOverview of the system.');
  });

  it('validates Mermaid syntax and detects invalid headers or unbalanced brackets', async () => {
    const valid = 'flowchart TD\n  A[Start] --> B(Process)\n  B --> C{Decision}';
    expect(validateMermaidSyntax(valid).valid).toBe(true);

    const invalidHeader = 'unknownDiagram TD\n  A --> B';
    const resHeader = validateMermaidSyntax(invalidHeader);
    expect(resHeader.valid).toBe(false);
    expect(resHeader.errors?.[0]).toContain('diagram type header');

    const unbalanced = 'flowchart TD\n  A[Start --> B';
    const resUnbalanced = validateMermaidSyntax(unbalanced);
    expect(resUnbalanced.valid).toBe(false);
    expect(resUnbalanced.errors?.[0]).toContain('bracket');

    const toolRes = await validateDiagramSyntaxTool.execute({
      type: 'mermaid',
      content: valid,
    });
    expect(toolRes).toContain('Mermaid syntax is valid');
  });

  it('validates Chart JSON structure correctly', () => {
    const valid = {
      title: 'App Overview',
      nodes: [{ id: '1', label: 'Frontend' }, { id: '2', label: 'Backend' }],
      edges: [{ source: '1', target: '2' }],
    };
    expect(validateChartFileData(valid).valid).toBe(true);

    const invalid = { title: '', nodes: [] };
    const res = validateChartFileData(invalid);
    expect(res.valid).toBe(false);
  });

  it('creates chart companion and embeds in note', async () => {
    const res = await createChartCompanionTool.execute({
      companionPath: 'charts/system.chart.json',
      title: 'System Diagram',
      nodes: [
        { id: 'client', label: 'Client App' },
        { id: 'server', label: 'Rust Core' },
      ],
      embedInNotePath: 'Architecture.md',
    });

    expect(res).toContain('Successfully created chart');
    expect(res).toContain('embedded into note');

    const note = await vaultService.readFile('Architecture.md');
    expect(note).toContain('```chart');
    expect(note).toContain('charts/system.chart.json');

    const companion = JSON.parse(await vaultService.readFile('charts/system.chart.json'));
    expect(companion.title).toBe('System Diagram');
    expect(companion.nodes).toHaveLength(2);
  });

  it('inserts and updates Mermaid code block in note', async () => {
    const mermaidCode = 'flowchart TD\n  A[Init] --> B[Ready]';
    const insertRes = await insertMermaidDiagramTool.execute({
      notePath: 'Architecture.md',
      syntax: mermaidCode,
      caption: 'Workflow Diagram',
    });
    expect(insertRes).toContain('Successfully inserted Mermaid diagram');

    let note = await vaultService.readFile('Architecture.md');
    expect(note).toContain('```mermaid\nflowchart TD\n  A[Init] --> B[Ready]\n```');

    // Update Mermaid diagram
    const updatedCode = 'flowchart LR\n  X[Step 1] --> Y[Step 2]';
    const updateRes = await updateDiagramTool.execute({
      target: 'Architecture.md',
      type: 'mermaid',
      content: updatedCode,
    });
    expect(updateRes).toContain('Successfully updated Mermaid diagram');

    note = await vaultService.readFile('Architecture.md');
    expect(note).toContain('flowchart LR\n  X[Step 1] --> Y[Step 2]');
  });
});
