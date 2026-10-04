#!/usr/bin/env node
// @ts-check
const { execFileSync } = require('child_process');
const { LOG_FORMAT } = require('./build-code-anchor');
const { buildChangeAnchor } = require('./build-change-anchor');
const { parseChangeTarget } = require('./parse-change-target');

const USAGE = 'Usage: gather-change-anchor-cli.js [<pull request number or URL> | <from>..<to> | <from>...<to>]';
const PULL_REQUEST_FIELDS = 'number,body,reviews,baseRefName,baseRefOid,headRefName,headRefOid';
const DEFAULT_BRANCH_CANDIDATES = ['origin/main', 'origin/master', 'main', 'master'];
const MAX_BUFFER = 256 * 1024 * 1024;

if (process.argv.length > 3 || process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const target = parseChangeTarget(process.argv[2]);
  const ghAuthenticated = target.kind === 'range' ? null : isGhAuthenticated();
  const { base, head, log, diff, pullRequestBodies } = readChange(target, ghAuthenticated);
  const anchor = buildChangeAnchor({ log, diff, pullRequestBodies });
  console.log(JSON.stringify({ target, anchor, base, head, ghAuthenticated }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

/**
 * @typedef {{ ref: string, commit: string }} RefPoint
 *
 * @typedef {{
 *   base: RefPoint,
 *   head: RefPoint | null,
 *   log: string,
 *   diff: string,
 *   pullRequestBodies: import('./build-code-anchor').PullRequestBody[],
 * }} Change
 */


/**
 * Reads the change the target names. `head` is null when the change ends
 * in the working tree, which only the branch target does. A pull request
 * without `gh` stops, because no other change can stand in for it.
 *
 * @param {import('./parse-change-target').ChangeTarget} target
 * @param {boolean | null} ghAuthenticated
 * @returns {Change}
 */
function readChange(target, ghAuthenticated) {
  if (target.kind === 'range') return readRange(target);
  if (target.kind === 'branch') return readBranch(ghAuthenticated);
  if (!ghAuthenticated) {
    throw new Error(`gh is missing or not authenticated, so pull request ${target.pullRequest} cannot be read. Run "gh auth login", or pass the pull request's ref range, for example main...feature.`);
  }
  return readPullRequest(target.pullRequest);
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
 * Reads the current branch from its merge base with the default branch to
 * the working tree, and the body of the branch's own pull request.
 *
 * @param {boolean | null} ghAuthenticated
 * @returns {Change}
 */
function readBranch(ghAuthenticated) {
  const defaultBranch = findDefaultBranch();
  const base = git(['merge-base', defaultBranch, 'HEAD']).trim();
  const pullRequest = ghAuthenticated ? readBranchPullRequest() : null;
  return {
    base: { ref: defaultBranch, commit: base },
    head: null,
    log: readLog(base, 'HEAD'),
    diff: readWorkingTreeDiff(base),
    pullRequestBodies: pullRequest ? [pullRequest] : [],
  };
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
function readWorkingTreeDiff(base) {
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
 * Reads the body and the review bodies of the current branch's pull
 * request. Returns null when the branch has no pull request, so one failed lookup
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
    return { number: pull.number, body: joinPullRequestText(pull) };
  } catch {
    return null;
  }
}


/**
 * Joins a pull request body and its review bodies into one text, because a
 * ticket identifier can sit in either.
 *
 * @param {{ body: string, reviews: { body: string }[] }} pull
 * @returns {string}
 */
function joinPullRequestText({ body, reviews }) {
  return [body, ...reviews.map((review) => review.body)].join('\n\n');
}

/**
 * Reads the commits of a ref range. Two dots start at the first ref, three
 * dots at the merge base of both, which is the same split `git diff` makes.
 *
 * @param {{ from: string, to: string, mergeBase: boolean }} range
 * @returns {Change}
 */
function readRange({ from, to, mergeBase }) {
  const head = resolveCommit(to);
  const base = mergeBase ? git(['merge-base', resolveCommit(from), head]).trim() : resolveCommit(from);
  return readCommits({ ref: from, commit: base }, { ref: to, commit: head }, []);
}

/**
 * @param {string} ref
 * @returns {string}
 */
function resolveCommit(ref) {
  try {
    return git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`"${ref}" is not a commit in this repository.`);
  }
}


/**
 * Reads a pull request from its merge base to its head commit, with its
 * body and review bodies. GitHub freezes the base commit of a merged or
 * closed pull request, so the merge base stays the one the pull request
 * was reviewed against.
 *
 * @param {string} pullRequest
 * @returns {Change}
 */
function readPullRequest(pullRequest) {
  /** @type {{ number: number, body: string, reviews: { body: string }[], baseRefName: string, baseRefOid: string, headRefName: string, headRefOid: string }} */
  const pull = JSON.parse(
    execFileSync('gh', ['pr', 'view', pullRequest, '--json', PULL_REQUEST_FIELDS], { encoding: 'utf8', maxBuffer: MAX_BUFFER }),
  );
  fetchMissingCommits([pull.baseRefOid, pull.headRefOid]);
  const base = git(['merge-base', pull.baseRefOid, pull.headRefOid]).trim();
  return readCommits({ ref: pull.baseRefName, commit: base }, { ref: pull.headRefName, commit: pull.headRefOid }, [
    { number: pull.number, body: joinPullRequestText(pull) },
  ]);
}

/**
 * Fetches the commits a pull request needs that the clone lacks, for
 * example the head of a pull request from a fork. Fetching by commit name
 * writes no branch, so the user's own refs and files stay as they are.
 *
 * @param {string[]} commits
 */
function fetchMissingCommits(commits) {
  const missing = commits.filter((commit) => !hasCommit(commit));
  if (missing.length === 0) return;
  try {
    git(['fetch', '--quiet', '--no-tags', 'origin', ...missing]);
  } catch {
    throw new Error(`The commits ${missing.join(', ')} are not in this clone, and origin did not serve them. Run "git fetch origin ${missing.join(' ')}", then try again.`);
  }
}


/**
 * @param {string} commit
 * @returns {boolean}
 */
function hasCommit(commit) {
  try {
    git(['cat-file', '-e', `${commit}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}


/**
 * Reads the log and the diff between two commits, for a change that ends
 * at a commit and not in the working tree.
 *
 * @param {RefPoint} base
 * @param {RefPoint} head
 * @param {import('./build-code-anchor').PullRequestBody[]} pullRequestBodies
 * @returns {Change}
 */
function readCommits(base, head, pullRequestBodies) {
  return {
    base,
    head,
    log: readLog(base.commit, head.commit),
    diff: git(['diff', '--no-color', '--no-ext-diff', base.commit, head.commit]),
    pullRequestBodies,
  };
}

/**
 * @param {string} base
 * @param {string} head
 * @returns {string}
 */
function readLog(base, head) {
  return git(['log', '--name-status', `--format=${LOG_FORMAT}`, `${base}..${head}`]);
}


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
