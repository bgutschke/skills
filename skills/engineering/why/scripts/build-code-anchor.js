// @ts-check

const RECORD_SEPARATOR = '\x1e';
const FIELD_SEPARATOR = '\x1f';
const LOG_FORMAT = '%x1e%H%x1f%aI%x1f%s%x1f%b%x1f';
const PULL_REQUEST_RE = /\(#(\d+)\)|^Merge pull request #(\d+)\b/g;
const TICKET_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const BLAME_HEADER_RE = /^([0-9a-f]{40}) \d+ \d+/;
const UNCOMMITTED_HASH = '0'.repeat(40);
const DECLARATION_RE = /\b(?:function|class|const|let|var|def|func|fn|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;

/**
 * @typedef {{ start: number, end: number }} LineRange
 *
 * @typedef {{ hash: string, date: string, subject: string, blamed: boolean }} AnchorCommit
 *
 * @typedef {{
 *   paths: string[],
 *   lines: LineRange | null,
 *   commits: AnchorCommit[],
 *   pullRequests: number[],
 *   tickets: string[],
 *   symbols: string[],
 * }} CodeAnchor
 *
 * @typedef {{ hash: string, date: string, subject: string, body: string, paths: string[] }} LogCommit
 *
 * @typedef {{ hash: string, date: string, subject: string }} BlameCommit
 *
 * @typedef {{ number: number, body: string }} PullRequestBody
 */

/**
 * Turns raw `git log --follow`, `git blame --porcelain`, and pull request
 * text into the code anchor a `why` run starts from. Every input is
 * optional, so a missing source, for example no `gh`, yields a smaller
 * anchor and never an error.
 *
 * @param {{
 *   log?: string,
 *   blame?: string,
 *   lines?: LineRange | null,
 *   pullRequestBodies?: PullRequestBody[],
 * }} input
 * @returns {CodeAnchor}
 */
function buildCodeAnchor({ log = '', blame = '', lines = null, pullRequestBodies = [] }) {
  const logCommits = parseLog(log);
  const blameCommits = parseBlame(blame);
  const commits = mergeCommits(logCommits, blameCommits);
  const ticketSources = [
    ...commits.map(({ subject }) => subject),
    ...logCommits.map(({ body }) => body),
    ...pullRequestBodies.map(({ body }) => body),
  ];

  return {
    paths: unique(logCommits.flatMap((commit) => commit.paths)),
    lines,
    commits,
    pullRequests: unique(commits.flatMap(({ subject }) => findPullRequestNumbers(subject))),
    tickets: unique(ticketSources.flatMap(findTickets)),
    symbols: unique(findDeclaredSymbols(blame)),
  };
}

/**
 * @param {string} log
 * @returns {LogCommit[]}
 */
function parseLog(log) {
  return log
    .split(RECORD_SEPARATOR)
    .filter((record) => record.trim())
    .map((record) => {
      const [hash, date, subject, body, nameStatus = ''] = record.split(FIELD_SEPARATOR);
      return { hash, date, subject, body, paths: parseNameStatus(nameStatus) };
    });
}

/**
 * Reads the file names one commit touched, newest name first. A rename line
 * carries the old and the new name, and both belong to the target's history.
 *
 * @param {string} nameStatus
 * @returns {string[]}
 */
function parseNameStatus(nameStatus) {
  return nameStatus
    .split('\n')
    .filter((line) => line.includes('\t'))
    .flatMap((line) => line.split('\t').slice(1).reverse());
}

/**
 * Groups porcelain blame output by commit, in order of first appearance.
 * Porcelain prints a commit's metadata only at the first line it owns, so
 * the metadata is read once and every later line is attached by hash.
 *
 * @param {string} blame
 * @returns {BlameCommit[]}
 */
function parseBlame(blame) {
  /** @type {Map<string, BlameCommit>} */
  const commits = new Map();
  /** @type {BlameCommit | undefined} */
  let current;

  for (const line of blame.split('\n')) {
    const header = line.match(BLAME_HEADER_RE);
    if (header) {
      const hash = header[1];
      current = commits.get(hash) ?? { hash, date: '', subject: '' };
      commits.set(hash, current);
    } else if (current && line.startsWith('author-time ')) {
      current.date = new Date(Number(line.slice('author-time '.length)) * 1000).toISOString();
    } else if (current && line.startsWith('summary ')) {
      current.subject = line.slice('summary '.length);
    }
  }

  commits.delete(UNCOMMITTED_HASH);
  return [...commits.values()];
}

/**
 * Joins the log and the blame into one commit list, each commit once,
 * newest first. A commit in both keeps its log metadata, because the log
 * date carries the author's own time zone, and is marked as blamed.
 *
 * @param {LogCommit[]} logCommits
 * @param {BlameCommit[]} blameCommits
 * @returns {AnchorCommit[]}
 */
function mergeCommits(logCommits, blameCommits) {
  const blamedHashes = new Set(blameCommits.map(({ hash }) => hash));
  const loggedHashes = new Set(logCommits.map(({ hash }) => hash));

  return [
    ...logCommits.map(({ hash, date, subject }) => ({ hash, date, subject, blamed: blamedHashes.has(hash) })),
    ...blameCommits
      .filter(({ hash }) => !loggedHashes.has(hash))
      .map(({ hash, date, subject }) => ({ hash, date, subject, blamed: true })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/**
 * Reads the pull request number from the two subject shapes GitHub writes
 * itself: a squash merge's trailing `(#N)` and a merge commit's
 * `Merge pull request #N`. A bare `#N` elsewhere in a subject is usually an
 * issue reference, so it does not count.
 *
 * @param {string} subject
 * @returns {number[]}
 */
function findPullRequestNumbers(subject) {
  return [...subject.matchAll(PULL_REQUEST_RE)].map((match) => Number(match[1] ?? match[2]));
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function findTickets(text) {
  return [...text.matchAll(TICKET_RE)].map((match) => match[0]);
}

/**
 * Names the symbols the blamed lines declare. This reads every line of the
 * range, uncommitted ones too, because the symbols describe the code as it
 * stands, not the history behind it.
 *
 * @param {string} blame
 * @returns {string[]}
 */
function findDeclaredSymbols(blame) {
  return blame
    .split('\n')
    .filter((line) => line.startsWith('\t'))
    .flatMap((line) => [...line.matchAll(DECLARATION_RE)].map((match) => match[1]));
}

/**
 * @template T
 * @param {T[]} values
 * @returns {T[]}
 */
function unique(values) {
  return [...new Set(values)];
}

module.exports = { LOG_FORMAT, buildCodeAnchor };
