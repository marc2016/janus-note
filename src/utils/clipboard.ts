/**
 * Copies a given text string to the system clipboard.
 * Prioritizes navigator.clipboard.writeText with a fallback to document.execCommand('copy')
 * for environments where navigator.clipboard might be unavailable or restricted.
 *
 * @param text The text string to copy to the clipboard.
 * @returns Promise<boolean> True if copied successfully, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string' || text.length === 0) {
    return false;
  }

  // 1. Try modern navigator.clipboard API if available
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting fallback:', err);
    }
  }

  // 2. Fallback to hidden textarea with document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Prevent scrolling and keep invisible
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        return true;
      }
    } catch (fallbackErr) {
      console.warn('document.execCommand fallback copy failed:', fallbackErr);
    }
  }

  return false;
}
