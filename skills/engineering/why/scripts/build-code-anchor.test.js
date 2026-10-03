const { buildCodeAnchor } = require('./build-code-anchor');

/**
 * Renders one commit the way `git log --follow --name-status` prints it with
 * the wrapper's own format string.
 */
function logRecord({ hash, date = '2026-01-01T10:00:00+00:00', subject, body = '', changes = [['M', 'src/limits.js']] }) {
  const status = changes.map((change) => change.join('\t')).join('\n');
  return `\x1e${hash}\x1f${date}\x1f${subject}\x1f${body}\x1f\n\n${status}\n`;
}

/**
 * Renders blamed lines the way `git blame --porcelain` prints them: the full
 * header only at the first line a commit owns, the bare hash line after that.
 */
function blamePorcelain(lines) {
  const seen = new Set();
  return lines
    .map(({ hash, line, time = 1767261600, summary = 'some change', content }) => {
      const header = [`${hash} ${line} ${line} 1`];
      if (!seen.has(hash)) {
        seen.add(hash);
        header.push('author Ada', `author-time ${time}`, 'author-tz +0000', `summary ${summary}`, 'filename src/limits.js');
      }
      return `${header.join('\n')}\n\t${content}\n`;
    })
    .join('');
}

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);

describe('buildCodeAnchor', () => {
  it('returns an empty anchor for empty input', () => {
    expect(buildCodeAnchor({})).toEqual({
      paths: [],
      lines: null,
      commits: [],
      pullRequests: [],
      blamedPullRequests: [],
      tickets: [],
      symbols: [],
    });
  });

  it('takes the pull request number from a squash-merged commit subject', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix(limits): clamp page size to 100 (#42)' });

    const anchor = buildCodeAnchor({ log });

    expect(anchor.pullRequests).toEqual([42]);
    expect(anchor.commits).toEqual([
      { hash: 'a1', date: '2026-01-01T10:00:00+00:00', subject: 'fix(limits): clamp page size to 100 (#42)', blamed: false },
    ]);
  });

  it('takes the pull request number from a merge commit subject', () => {
    const log = logRecord({ hash: 'a1', subject: 'Merge pull request #57 from acme/raise-limit' });

    expect(buildCodeAnchor({ log }).pullRequests).toEqual([57]);
  });

  it('does not read an issue reference in a subject as a pull request', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix #12: clamp page size' });

    expect(buildCodeAnchor({ log }).pullRequests).toEqual([]);
  });

  it('reports no pull request for a commit subject without a number', () => {
    const log = logRecord({ hash: 'a1', subject: 'chore: tidy limits' });

    const anchor = buildCodeAnchor({ log });

    expect(anchor.pullRequests).toEqual([]);
    expect(anchor.commits.map((commit) => commit.hash)).toEqual(['a1']);
  });

  it('keeps the commits from before a rename and lists every name the file had', () => {
    const log =
      logRecord({ hash: 'c3', subject: 'fix: raise limit (#9)', changes: [['M', 'src/limits.js']] }) +
      logRecord({ hash: 'b2', subject: 'refactor: move limits', changes: [['R100', 'lib/paging.js', 'src/limits.js']] }) +
      logRecord({ hash: 'a1', subject: 'feat: add paging (#3)', changes: [['A', 'lib/paging.js']] });

    const anchor = buildCodeAnchor({ log });

    expect(anchor.commits.map((commit) => commit.hash)).toEqual(['c3', 'b2', 'a1']);
    expect(anchor.pullRequests).toEqual([9, 3]);
    expect(anchor.paths).toEqual(['src/limits.js', 'lib/paging.js']);
  });

  it('takes a ticket identifier from a commit subject', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix(limits): PAY-118 clamp page size' });

    expect(buildCodeAnchor({ log }).tickets).toEqual(['PAY-118']);
  });

  it('takes a ticket identifier that appears only in a pull request body', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix(limits): clamp page size (#42)' });
    const pullRequestBodies = [{ number: 42, body: 'The upstream API rejects pages over 100.\n\nCloses PAY-118.' }];

    expect(buildCodeAnchor({ log, pullRequestBodies }).tickets).toEqual(['PAY-118']);
  });

  it('takes a ticket identifier from a commit body, listing each ticket once', () => {
    const log =
      logRecord({ hash: 'b2', subject: 'fix: PAY-118 follow-up', body: 'Refs PAY-118 and OPS-7.' }) +
      logRecord({ hash: 'a1', subject: 'fix: clamp page size', body: 'See PAY-118.' });

    expect(buildCodeAnchor({ log }).tickets).toEqual(['PAY-118', 'OPS-7']);
  });

  it('does not read a standard or algorithm name as a ticket identifier', () => {
    const log = logRecord({
      hash: 'a1',
      subject: 'fix: PAY-118 hash with SHA-256',
      body: 'Encode as UTF-8 over TLS-1.3, per ECMA-262. Patches CVE-2021-44228.',
    });

    expect(buildCodeAnchor({ log }).tickets).toEqual(['PAY-118']);
  });

  it('keeps a ticket whose project key is also a common acronym', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix: RFC-42 and ISO-7 date parsing' });

    expect(buildCodeAnchor({ log }).tickets).toEqual(['RFC-42', 'ISO-7']);
  });

  it('lists each commit of a blame range once, even when it owns several lines', () => {
    const blame = blamePorcelain([
      { hash: HASH_B, line: 10, time: 1767348000, summary: 'fix: clamp page size (#42)', content: 'const MAX_PAGE = 100;' },
      { hash: HASH_A, line: 11, time: 1767261600, summary: 'feat: add paging', content: 'function clampPage(size) {' },
      { hash: HASH_B, line: 12, time: 1767348000, summary: 'fix: clamp page size (#42)', content: '  return Math.min(size, MAX_PAGE);' },
    ]);

    const anchor = buildCodeAnchor({ blame, lines: { start: 10, end: 12 } });

    expect(anchor.lines).toEqual({ start: 10, end: 12 });
    expect(anchor.commits).toEqual([
      { hash: HASH_B, date: '2026-01-02T10:00:00.000Z', subject: 'fix: clamp page size (#42)', blamed: true },
      { hash: HASH_A, date: '2026-01-01T10:00:00.000Z', subject: 'feat: add paging', blamed: true },
    ]);
    expect(anchor.pullRequests).toEqual([42]);
  });

  it('marks a commit that appears in both the log and the blame once, as blamed', () => {
    const log =
      logRecord({ hash: HASH_B, date: '2026-01-02T11:00:00+01:00', subject: 'fix: clamp page size (#42)' }) +
      logRecord({ hash: HASH_A, date: '2026-01-01T11:00:00+01:00', subject: 'feat: add paging' });
    const blame = blamePorcelain([{ hash: HASH_B, line: 10, summary: 'fix: clamp page size (#42)', content: 'const MAX_PAGE = 100;' }]);

    const anchor = buildCodeAnchor({ log, blame });

    expect(anchor.commits).toEqual([
      { hash: HASH_B, date: '2026-01-02T11:00:00+01:00', subject: 'fix: clamp page size (#42)', blamed: true },
      { hash: HASH_A, date: '2026-01-01T11:00:00+01:00', subject: 'feat: add paging', blamed: false },
    ]);
  });

  it('lists apart the pull requests of the commits that own the target lines', () => {
    const log =
      logRecord({ hash: HASH_B, date: '2026-01-02T11:00:00+01:00', subject: 'fix: clamp page size (#42)' }) +
      logRecord({ hash: HASH_A, date: '2026-01-01T11:00:00+01:00', subject: 'feat: add paging (#7)' });
    const blame = blamePorcelain([{ hash: HASH_B, line: 10, summary: 'fix: clamp page size (#42)', content: 'const MAX_PAGE = 100;' }]);

    const anchor = buildCodeAnchor({ log, blame });

    expect(anchor.pullRequests).toEqual([42, 7]);
    expect(anchor.blamedPullRequests).toEqual([42]);
  });

  it('leaves uncommitted lines out of the commit list', () => {
    const blame = blamePorcelain([
      { hash: '0'.repeat(40), line: 10, summary: 'Not Committed Yet', content: 'const MAX_PAGE = 200;' },
      { hash: HASH_A, line: 11, summary: 'feat: add paging', content: 'function clampPage(size) {' },
    ]);

    expect(buildCodeAnchor({ blame }).commits.map((commit) => commit.hash)).toEqual([HASH_A]);
  });

  it('names the symbols the blamed lines declare, uncommitted lines included', () => {
    const blame = blamePorcelain([
      { hash: '0'.repeat(40), line: 10, summary: 'Not Committed Yet', content: 'export const MAX_PAGE = 100;' },
      { hash: HASH_A, line: 11, content: 'export function clampPage(size) {' },
      { hash: HASH_A, line: 12, content: '  return Math.min(size, MAX_PAGE);' },
      { hash: HASH_A, line: 13, content: '}' },
      { hash: HASH_A, line: 14, content: 'class PageCursor {}' },
      { hash: HASH_A, line: 15, content: 'def retry_upload(attempts):' },
    ]);

    expect(buildCodeAnchor({ blame }).symbols).toEqual(['MAX_PAGE', 'clampPage', 'PageCursor', 'retry_upload']);
  });
});
