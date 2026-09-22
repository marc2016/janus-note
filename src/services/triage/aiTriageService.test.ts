import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiTriageService } from './aiTriageService';
import { LlmService } from '../llm/LlmService';
import { vaultService } from '../vaultService';

describe('AiTriageService', () => {
  let mockLlm: LlmService;
  let service: AiTriageService;

  beforeEach(() => {
    mockLlm = {
      getActiveModel: vi.fn().mockReturnValue('mock-model-v1'),
      chat: vi.fn(),
    } as unknown as LlmService;

    service = new AiTriageService(mockLlm, vaultService);
  });

  describe('parseAndSanitizeRecommendation', () => {
    it('should parse raw JSON properly', () => {
      const raw = '{"destPath": "projects/app.md", "mode": "append", "reason": "Relates to app project"}';
      const result = service.parseAndSanitizeRecommendation(raw, ['projects/app.md']);

      expect(result.destPath).toBe('projects/app.md');
      expect(result.mode).toBe('append');
      expect(result.reason).toBe('Relates to app project');
    });

    it('should extract JSON wrapped in markdown code blocks and conversational text', () => {
      const raw = `Here is my recommendation:
\`\`\`json
{
  "destPath": "ideas/architecture.md",
  "mode": "create",
  "reason": "This is a new architectural discussion",
  "title": "Architecture Overview"
}
\`\`\`
Hope this helps!`;
      const result = service.parseAndSanitizeRecommendation(raw, []);

      expect(result.destPath).toBe('ideas/architecture.md');
      expect(result.mode).toBe('create');
      expect(result.reason).toBe('This is a new architectural discussion');
      expect(result.title).toBe('Architecture Overview');
    });

    it('should append .md extension if missing and sanitize path', () => {
      const raw = '{"destPath": "/notes/new-idea", "mode": "create"}';
      const result = service.parseAndSanitizeRecommendation(raw, []);

      expect(result.destPath).toBe('notes/new-idea.md');
    });

    it('should prevent targeting Inbox.md directly', () => {
      const raw = '{"destPath": "Inbox.md", "mode": "append"}';
      const result = service.parseAndSanitizeRecommendation(raw, ['Inbox.md']);

      expect(result.destPath).not.toBe('Inbox.md');
      expect(result.destPath).toBe('notes/quick-note.md');
    });

    it('should fall back to create mode if append was chosen for a non-existent file', () => {
      const raw = '{"destPath": "nonexistent.md", "mode": "append"}';
      const result = service.parseAndSanitizeRecommendation(raw, ['existing.md']);

      expect(result.destPath).toBe('nonexistent.md');
      expect(result.mode).toBe('create');
    });

    it('should throw an error if no JSON object is found', () => {
      expect(() => service.parseAndSanitizeRecommendation('Sorry, I cannot help with that.', [])).toThrow(
        /did not contain a valid JSON object/
      );
    });
  });

  describe('suggestTriage integration flow', () => {
    it('should reject empty snippets', async () => {
      await expect(service.suggestTriage('   ')).rejects.toThrow(/Cannot triage empty content/);
    });

    it('should reject if no model is selected', async () => {
      (mockLlm.getActiveModel as any).mockReturnValue('');
      await expect(service.suggestTriage('Some note')).rejects.toThrow(/No AI model selected/);
    });

    it('should successfully call LLM and return sanitized recommendation', async () => {
      (mockLlm.chat as any).mockResolvedValue({
        message: {
          content: '{"destPath": "tasks/plan.md", "mode": "create", "reason": "Task item"}',
        },
      });

      const rec = await service.suggestTriage('Buy groceries and plan week');
      expect(rec.destPath).toBe('tasks/plan.md');
      expect(rec.mode).toBe('create');
      expect(rec.reason).toBe('Task item');
    });
  });
});
