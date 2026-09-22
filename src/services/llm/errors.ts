export class LlmError extends Error {
  public readonly provider?: string;
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, options?: { provider?: string; statusCode?: number; details?: unknown }) {
    super(message);
    this.name = 'LlmError';
    this.provider = options?.provider;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
  }
}

export class LlmConnectionError extends LlmError {
  constructor(message: string, options?: { provider?: string; statusCode?: number; details?: unknown }) {
    super(message, options);
    this.name = 'LlmConnectionError';
  }
}

export class LlmAuthError extends LlmError {
  constructor(message: string, options?: { provider?: string; statusCode?: number; details?: unknown }) {
    super(message, options);
    this.name = 'LlmAuthError';
  }
}

export class LlmQuotaError extends LlmError {
  constructor(message: string, options?: { provider?: string; statusCode?: number; details?: unknown }) {
    super(message, options);
    this.name = 'LlmQuotaError';
  }
}
