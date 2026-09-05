#!/usr/bin/env node
// @ts-check
const { execFileSync } = require('child_process');
const { resolveBoundary, toDateString, shiftDateString } = require('./resolve-boundary');
const { parseGitHubRemote, pickMergedPullRequest, enrichWithPullRequests } = require('./github-enrich');

const USAGE =
  'Usage: gather-commits-cli.js [--from <date|phrase|ref>] [--to <date|phrase|ref>]';
const DEFAULT_WINDOW_DAYS = 7;
const UNIT_SEPARATOR = '\x1f';

/**
 * @param {string[]} argv
 * @returns {{ from: string | null, to: string | null }}
 */
function parseArgs(argv) {
  let from = null;
  let to = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--from') {
      from = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--to') {
      to = argv[i + 1];
      i += 1;
    }
  }
  return { from, to };
}

/**
 * Resolves a git tag or branch name to the date of the commit it points at.
 * Returns null when the name is not a resolvable ref, so the caller can
 * report the value as unrecognized instead of a confusing git error.
 *
 * @param {string} ref
 * @returns {string | null}
 */
function resolveGitRefDate(ref) {
  try {
    const isoDate = execFileSync('git', ['log', '-1', '--format=%aI', ref, '--'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return isoDate ? isoDate.slice(0, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the effective `from`/`to` range from whatever the caller gave,
 * each side independently accepting an absolute date, a relative phrase, or
 * a git tag/branch name. A missing boundary is filled relative to the one
 * given, or to today, so the default window is always exactly seven days
 * wide: one work week, the most common gap between catch-up requests.
 *
 * @param {string | null} from
 * @param {string | null} to
 * @returns {{ from: string, to: string }}
 */
function resolveRange(from, to) {
  const today = toDateString(new Date());
  const resolvedFromRaw = from === null ? null : resolveBoundary('--from', from, today, resolveGitRefDate);
  const resolvedToRaw = to === null ? null : resolveBoundary('--to', to, today, resolveGitRefDate);

  const resolvedTo = resolvedToRaw ?? (resolvedFromRaw ? shiftDateString(resolvedFromRaw, DEFAULT_WINDOW_DAYS) : today);
  const resolvedFrom = resolvedFromRaw ?? shiftDateString(resolvedTo, -DEFAULT_WINDOW_DAYS);

  if (resolvedFrom > resolvedTo) {
    throw new Error(`--from (${resolvedFrom}) must not be later than --to (${resolvedTo}).`);
  }

  return { from: resolvedFrom, to: resolvedTo };
}

/**
 * @param {string} hash
 * @returns {import('./build-report').CommitRecord}
 */
function readCommit(hash) {
  const format = `%an${UNIT_SEPARATOR}%aI${UNIT_SEPARATOR}%P${UNIT_SEPARATOR}%s${UNIT_SEPARATOR}%b`;
  // Strip only the one trailing newline `git show` itself appends, never `.trim()`
  // the whole block: %b is the last field, and a wider trim would eat blank lines
  // that are part of the commit body's own text.
  const fields = execFileSync('git', ['show', '-s', `--format=${format}`, hash], {
    encoding: 'utf8',
  }).replace(/\n$/, '');
  const [authorName, date, parents, message, body] = fields.split(UNIT_SEPARATOR);
  const files = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', hash], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  return {
    hash,
    authorName,
    date,
    message,
    body: body ?? '',
    isMerge: parents.trim().split(/\s+/).filter(Boolean).length > 1,
    files,
  };
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {import('./build-report').CommitRecord[]}
 */
function gatherCommits(from, to) {
  const hashes = execFileSync('git', ['log', `--since=${from} 00:00:00`, `--until=${to} 23:59:59`, '--format=%H'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  return hashes.map(readCommit);
}

/**
 * Checks whether `gh` is both installed and authenticated. Enrichment needs
 * both, and this single check covers each failure the same way: a missing
 * binary and an unauthenticated one both throw, so both fall back to the
 * same commit-only report.
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
 * Detects this repository's GitHub owner/repo pair from its `origin`
 * remote. Returns null for a missing remote or a non-GitHub host, so the
 * caller renders a plain hash instead of a link.
 *
 * @returns {import('./build-report').HostInfo | null}
 */
function detectGitHubHostInfo() {
  try {
    const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
    const remote = parseGitHubRemote(remoteUrl);
    return remote ? { isGitHub: true, owner: remote.owner, repo: remote.repo } : null;
  } catch {
    return null;
  }
}

/**
 * Looks up the merged pull request, if any, that brought one commit to the
 * default branch. Returns null on any failure, for example a rate limit or
 * a commit `gh` cannot find, so one bad lookup never fails the whole report.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} hash
 * @returns {import('./build-report').PullRequestInfo | null}
 */
function findMergedPullRequest(owner, repo, hash) {
  try {
    const output = execFileSync('gh', ['api', `repos/${owner}/${repo}/commits/${hash}/pulls`], { encoding: 'utf8' });
    return pickMergedPullRequest(JSON.parse(output));
  } catch {
    return null;
  }
}

if (process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const { from: rawFrom, to: rawTo } = parseArgs(process.argv.slice(2));
  const range = resolveRange(rawFrom, rawTo);
  const rawCommits = gatherCommits(range.from, range.to);
  const hostInfo = isGhAuthenticated() ? detectGitHubHostInfo() : null;
  const commits = enrichWithPullRequests(rawCommits, hostInfo, findMergedPullRequest);
  console.log(JSON.stringify({ range, commits, hostInfo }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
