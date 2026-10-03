// @ts-check

/** @type {{ pattern: RegExp, ruleGroup?: number }[]} */
const SUPPRESSIONS = [
  { pattern: /^eslint-(?:disable|enable)(?:-next-line|-line)?\b(.*)$/s, ruleGroup: 1 },
  { pattern: /^@ts-(?:expect-error|ignore|nocheck|check)\b/ },
  { pattern: /^(?:eslint|eslint-env|globals?|jshint|@flow|@jsx\w*)\s/ },
  { pattern: /^biome-ignore\s+(\S+)/, ruleGroup: 1 },
  { pattern: /^(?:istanbul|c8|v8)\s+ignore\b/ },
  { pattern: /^noqa\b(?::\s*(.+))?/, ruleGroup: 1 },
  { pattern: /^type:\s*ignore(?:\[(.+)\])?/, ruleGroup: 1 },
  { pattern: /^pylint:\s*disable=(.+)/, ruleGroup: 1 },
  { pattern: /^shellcheck\s+disable=(\S+)/, ruleGroup: 1 },
  { pattern: /^rubocop:(?:disable|todo)\s+(.+)/, ruleGroup: 1 },
  { pattern: /^NOLINT(?:NEXTLINE)?(?:\((.+)\))?/, ruleGroup: 1 },
];

const FORMATTER_DIRECTIVES = [
  /^prettier-ignore\b/,
  /^dprint-ignore\b/,
  /^@formatter:(?:on|off)\b/,
  /^fmt:\s*(?:on|off|skip)\b/,
  /^clang-format\s+(?:on|off)\b/,
  /^yapf:\s*(?:disable|enable)\b/,
];

const LICENSE_PATTERN = /\b(?:licen[cs]ed?|copyright|spdx-license-identifier)\b|\(c\)|©/i;

