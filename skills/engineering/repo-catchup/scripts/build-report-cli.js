#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const { buildReport } = require('./build-report');
const { readCodeownersContent } = require('./read-codeowners');

/**
 * @param {string} path
 * @returns {string | null}
 */
function readFileOrNull(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

const stdin = fs.readFileSync(0, 'utf8');
if (!stdin.trim()) {
  // Empty stdin means the upstream gather-commits-cli.js already reported the
  // real problem to stderr and exited non-zero. Stay silent instead of piling
  // on a confusing "Unexpected end of JSON input" line of our own.
  process.exit(1);
}

try {
  const input = JSON.parse(stdin);
  const codeownersContent = readCodeownersContent(readFileOrNull);
  const { rows, summary } = buildReport(input.commits, codeownersContent, input.hostInfo ?? null);
  console.log(JSON.stringify({ range: input.range, rows, summary }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
