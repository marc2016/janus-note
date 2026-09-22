import { describe, it, expect } from 'vitest';
import { LlmError, LlmConnectionError, LlmAuthError, LlmQuotaError } from '../errors';

describe('LLM Error Classes', () => {
  it('should instantiate LlmError with provider and status code', () => {
    const err = new LlmError('Base error', { provider: 'test', statusCode: 500 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LlmError');
    expect(err.provider).toBe('test');
    expect(err.statusCode).toBe(500);
  });

  it('should instantiate specific subclasses correctly', () => {
    const connErr = new LlmConnectionError('Failed to reach Ollama', { provider: 'ollama' });
    expect(connErr).toBeInstanceOf(LlmError);
    expect(connErr.name).toBe('LlmConnectionError');

    const authErr = new LlmAuthError('Invalid Gemini key', { provider: 'gemini', statusCode: 401 });
    expect(authErr).toBeInstanceOf(LlmError);
    expect(authErr.name).toBe('LlmAuthError');
    expect(authErr.statusCode).toBe(401);

    const quotaErr = new LlmQuotaError('Rate limit exceeded', { provider: 'gemini', statusCode: 429 });
    expect(quotaErr).toBeInstanceOf(LlmError);
    expect(quotaErr.name).toBe('LlmQuotaError');
    expect(quotaErr.statusCode).toBe(429);
  });
});