const KEYWORD_CODE_PATTERNS = [
  /^[\]})]+[;,)]*$/,
  /^(?:const|let|var)\s+[\w$[{]/,
  /^(?:import|export)\s.*(?:from\s|[{=*])/,
  /^(?:if|for|while|switch|catch)\s*\(.*\)/,
  /^(?:def|class|function|fn|func)\s+\w+.*[(:{]/,
];

const SHAPE_CODE_PATTERNS = [/[;{}]$/, /^[\w$.]+\(.*\)[;,]?$/, /^[\w$.[\]]+\s*[-+*/]?=\s*[^=\s].*$/, /=>/];

const PROSE_RUN = /\b[A-Za-z]+ [A-Za-z]+ [A-Za-z]+\b/;

/**
 * @typedef {{ extensions: string[], line: string[], block: [string, string][], doc?: string[], strings?: string[] }} SyntaxRow
 * @typedef {{ lineNo: number, text: string }} SourceLine
 * @typedef {'doc-comment' | 'license-header' | 'formatter-directive' | 'suppression' | 'commented-out-code' | 'needs-judgment'} Category
 * @typedef {{ file: string, startLine: number, endLine: number, text: string, category: Category, rule?: string | null, code?: string }} CommentRecord
 * @typedef {{ startLine: number, endLine: number, parts: string[], code: string, kind: 'line' | 'block', atTop: boolean }} RawComment
 */

/**
 * Classifies every comment on the added lines of a unified diff.
 *
 * @param {string} diff raw output of `git diff`
 * @param {SyntaxRow[]} syntaxTable
 * @returns {CommentRecord[]}
 */
function classifyDiff(diff, syntaxTable) {
  return [...addedLinesByFile(diff)].flatMap(([file, lines]) => classifyLines(file, lines, syntaxTable));
}

/**
 * Classifies every comment in the full content of one file.
 *
 * @param {string} file the file path, used for the record and the syntax lookup
 * @param {string} content
 * @param {SyntaxRow[]} syntaxTable
 * @returns {CommentRecord[]}
 */
function classifyFile(file, content, syntaxTable) {
  if (content === '') return [];
  const lines = content.split(/\r?\n/).map((text, index) => ({ lineNo: index + 1, text }));
  return classifyLines(file, lines, syntaxTable);
}

/**
 * Collects the added lines of each file, numbered by the new file. Hunk line counts decide
 * where a hunk ends, so an added line that starts with `+++` is not read as a header.
 *
 * @param {string} diff
 * @returns {Map<string, SourceLine[]>}
 */
function addedLinesByFile(diff) {
  /** @type {Map<string, SourceLine[]>} */
  const files = new Map();
  /** @type {SourceLine[] | null} */
  let current = null;
  let oldLeft = 0;
  let newLeft = 0;
  let lineNo = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (oldLeft > 0 || newLeft > 0) {
      const marker = line.charAt(0);
      if (marker === '+') {
        current?.push({ lineNo, text: line.slice(1) });
        lineNo += 1;
        newLeft -= 1;
      } else if (marker === '-') {
        oldLeft -= 1;
      } else if (marker !== '\\') {
        lineNo += 1;
        oldLeft -= 1;
        newLeft -= 1;
      }
      continue;
    }
    const target = /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
    if (target) {
      current = target[1] === '/dev/null' ? null : [];
      if (current) files.set(target[1], current);
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLeft = Number(hunk[1] ?? 1);
      lineNo = Number(hunk[2]);
      newLeft = Number(hunk[3] ?? 1);
    }
  }
  return files;
}

/**
 * @param {string} file
 * @param {SourceLine[]} lines
 * @param {SyntaxRow[]} syntaxTable
 * @returns {CommentRecord[]}
 */
function classifyLines(file, lines, syntaxTable) {
  const syntax = syntaxFor(file, syntaxTable);
  return groupLineComments(scanComments(lines, syntax), syntax).map((comment) => {
    const text = comment.parts.join('\n');
    /** @type {CommentRecord} */
    const record = { file, startLine: comment.startLine, endLine: comment.endLine, text, ...categorize(comment, syntax) };
    if (comment.code !== '') record.code = comment.code;
    return record;
  });
}

/**
 * @param {string} file
 * @param {SyntaxRow[]} syntaxTable
 * @returns {SyntaxRow}
 */
function syntaxFor(file, syntaxTable) {
  const dot = file.lastIndexOf('.');
  const extension = dot === -1 ? '' : file.slice(dot).toLowerCase();
  const known = syntaxTable.find((row) => row.extensions.includes(extension));
  return known ?? /** @type {SyntaxRow} */ (syntaxTable.find(isFallback));
}

/**
 * The row for an unknown extension. Its markers are guesses, so only a line that starts
 * with one counts, and every record goes to judgment.
 *
 * @param {SyntaxRow} row
 * @returns {boolean}
 */
function isFallback(row) {
  return row.extensions.includes('*');
}

/**
 * Walks the lines once and splits each into comment text and code text. String literals
 * are tracked per line, so a marker inside a string is not read as a comment. A quote that
 * never closes on its line is read again as code, because a regex literal such as `/"/`
 * must not hide the comment that follows it.
 *
 * @param {SourceLine[]} lines
 * @param {SyntaxRow} syntax
 * @returns {RawComment[]}
 */
function scanComments(lines, syntax) {
  /** @type {RawComment[]} */
  const comments = [];
  /** @type {{ comment: RawComment, closer: string } | null} */
  let open = null;
  let atTop = true;
  let nextLineNo = 1;
  for (const { lineNo, text } of lines) {
    if (lineNo !== nextLineNo) atTop = false;
    nextLineNo = lineNo + 1;
    if (lineNo === 1 && text.startsWith('#!')) continue;
    let code = '';
    let position = 0;
    /** @type {string | null} */
    let quote = null;
    let quoteStart = 0;
    let codeBeforeQuote = '';
    /** @type {RawComment[]} */
    const onLine = [];
    if (open) {
      onLine.push(open.comment);
      const end = text.indexOf(open.closer);
      open.comment.endLine = lineNo;
      if (end === -1) {
        open.comment.parts.push(text);
        continue;
      }
      position = end + open.closer.length;
      open.comment.parts.push(text.slice(0, position));
      open = null;
    }
    while (position < text.length || quote) {
      if (position >= text.length && quote) {
        position = quoteStart + 1;
        code = codeBeforeQuote + quote;
        quote = null;
        continue;
      }
      const char = text[position];
      if (quote) {
        const step = char === '\\' ? 2 : 1;
        code += text.slice(position, position + step);
        if (char === quote) quote = null;
        position += step;
        continue;
      }
      if ((syntax.strings ?? []).includes(char)) {
        quote = char;
        quoteStart = position;
        codeBeforeQuote = code;
        code += char;
        position += 1;
        continue;
      }
      const atBoundary = isFallback(syntax) ? code.trim() === '' : position === 0 || /\s/.test(text[position - 1]);
      const block = syntax.block.find(([opener]) => text.startsWith(opener, position));
      if (block && (atBoundary || !isFallback(syntax))) {
        const [opener, closer] = block;
        const end = text.indexOf(closer, position + opener.length);
        const comment = newComment(lineNo, text.slice(position, end === -1 ? undefined : end + closer.length), 'block', atTop && code.trim() === '');
        comments.push(comment);
        onLine.push(comment);
        if (end === -1) {
          open = { comment, closer };
          break;
        }
        position = end + closer.length;
        continue;
      }
      if (atBoundary && syntax.line.some((marker) => text.startsWith(marker, position))) {
        const comment = newComment(lineNo, text.slice(position), 'line', atTop && code.trim() === '');
        comments.push(comment);
        onLine.push(comment);
        break;
      }
      code += char;
      position += 1;
    }
    const trimmed = code.trim();
    if (trimmed !== '') atTop = false;
    for (const comment of onLine) {
      if (trimmed !== '') comment.code = comment.code === '' ? trimmed : `${comment.code}\n${trimmed}`;
    }
  }
  return comments;
}

/**
 * @param {number} lineNo
 * @param {string} text
 * @param {'line' | 'block'} kind
 * @param {boolean} atTop
 * @returns {RawComment}
 */
function newComment(lineNo, text, kind, atTop) {
  return { startLine: lineNo, endLine: lineNo, parts: [text], code: '', kind, atTop };
}

/**
 * Merges whole-line comments on adjacent lines into one record, so a block written with
 * line markers is judged as one unit. A directive always stands alone, because it acts on
 * the line below it and not on its neighbours. Code and prose never join, because a kept
 * prose comment must not share a record with commented-out code that is deleted.
 *
 * @param {RawComment[]} comments
 * @param {SyntaxRow} syntax
 * @returns {RawComment[]}
 */
function groupLineComments(comments, syntax) {
  /** @type {RawComment[]} */
  const grouped = [];
  for (const comment of comments) {
    const previous = grouped.at(-1);
    if (previous && canJoin(previous, comment, syntax)) {
      previous.parts.push(...comment.parts);
      previous.endLine = comment.endLine;
    } else {
      grouped.push({ ...comment, parts: [...comment.parts] });
    }
  }
  return grouped;
}

/**
 * @param {RawComment} previous
 * @param {RawComment} next
 * @param {SyntaxRow} syntax
 * @returns {boolean}
 */
function canJoin(previous, next, syntax) {
  if (isFallback(syntax)) return false;
  if (previous.kind !== 'line' || next.kind !== 'line') return false;
  if (previous.code !== '' || next.code !== '') return false;
  if (next.startLine !== previous.endLine + 1) return false;
  if (isDoc(previous.parts[0], syntax) !== isDoc(next.parts[0], syntax)) return false;
  if (isCodeComment(previous.parts.at(-1) ?? '', syntax) !== isCodeComment(next.parts[0], syntax)) return false;
  return !isDirective(previous.parts.at(-1) ?? '', syntax) && !isDirective(next.parts[0], syntax);
}

/**
 * @param {string} text
 * @param {SyntaxRow} syntax
 * @returns {boolean}
 */
function isCodeComment(text, syntax) {
  return isCodeLine(bodyOf(text, syntax));
}

/**
 * @param {string} text
 * @param {SyntaxRow} syntax
 * @returns {boolean}
 */
function isDirective(text, syntax) {
  const body = bodyOf(text, syntax);
  return SUPPRESSIONS.some(({ pattern }) => pattern.test(body)) || FORMATTER_DIRECTIVES.some((pattern) => pattern.test(body));
}

/**
 * @param {RawComment} comment
 * @param {SyntaxRow} syntax
 * @returns {{ category: Category, rule?: string | null }}
 */
function categorize(comment, syntax) {
  if (isFallback(syntax)) return { category: 'needs-judgment' };
  const text = comment.parts.join('\n');
  const body = bodyOf(text, syntax);
  for (const { pattern, ruleGroup } of SUPPRESSIONS) {
    const match = pattern.exec(body);
    if (match) return { category: 'suppression', rule: ruleOf(match, ruleGroup) };
  }
  if (FORMATTER_DIRECTIVES.some((pattern) => pattern.test(body))) return { category: 'formatter-directive' };
  if (comment.atTop && LICENSE_PATTERN.test(body)) return { category: 'license-header' };
  if (isDoc(text, syntax)) return { category: 'doc-comment' };
  if (looksLikeCode(body)) return { category: 'commented-out-code' };
  return { category: 'needs-judgment' };
}

/**
 * @param {string} text
 * @param {SyntaxRow} syntax
 * @returns {boolean}
 */
function isDoc(text, syntax) {
  return (syntax.doc ?? []).some((prefix) => text.startsWith(prefix) && !text.startsWith(`${prefix}/`));
}

/**
 * True when at least half of the non-empty body lines read as source code.
 *
 * @param {string} body
 * @returns {boolean}
 */
function looksLikeCode(body) {
  const lines = body.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return false;
  const codeLines = lines.filter((line) => isCodeLine(line.trim()));
  return codeLines.length * 2 >= lines.length;
}

/**
 * A keyword start marks code outright. A code shape alone, such as a trailing semicolon or
 * an equals sign, also fits a sentence, so it counts only when no run of three plain words
 * shows the line is prose.
 *
 * @param {string} line
 * @returns {boolean}
 */
function isCodeLine(line) {
  if (KEYWORD_CODE_PATTERNS.some((pattern) => pattern.test(line))) return true;
  return !PROSE_RUN.test(line) && SHAPE_CODE_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Strips the comment markers, so patterns match the words alone.
 *
 * @param {string} text
 * @param {SyntaxRow} syntax
 * @returns {string}
 */
function bodyOf(text, syntax) {
  const block = syntax.block.find(([opener]) => text.startsWith(opener));
  let inner = text;
  if (block) {
    inner = inner.slice(block[0].length);
    if (inner.endsWith(block[1])) inner = inner.slice(0, -block[1].length);
  }
  return inner
    .split('\n')
    .map((line) => stripLineMarker(line.trimStart(), block ? [] : syntax.line))
    .map((line) => line.replace(/^\s*[*/!]*\s?/, '').trimEnd())
    .join('\n')
    .trim();
}

/**
 * @param {string} line
 * @param {string[]} markers
 * @returns {string}
 */
function stripLineMarker(line, markers) {
  const marker = markers.find((candidate) => line.startsWith(candidate));
  return marker ? line.slice(marker.length) : line;
}

/**
 * @param {RegExpExecArray} match
 * @param {number | undefined} ruleGroup
 * @returns {string | null}
 */
function ruleOf(match, ruleGroup) {
  if (ruleGroup === undefined) return null;
  const rule = (match[ruleGroup] ?? '').split(' -- ')[0].trim();
  return rule === '' ? null : rule;
}

module.exports = { classifyDiff, classifyFile };
