/**
 * Generates a clean unified diff between oldText and newText for display in diff preview cards.
 */
export function generateUnifiedDiff(filePath: string, oldText: string, newText: string): string {
  if (oldText === newText) {
    return 'No changes.';
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Find common prefix
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }

  // Find common suffix
  let oldSuffix = oldLines.length - 1;
  let newSuffix = newLines.length - 1;
  while (
    oldSuffix >= prefix &&
    newSuffix >= prefix &&
    oldLines[oldSuffix] === newLines[newSuffix]
  ) {
    oldSuffix--;
    newSuffix--;
  }

  const diffLines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  // 1-line context before
  if (prefix > 0) {
    diffLines.push(`  ${oldLines[prefix - 1]}`);
  }

  // Deletions
  for (let i = prefix; i <= oldSuffix; i++) {
    diffLines.push(`- ${oldLines[i]}`);
  }

  // Additions
  for (let i = prefix; i <= newSuffix; i++) {
    diffLines.push(`+ ${newLines[i]}`);
  }

  // 1-line context after
  if (oldSuffix + 1 < oldLines.length) {
    diffLines.push(`  ${oldLines[oldSuffix + 1]}`);
  }

  return diffLines.join('\n');
}
