// @ts-check
const { buildCodeAnchor } = require('./build-code-anchor');

// The same pattern as in build-code-anchor.js, which keeps it private so that
// the copy stays identical to the one the why skill ships.
const DECLARATION_RE = /\b(?:function|class|const|let|var|def|func|fn|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
const HUNK_HEADER_RE = /^@@ [^@]* @@ ?(.*)$/;
const HUNK_LINE_MARKERS = new Set([' ', '+', '-']);
const CLOSING_LINE_RE = /^\s*(?:[}\])]|end\b)/;
const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*|#|--)/;

/**
 * @typedef {{ added: string[], changed: string[], deleted: string[] }} SymbolChanges
 *
 * @typedef {{ hash: string, date: string, subject: string }} ChangeCommit
 *
 * @typedef {{
 *   paths: string[],
 *   commits: ChangeCommit[],
 *   pullRequests: number[],
 *   tickets: string[],
 *   symbols: SymbolChanges,
 * }} ChangeAnchor
 *
 * @typedef {{ name: string, indent: number }} Enclosing
 *
 * @typedef {{ enclosing: Enclosing | undefined, floor: number }} HunkScope
 *
 * @typedef {{ declaredAdded: Set<string>, declaredRemoved: Set<string>, edited: Set<string> }} DiffSymbols
 */

/**
 * Turns raw `git log --name-status`, `git diff`, and pull request text into
 * the code anchor a `blast-radius` run starts from: the paths and symbols
 * the change touches, the commits behind it, their pull request numbers,
 * and the ticket identifiers. Every input is optional, so a missing source,
 * for example no `gh`, yields a smaller anchor and never an error.
 *
 * The commits, pull requests, and tickets come from `buildCodeAnchor`, the
 * same function the `why` skill ships, copied into this bundle unchanged.
 *
 * @param {{
 *   log?: string,
 *   diff?: string,
 *   pullRequestBodies?: import('./build-code-anchor').PullRequestBody[],
 * }} input
 * @returns {ChangeAnchor}
 */
function buildChangeAnchor({ log = '', diff = '', pullRequestBodies = [] }) {
  const { commits, pullRequests, tickets } = buildCodeAnchor({ log, pullRequestBodies });

  return {
    paths: readDiffPaths(diff),
    commits: commits.map(({ hash, date, subject }) => ({ hash, date, subject })),
    pullRequests: [...new Set([...pullRequests, ...pullRequestBodies.map(({ number }) => number)])],
    tickets,
    symbols: classifySymbols(readDiffSymbols(diff)),
  };
}

/**
 * Lists the file names the diff touches, new name before old. A rename
 * carries both names, because callers of either can break, and a deleted
 * file keeps its old name. Names are read from the file header only, since
 * a hunk line can start with the same `--- a/` text.
 *
 * @param {string} diff
 * @returns {string[]}
 */
function readDiffPaths(diff) {
  /** @type {string[]} */
  const paths = [];
  /** @type {{ next: string | null, previous: string | null }} */
  let file = { next: null, previous: null };
  const flush = () => {
    paths.push(...[file.next, file.previous].filter((path) => path !== null));
    file = { next: null, previous: null };
  };

  let inHunk = false;

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flush();
      file.next = unchangedNameOf(line.slice('diff --git '.length));
      inHunk = false;
    } else if (inHunk || HUNK_HEADER_RE.test(line)) {
      inHunk = true;
    } else if (line.startsWith('rename to ')) {
      file.next = line.slice('rename to '.length);
    } else if (line.startsWith('rename from ')) {
      file.previous = line.slice('rename from '.length);
    } else if (line.startsWith('+++ b/')) {
      file.next = line.slice('+++ b/'.length);
    } else if (line.startsWith('--- a/')) {
      file.previous = line.slice('--- a/'.length);
    }
  }
  flush();

  return [...new Set(paths)];
}

/**
 * Reads the file name from the `a/<name> b/<name>` part of a `diff --git`
 * line. A binary or mode-only change has no `---` and `+++` lines, so this
 * line is its only name. A name can hold spaces, which makes the split
 * ambiguous, so the name counts only when both halves match exactly.
 *
 * @param {string} names
 * @returns {string | null}
 */
function unchangedNameOf(names) {
  const name = names.slice('a/'.length, (names.length - ' '.length) / 2);
  return names === `a/${name} b/${name}` ? name : null;
}

