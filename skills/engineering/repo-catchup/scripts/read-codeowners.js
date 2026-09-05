// @ts-check

const CODEOWNERS_LOCATIONS = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'];

/**
 * Reads a repository's CODEOWNERS content from the first of the three
 * locations GitHub itself recognizes, checked in that same priority order.
 * Returns null when none of them exist, so the caller falls back to
 * per-author attribution.
 *
 * @param {(path: string) => string | null} readFile
 * @returns {string | null}
 */
function readCodeownersContent(readFile) {
  for (const location of CODEOWNERS_LOCATIONS) {
    const content = readFile(location);
    if (content !== null) return content;
  }
  return null;
}

module.exports = { readCodeownersContent };
