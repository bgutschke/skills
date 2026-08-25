const DETAILS_BLOCK_PATTERN = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
const SUMMARY_DEPENDENCY_NAME_PATTERN = /\(([^()]+)\)\s*$/;
const VERSION_HEADING_LINE_PATTERN = /^#{1,6}\s*\[?`?v?\d+\.\d+/i;
const COMPARE_SOURCE_LINE_PATTERN = /^\[compare source\]\(.*\)$/i;

function summaryNamesDependency(summary, dependencyName) {
  const match = SUMMARY_DEPENDENCY_NAME_PATTERN.exec(summary.trim());
  if (!match) return summary.toLowerCase().includes(dependencyName.toLowerCase());
  return match[1].toLowerCase() === dependencyName.toLowerCase();
}

function extractReleaseNotesFromPrBody(prBody, dependencyName) {
  DETAILS_BLOCK_PATTERN.lastIndex = 0;
  let match;
  while ((match = DETAILS_BLOCK_PATTERN.exec(prBody)) !== null) {
    const [, summary, body] = match;
    if (!summaryNamesDependency(summary, dependencyName)) continue;
    const text = body.trim();
    const remainder = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !VERSION_HEADING_LINE_PATTERN.test(line) && !COMPARE_SOURCE_LINE_PATTERN.test(line));
    if (remainder.length === 0) return { status: 'compare-link-only' };
    return { status: 'found', text };
  }
  return { status: 'absent' };
}

module.exports = { extractReleaseNotesFromPrBody };
