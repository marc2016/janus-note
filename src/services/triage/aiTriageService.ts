import { llmService, LlmService } from '../llm/LlmService';
import { vaultService } from '../vaultService';

export interface TriageRecommendation {
  destPath: string;
  mode: 'create' | 'append';
  reason: string;
  title?: string;
}

export class AiTriageService {
  constructor(
    private llm: LlmService = llmService,
    private vault: typeof vaultService = vaultService
  ) {}

  public async suggestTriage(snippet: string): Promise<TriageRecommendation> {
    const trimmedSnippet = snippet.trim();
    if (!trimmedSnippet) {
      throw new Error('Cannot triage empty content');
    }

    // Check if an active model is configured
    const activeModel = this.llm.getActiveModel();
    if (!activeModel) {
      throw new Error('No AI model selected. Please configure a model in Settings.');
    }

    const payload = await this.vault.getTriagePayload();
    const vaultFiles = payload.vaultTree
      .filter(n => !n.isDir && n.path.endsWith('.md') && n.path.toLowerCase() !== 'inbox.md')
      .map(n => n.path);
    const vaultFolders = payload.vaultTree
      .filter(n => n.isDir)
      .map(n => n.path);

    const systemPrompt = `You are Janus Note Triage Assistant. Your job is to classify quick-capture thoughts or inbox snippets into the user's local vault note hierarchy.
Given a snippet of text from Inbox.md and the current list of markdown files and folders in the vault, recommend where this thought should be filed.

You must respond with ONLY a valid JSON object matching this schema:
{
  "destPath": "relative/path/to/note.md",
  "mode": "create" | "append",
  "reason": "1 concise sentence in the language of the snippet explaining why this location was chosen",
  "title": "Optional suggested title if creating a new note"
}

Rules:
1. "destPath" MUST end with ".md" and be a relative path without leading slashes. It must NEVER be "Inbox.md".
2. If the thought fits well into an existing file from the list, set "mode": "append" and use that exact file path.
3. If the thought represents a new project, distinct concept, or standalone document, set "mode": "create" and specify a clean path (e.g. "projects/xyz.md" or "notes/abc.md") using existing folder structures when applicable.
4. Do NOT output any markdown commentary or text outside the JSON object.`;

    const userPrompt = `Existing files in vault:
${vaultFiles.length > 0 ? vaultFiles.map(f => `- ${f}`).join('\n') : '(Vault is currently empty)'}

Existing folders in vault:
${vaultFolders.length > 0 ? vaultFolders.map(f => `- ${f}/`).join('\n') : '(No subfolders)'}

Snippet to triage:
"""
${trimmedSnippet}
"""`;

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      options: {
        temperature: 0.2
      }
    });

    const content = response.message?.content || '';
    return this.parseAndSanitizeRecommendation(content, vaultFiles);
  }

  public parseAndSanitizeRecommendation(rawText: string, existingFiles: string[]): TriageRecommendation {
    // 1. Extract JSON from rawText (handles markdown code blocks or raw text)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain a valid JSON object');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${jsonMatch[0]}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid AI response structure');
    }

    let destPath = typeof parsed.destPath === 'string' ? parsed.destPath.trim() : '';
    // Clean path
    destPath = destPath.replace(/^\/+/, '').replace(/[\\:*?"<>|]/g, '');
    if (!destPath.endsWith('.md')) {
      destPath = `${destPath}.md`;
    }
    if (destPath.toLowerCase() === 'inbox.md') {
      destPath = 'notes/quick-note.md';
    }

    let mode: 'create' | 'append' = parsed.mode === 'append' ? 'append' : 'create';
    // If append was suggested but file does not exist in vault, switch to create
    if (mode === 'append' && !existingFiles.includes(destPath)) {
      mode = 'create';
    }

    const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : (mode === 'append' ? `Appends to existing note '${destPath}'` : `Creates new note '${destPath}'`);

    const title = typeof parsed.title === 'string' ? parsed.title.trim() : undefined;

    return {
      destPath,
      mode,
      reason,
      title
    };
  }
}

export const aiTriageService = new AiTriageService();
