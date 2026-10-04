// @ts-check
const { describe, expect, it } = require('@jest/globals');
const { buildChangeAnchor } = require('./build-change-anchor');

/**
 * Renders one file of a unified diff the way `git diff` prints it.
 *
 * @param {{ path: string, hunks: string[] }} file
 */
function diffFile({ path, hunks }) {
  return [`diff --git a/${path} b/${path}`, 'index 1111111..2222222 100644', `--- a/${path}`, `+++ b/${path}`, ...hunks].join('\n') + '\n';
}

/**
 * Renders one commit the way `git log --name-status` prints it with the
 * wrapper's own format string.
 *
 * @param {{ hash: string, date?: string, subject: string, body?: string }} commit
 */
function logRecord({ hash, date = '2026-01-01T10:00:00+00:00', subject, body = '' }) {
  return `\x1e${hash}\x1f${date}\x1f${subject}\x1f${body}\x1f\n\nM\tsrc/limits.js\n`;
}

describe('buildChangeAnchor', () => {
  it('returns an empty anchor for empty input', () => {
    expect(buildChangeAnchor({})).toEqual({
      paths: [],
      commits: [],
      pullRequests: [],
      tickets: [],
      symbols: { added: [], changed: [], deleted: [] },
    });
  });

  it('lists the commits behind the change, newest first', () => {
    const log =
      logRecord({ hash: 'b2', date: '2026-01-02T10:00:00+00:00', subject: 'fix(limits): raise the cap' }) +
      logRecord({ hash: 'a1', subject: 'feat(limits): add paging' });

    expect(buildChangeAnchor({ log }).commits).toEqual([
      { hash: 'b2', date: '2026-01-02T10:00:00+00:00', subject: 'fix(limits): raise the cap' },
      { hash: 'a1', date: '2026-01-01T10:00:00+00:00', subject: 'feat(limits): add paging' },
    ]);
  });

  it('takes the pull request number from a commit subject', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix(limits): clamp page size to 100 (#42)' });

    expect(buildChangeAnchor({ log }).pullRequests).toEqual([42]);
  });

  it('lists the pull request whose body it reads, each number once', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix(limits): clamp page size to 100 (#42)' });
    const pullRequestBodies = [
      { number: 42, body: 'Clamp the page size.' },
      { number: 51, body: 'Raise the cap.' },
    ];

    expect(buildChangeAnchor({ log, pullRequestBodies }).pullRequests).toEqual([42, 51]);
  });

  it('takes a ticket identifier from a commit subject', () => {
    const log = logRecord({ hash: 'a1', subject: 'fix(limits): PAY-118 clamp page size' });

    expect(buildChangeAnchor({ log }).tickets).toEqual(['PAY-118']);
  });

  it('takes a ticket identifier that appears only in a pull request body', () => {
    const pullRequestBodies = [{ number: 51, body: 'The upstream API rejects pages over 100.\n\nCloses PAY-118.' }];

    expect(buildChangeAnchor({ pullRequestBodies }).tickets).toEqual(['PAY-118']);
  });

  it('lists every path the diff touches, both names of a rename included', () => {
    const diff =
      diffFile({ path: 'src/limits.js', hunks: ['@@ -1,1 +1,1 @@', '-a', '+b'] }) +
      'diff --git a/lib/paging.js b/src/paging.js\nsimilarity index 100%\nrename from lib/paging.js\nrename to src/paging.js\n' +
      'diff --git a/src/old.js b/src/old.js\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/src/old.js\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-a\n';

    expect(buildChangeAnchor({ diff }).paths).toEqual(['src/limits.js', 'src/paging.js', 'lib/paging.js', 'src/old.js']);
  });

  it('lists the path of a binary or mode-only change, which has no file name lines', () => {
    const diff =
      'diff --git a/assets/logo.png b/assets/logo.png\nindex 1111111..2222222 100644\nBinary files a/assets/logo.png and b/assets/logo.png differ\n' +
      'diff --git a/bin/run me.sh b/bin/run me.sh\nold mode 100644\nnew mode 100755\n';

    expect(buildChangeAnchor({ diff }).paths).toEqual(['assets/logo.png', 'bin/run me.sh']);
  });

  it('does not read a hunk line that looks like a file header as a path', () => {
    const diff = diffFile({ path: 'db/schema.sql', hunks: ['@@ -1,2 +1,2 @@', '--- a/legacy note', '+++ b/legacy note', ' SELECT 1;'] });

    expect(buildChangeAnchor({ diff }).paths).toEqual(['db/schema.sql']);
  });

  it('lists a symbol whose declaration the diff adds', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -1,2 +1,5 @@', ' const MAX_PAGE = 100;', '+function clampPage(size) {', '+  return Math.min(size, MAX_PAGE);', '+}', ' module.exports = {};'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: ['clampPage'], changed: [], deleted: [] });
  });
  it('lists a symbol whose declaration the diff deletes', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -1,5 +1,2 @@', ' const MAX_PAGE = 100;', '-function clampPage(size) {', '-  return Math.min(size, MAX_PAGE);', '-}', ' module.exports = {};'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: [], deleted: ['clampPage'] });
  });

  it('lists a symbol as changed when the diff edits its body under the hunk header', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -10,3 +10,3 @@ function clampPage(size) {', '   const floor = 1;', '-  return Math.min(size, 100);', '+  return Math.min(size, 200);'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: ['clampPage'], deleted: [] });
  });

  it('lists a symbol as changed when the diff edits its body below a declaration in the context', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: [
        '@@ -1,6 +1,6 @@ const MAX_PAGE = 100;',
        ' function clampPage(size) {',
        '-  return Math.min(size, 100);',
        '+  return Math.min(size, MAX_PAGE);',
        ' }',
      ],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: ['clampPage'], deleted: [] });
  });

  it('lists a symbol as changed when the diff rewrites its declaration line', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -1,3 +1,3 @@', '-function clampPage(size) {', '+function clampPage(size, max = 100) {', '   return Math.min(size, max);', ' }'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: ['clampPage'], deleted: [] });
  });

  it('lists a symbol once per kind across several hunks and files', () => {
    const diff =
      diffFile({
        path: 'src/limits.js',
        hunks: [
          '@@ -10,2 +10,2 @@ function clampPage(size) {',
          '-  return Math.min(size, 100);',
          '+  return Math.min(size, 200);',
          '@@ -20,2 +20,2 @@ function clampPage(size) {',
          '-  log(size);',
          '+  log(size, 200);',
        ],
      }) +
      diffFile({
        path: 'src/cursor.js',
        hunks: ['@@ -1,0 +1,1 @@', '+export class PageCursor {}'],
      });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: ['PageCursor'], changed: ['clampPage'], deleted: [] });
  });

  it('reads a declaration nested inside a symbol as an edit of that symbol', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -1,3 +1,4 @@', ' function clampPage(size) {', '+  const ceiling = 200;', '   return Math.min(size, ceiling);', ' }'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: ['clampPage'], deleted: [] });
  });

  it('does not count an edit after the closing line of a symbol as an edit of that symbol', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -1,4 +1,4 @@', ' function clampPage(size) {', '   return Math.min(size, 100);', ' }', '-module.exports = {};', '+module.exports = { clampPage };'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: [], deleted: [] });
  });

  it('does not read a declaration keyword inside a comment as a symbol', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: ['@@ -1,1 +1,4 @@', '+/**', '+ * Wraps the function the caller passes in.', '+ */', '+// const legacyLimit = 50;', '+# def old_limit():', ' const MAX_PAGE = 100;'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: [], deleted: [] });
  });

  it('lists only the outermost declarations of a new file', () => {
    const diff = diffFile({
      path: 'src/limits.js',
      hunks: [
        '@@ -0,0 +1,9 @@',
        "+const MAX_PAGE = 100;",
        '+try {',
        '+  const raw = process.env.PAGE;',
        '+} catch {}',
        "+describe('clampPage', () => {",
        "+  it('clamps', () => {",
        '+    const size = 500;',
        '+  });',
        '+});',
      ],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: ['MAX_PAGE'], changed: [], deleted: [] });
  });

  it('does not read a local as a symbol when the hunk header names an unnamed block', () => {
    const diff = diffFile({
      path: 'src/limits.test.js',
      hunks: ["@@ -119,4 +119,4 @@ describe('clampPage', () => {", '     const log = record({', "-      body: 'old',", "+      body: 'new',", '     });'],
    });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: [], deleted: [] });
  });

  it('does not read the file header lines of a diff as code', () => {
    const diff = diffFile({ path: 'src/const MAX_PAGE.js', hunks: ['@@ -1,1 +1,1 @@', '-a', '+b'] });

    expect(buildChangeAnchor({ diff }).symbols).toEqual({ added: [], changed: [], deleted: [] });
  });
});
