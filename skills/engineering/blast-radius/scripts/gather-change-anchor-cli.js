#!/usr/bin/env node
// @ts-check
const { execFileSync } = require('child_process');
const { LOG_FORMAT } = require('./build-code-anchor');
const { buildChangeAnchor } = require('./build-change-anchor');

const USAGE = 'Usage: gather-change-anchor-cli.js';
const DEFAULT_BRANCH_CANDIDATES = ['origin/main', 'origin/master', 'main', 'master'];
const MAX_BUFFER = 256 * 1024 * 1024;

/**
 * Runs git and returns its stdout. The buffer is raised far above the
 * 1 MB default, because a branch diff has no size limit.
 *
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Finds the repository's default branch: the remote's own HEAD when it is
 * set, otherwise the first common default branch name that exists.
 *
 * @returns {string}
 */
function findDefaultBranch() {
  try {
    return git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).trim();
  } catch {
    const found = DEFAULT_BRANCH_CANDIDATES.find((ref) => {
      try {
        git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
        return true;
      } catch {
        return false;
      }
    });
    if (found === undefined) throw new Error(`No default branch found. Tried origin/HEAD, ${DEFAULT_BRANCH_CANDIDATES.join(', ')}.`);
    return found;
  }
}

/**
 * Reads the diff from the base to the working tree, untracked files
 * included. `git diff` leaves untracked files out, so each one is diffed
 * against an empty file, which needs no change to the index.
 *
 * @param {string} base
 * @returns {string}
 */
function readDiff(base) {
  const tracked = git(['diff', '--no-color', '--no-ext-diff', base]);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  return tracked + untracked.map(readUntrackedDiff).join('');
}

/**
 * `git diff --no-index` exits with 1 when the files differ, which is always
 * the case here, so the diff is read from the error's stdout.
 *
 * @param {string} path
 * @returns {string}
 */
function readUntrackedDiff(path) {
  try {
    return git(['diff', '--no-color', '--no-ext-diff', '--no-index', '--', '/dev/null', path]);
  } catch (error) {
    const stdout = /** @type {{ stdout?: unknown }} */ (error).stdout;
    if (typeof stdout === 'string' && stdout !== '') return stdout;
    throw error;
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
 * Reads the body and the review bodies of the current branch's pull
 * request as one text, because a ticket identifier can sit in either.
 * Returns null when the branch has no pull request, so one failed lookup
 * never fails the whole anchor.
 *
 * @returns {import('./build-code-anchor').PullRequestBody | null}
 */
function readBranchPullRequest() {
  try {
    const raw = execFileSync('gh', ['pr', 'view', '--json', 'number,body,reviews'], {
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    /** @type {{ number: number, body: string, reviews: { body: string }[] }} */
    const pull = JSON.parse(raw);
    return { number: pull.number, body: [pull.body, ...pull.reviews.map((review) => review.body)].join('\n\n') };
  } catch {
    return null;
  }
}

if (process.argv.length > 2) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const defaultBranch = findDefaultBranch();
  const base = git(['merge-base', defaultBranch, 'HEAD']).trim();
  const log = git(['log', '--name-status', `--format=${LOG_FORMAT}`, `${base}..HEAD`]);
  const diff = readDiff(base);
  const ghAuthenticated = isGhAuthenticated();
  const pullRequest = ghAuthenticated ? readBranchPullRequest() : null;
  const anchor = buildChangeAnchor({ log, diff, pullRequestBodies: pullRequest ? [pullRequest] : [] });
  console.log(JSON.stringify({ anchor, base: { ref: defaultBranch, commit: base }, ghAuthenticated }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