/**
 * Walks the hunks of a unified diff and collects three sets: the symbols an
 * added line declares, the symbols a removed line declares, and the symbols
 * whose body an added or removed line edits.
 *
 * The enclosing symbol of a line is the last declaration above it in the
 * hunk, or the one git names in the hunk header. Indentation decides scope:
 * a line indented deeper than the enclosing declaration is its body, so a
 * nested declaration, such as a local variable, is an edit of that body and
 * no symbol of its own. A line at the same depth or shallower ends the scope.
 * Outside any symbol, only a declaration at the shallowest depth the hunk
 * and its header reached counts, so a local inside an unnamed block, such as
 * a test callback, is no symbol either.
 *
 * @param {string} diff
 * @returns {DiffSymbols}
 */
function readDiffSymbols(diff) {
  /** @type {DiffSymbols} */
  const symbols = { declaredAdded: new Set(), declaredRemoved: new Set(), edited: new Set() };
  /** @type {HunkScope | null} */
  let scope = null;

  for (const line of diff.split('\n')) {
    const header = line.match(HUNK_HEADER_RE);
    if (header) {
      scope = { enclosing: enclosingOf(header[1]), floor: header[1] === '' ? Infinity : indentOf(header[1]) };
    } else if (line.startsWith('diff --git ')) {
      scope = null;
    } else if (scope && HUNK_LINE_MARKERS.has(line[0])) {
      readHunkLine(line[0], line.slice(1), scope, symbols);
    }
  }

  return symbols;
}

/**
 * Records one hunk line in the symbol sets and moves the hunk scope on to
 * the next line.
 *
 * @param {string} marker
 * @param {string} code
 * @param {HunkScope} scope
 * @param {DiffSymbols} symbols
 */
function readHunkLine(marker, code, scope, symbols) {
  const isEdit = marker !== ' ';
  const { enclosing } = scope;
  if (code.trim() === '') {
    if (isEdit && enclosing) symbols.edited.add(enclosing.name);
    return;
  }

  const indent = indentOf(code);
  scope.floor = Math.min(scope.floor, indent);

  if (enclosing && indent > enclosing.indent) {
    if (isEdit) symbols.edited.add(enclosing.name);
    return;
  }

  const declared = indent === scope.floor ? findDeclarations(code) : [];
  if (declared.length > 0) {
    if (marker === '+') declared.forEach((name) => symbols.declaredAdded.add(name));
    if (marker === '-') declared.forEach((name) => symbols.declaredRemoved.add(name));
    scope.enclosing = enclosingOf(code);
    return;
  }

  if (enclosing && isEdit && CLOSING_LINE_RE.test(code)) symbols.edited.add(enclosing.name);
  scope.enclosing = undefined;
}

/**
 * @param {string} text
 * @returns {Enclosing | undefined}
 */
function enclosingOf(text) {
  const name = findDeclarations(text).at(-1);
  return name === undefined ? undefined : { name, indent: indentOf(text) };
}

/**
 * @param {string} code
 * @returns {number}
 */
function indentOf(code) {
  return code.length - code.trimStart().length;
}

/**
 * Sorts the collected symbols into the three anchor lists. A symbol both
 * added and removed had its declaration line rewritten, so it counts as
 * changed, as does a symbol whose body alone was edited.
 *
 * @param {DiffSymbols} symbols
 * @returns {SymbolChanges}
 */
function classifySymbols({ declaredAdded, declaredRemoved, edited }) {
  const rewritten = [...declaredAdded].filter((name) => declaredRemoved.has(name));
  const bodyOnly = [...edited].filter((name) => !declaredAdded.has(name) && !declaredRemoved.has(name));
  return {
    added: [...declaredAdded].filter((name) => !declaredRemoved.has(name)),
    changed: [...new Set([...rewritten, ...bodyOnly])],
    deleted: [...declaredRemoved].filter((name) => !declaredAdded.has(name)),
  };
}

/**
 * Names the symbols one line of code declares. A comment line declares
 * none, even when its prose holds a keyword such as `function`.
 *
 * @param {string} text
 * @returns {string[]}
 */
function findDeclarations(text) {
  if (COMMENT_LINE_RE.test(text)) return [];
  return [...text.matchAll(DECLARATION_RE)].map((match) => match[1]);
}

module.exports = { buildChangeAnchor };
