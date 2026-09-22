import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  const originalClipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });

  it('returns false for empty or non-string input', async () => {
    expect(await copyToClipboard('')).toBe(false);
    // @ts-expect-error test invalid type
    expect(await copyToClipboard(null)).toBe(false);
    // @ts-expect-error test invalid type
    expect(await copyToClipboard(undefined)).toBe(false);
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const result = await copyToClipboard('Hello world');
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Hello world');
  });

  it('falls back to document.execCommand when navigator.clipboard.writeText rejects', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    const mockTextArea = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };
    const mockDocument = {
      createElement: vi.fn().mockReturnValue(mockTextArea),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: execCommandMock,
    };
    vi.stubGlobal('document', mockDocument);

    const result = await copyToClipboard('Fallback text');
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Fallback text');
    expect(mockDocument.createElement).toHaveBeenCalledWith('textarea');
    expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockTextArea);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockTextArea);
  });

  it('falls back to document.execCommand when navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    const mockTextArea = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };
    const mockDocument = {
      createElement: vi.fn().mockReturnValue(mockTextArea),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: execCommandMock,
    };
    vi.stubGlobal('document', mockDocument);

    const result = await copyToClipboard('No clipboard API text');
    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('returns false when both navigator.clipboard and document.execCommand fail', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const mockTextArea = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };
    const mockDocument = {
      createElement: vi.fn().mockReturnValue(mockTextArea),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn().mockReturnValue(false),
    };
    vi.stubGlobal('document', mockDocument);

    const result = await copyToClipboard('Failed copy');
    expect(result).toBe(false);
  });
});
