#!/usr/bin/env node
// @ts-check
const { execFileSync } = require('child_process');
const { LOG_FORMAT, buildCodeAnchor, findPullRequests } = require('./build-code-anchor');

const USAGE = 'Usage: gather-anchor-cli.js <path> [--lines <start>,<end>]';
const LINES_RE = /^(\d+),(\d+)$/;

/**
 * @param {string[]} argv
 * @returns {{ path: string, lines: import('./build-code-anchor').LineRange | null }}
 */
function parseArgs(argv) {
  /** @type {string | null} */
  let path = null;
  /** @type {import('./build-code-anchor').LineRange | null} */
  let lines = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--lines') {
      lines = parseLines(argv[i + 1] ?? '');
      i += 1;
    } else {
      path = argv[i];
    }
  }
  if (path === null) throw new Error(USAGE);
  return { path, lines };
}

/**
 * @param {string} raw
 * @returns {import('./build-code-anchor').LineRange}
 */
function parseLines(raw) {
  const match = raw.match(LINES_RE);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > Number(match[2])) {
    throw new Error(`--lines must be <start>,<end> with 1 <= start <= end, got "${raw}".`);
  }
  return { start: Number(match[1]), end: Number(match[2]) };
}

/**
 * @param {string} path
 * @returns {string}
 */
function readLog(path) {
  return execFileSync('git', ['log', '--follow', '--name-status', `--format=${LOG_FORMAT}`, '--', path], {
    encoding: 'utf8',
  });
}

/**
 * Reads the porcelain blame of the target. Returns an empty string for a
 * path git cannot blame, for example a file deleted from the working tree,
 * so its history still yields an anchor from the log alone.
 *
 * @param {string} path
 * @param {import('./build-code-anchor').LineRange | null} lines
 * @returns {string}
 */
function readBlame(path, lines) {
  const range = lines ? ['-L', `${lines.start},${lines.end}`] : [];
  try {
    return execFileSync('git', ['blame', '--porcelain', ...range, '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

/**
 * Checks whether `gh` is both installed and authenticated. A missing binary
 * and an unauthenticated one both throw, so both fall back to the same
 * commit-only anchor.
 *
 * @returns {boolean}
 */
function isGhAuthenticated() {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads one pull request body. Returns null on any failure, for example a
 * `#123` in a subject that names an issue, not a pull request, so one bad
 * lookup never fails the whole anchor.
 *
 * @param {number} number
 * @returns {import('./build-code-anchor').PullRequestBody | null}
 */
function readPullRequestBody(number) {
  try {
    const body = execFileSync('gh', ['pr', 'view', String(number), '--json', 'body', '--jq', '.body'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { number, body };
  } catch {
    return null;
  }
}

if (process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const { path, lines } = parseArgs(process.argv.slice(2));
  const log = readLog(path);
  const blame = readBlame(path, lines);
  const ghAuthenticated = isGhAuthenticated();
  const pullRequestBodies = ghAuthenticated
    ? findPullRequests(log, blame).map(readPullRequestBody).filter((pull) => pull !== null)
    : [];
  const anchor = buildCodeAnchor({ log, blame, lines, pullRequestBodies });
  console.log(JSON.stringify({ anchor, ghAuthenticated }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
