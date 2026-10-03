const fs = require('fs');
const path = require('path');
const { classifyDiff, classifyFile } = require('./classify-comments');

const SYNTAX = JSON.parse(fs.readFileSync(path.join(__dirname, 'comment-syntax.json'), 'utf8'));

describe('classifyFile', () => {
  it('returns no records for empty content', () => {
    expect(classifyFile('src/empty.js', '', SYNTAX)).toEqual([]);
  });

  it('classifies a JSDoc block as a doc comment', () => {
    const content = ['const a = 1;', '/**', ' * Adds two numbers.', ' */', 'function add(a, b) {}'].join('\n');
    expect(classifyFile('src/math.js', content, SYNTAX)).toEqual([
      {
        file: 'src/math.js',
        startLine: 2,
        endLine: 4,
        text: ['/**', ' * Adds two numbers.', ' */'].join('\n'),
        category: 'doc-comment',
      },
    ]);
  });

  it('classifies a plain narration line as needs judgment', () => {
    const content = ['  // Loop over the users.', '  for (const user of users) {}'].join('\n');
    expect(classifyFile('src/users.js', content, SYNTAX)).toEqual([
      { file: 'src/users.js', startLine: 1, endLine: 1, text: '// Loop over the users.', category: 'needs-judgment' },
    ]);
  });

  it('records a trailing comment with the code on its line preserved', () => {
    const content = ['let total = 0;', 'const url = "http://example.test"; // the base URL'].join('\n');
    expect(classifyFile('src/config.ts', content, SYNTAX)).toEqual([
      {
        file: 'src/config.ts',
        startLine: 2,
        endLine: 2,
        text: '// the base URL',
        category: 'needs-judgment',
        code: 'const url = "http://example.test";',
      },
    ]);
  });
  it('classifies a prettier-ignore line as a formatter directive', () => {
    const content = ['// prettier-ignore', 'const matrix = [1,0,0, 0,1,0];'].join('\n');
    expect(classifyFile('src/matrix.js', content, SYNTAX)).toEqual([
      { file: 'src/matrix.js', startLine: 1, endLine: 1, text: '// prettier-ignore', category: 'formatter-directive' },
    ]);
  });

  it('classifies an eslint-disable line as a suppression and captures its rule', () => {
    const content = ['// eslint-disable-next-line no-console', 'console.log(value);'].join('\n');
    expect(classifyFile('src/log.js', content, SYNTAX)).toEqual([
      {
        file: 'src/log.js',
        startLine: 1,
        endLine: 1,
        text: '// eslint-disable-next-line no-console',
        category: 'suppression',
        rule: 'no-console',
      },
    ]);
  });

  it('classifies a @ts-expect-error line as a suppression with no rule', () => {
    const content = ['// @ts-expect-error', 'takesNumber("1");'].join('\n');
    expect(classifyFile('src/call.ts', content, SYNTAX)).toEqual([
      { file: 'src/call.ts', startLine: 1, endLine: 1, text: '// @ts-expect-error', category: 'suppression', rule: null },
    ]);
  });
  it('classifies a file-top block that names a license as a license header', () => {
    const content = ['// Copyright 2026 Example Corp.', '// Licensed under the MIT License.', '', 'const x = 1;'].join('\n');
    expect(classifyFile('src/index.js', content, SYNTAX)).toEqual([
      {
        file: 'src/index.js',
        startLine: 1,
        endLine: 2,
        text: ['// Copyright 2026 Example Corp.', '// Licensed under the MIT License.'].join('\n'),
        category: 'license-header',
      },
    ]);
  });

  it('does not read a license mention below the first code line as a license header', () => {
    const content = ['const x = 1;', '// Copyright notice moved to NOTICE.'].join('\n');
    expect(classifyFile('src/index.js', content, SYNTAX)[0].category).toBe('needs-judgment');
  });

  it('classifies a block of commented-out code as commented-out code', () => {
    const content = ['function total(items) {', '  // const count = items.length;', '  // return count * 2;', '}'].join('\n');
    expect(classifyFile('src/total.js', content, SYNTAX)).toEqual([
      {
        file: 'src/total.js',
        startLine: 2,
        endLine: 3,
        text: ['// const count = items.length;', '// return count * 2;'].join('\n'),
        category: 'commented-out-code',
      },
    ]);
  });

  it('splits commented-out code from an adjacent prose comment', () => {
    const content = [
      '  // const tax = sum * 0.19;',
      '  // The payment provider rejects amounts above the cap.',
      '  return Math.min(sum, cap);',
    ].join('\n');
    expect(classifyFile('src/cart.ts', content, SYNTAX)).toEqual([
      { file: 'src/cart.ts', startLine: 1, endLine: 1, text: '// const tax = sum * 0.19;', category: 'commented-out-code' },
      {
        file: 'src/cart.ts',
        startLine: 2,
        endLine: 2,
        text: '// The payment provider rejects amounts above the cap.',
        category: 'needs-judgment',
      },
    ]);
  });

  it('gives a TODO or FIXME line a record of its own, apart from adjacent prose', () => {
    const content = [
      '  // parse the JSON',
      '  // TODO: validate the schema',
      '  // The vendor API sends dates as Unix seconds.',
      '  // fixme: retry on failure',
      '  const created = new Date(data.created * 1000);',
    ].join('\n');
    const records = classifyFile('src/order.ts', content, SYNTAX);
    const ranges = records.map(({ startLine, endLine }) => [startLine, endLine]);
    expect(ranges).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
  });

  it('does not read a trailing comment on the first code line as a license header', () => {
    expect(classifyFile('src/index.js', 'const x = 1; // Copyright 2026', SYNTAX)[0].category).toBe('needs-judgment');
  });

  it('classifies a trailing Python suppression by the table and keeps its code', () => {
    const content = ['# Fetch the rows.', 'rows = fetch("#1")  # noqa: E501'].join('\n');
    expect(classifyFile('app/rows.py', content, SYNTAX)).toEqual([
      { file: 'app/rows.py', startLine: 1, endLine: 1, text: '# Fetch the rows.', category: 'needs-judgment' },
      {
        file: 'app/rows.py',
        startLine: 2,
        endLine: 2,
        text: '# noqa: E501',
        category: 'suppression',
        rule: 'E501',
        code: 'rows = fetch("#1")',
      },
    ]);
  });

  it('skips a shell shebang and classifies the comment below it', () => {
    const content = ['#!/usr/bin/env bash', '# shellcheck disable=SC2086', 'echo $name'].join('\n');
    expect(classifyFile('bin/greet.sh', content, SYNTAX)).toEqual([
      {
        file: 'bin/greet.sh',
        startLine: 2,
        endLine: 2,
        text: '# shellcheck disable=SC2086',
        category: 'suppression',
        rule: 'SC2086',
      },
    ]);
  });

  it('yields a needs-judgment record for every comment-like line of an unknown extension', () => {
    const content = ['// const x = 1;', 'x -- y', '# eslint-disable', 'z = 2', '-- a note'].join('\n');
    expect(classifyFile('src/rules.xyz', content, SYNTAX)).toEqual([
      { file: 'src/rules.xyz', startLine: 1, endLine: 1, text: '// const x = 1;', category: 'needs-judgment' },
      { file: 'src/rules.xyz', startLine: 3, endLine: 3, text: '# eslint-disable', category: 'needs-judgment' },
      { file: 'src/rules.xyz', startLine: 5, endLine: 5, text: '-- a note', category: 'needs-judgment' },
    ]);
  });
  it('classifies a language added as one table row, with no code change', () => {
    const haskell = { extensions: ['.hs'], line: ['--'], block: [['{-', '-}']], doc: ['{-|'], strings: ['"'] };
    const content = ['main = run', '{-| Runs the parser. -}', 'parse = go -- the entry point'].join('\n');
    expect(classifyFile('src/Main.hs', content, [haskell, ...SYNTAX])).toEqual([
      { file: 'src/Main.hs', startLine: 2, endLine: 2, text: '{-| Runs the parser. -}', category: 'doc-comment' },
      {
        file: 'src/Main.hs',
        startLine: 3,
        endLine: 3,
        text: '-- the entry point',
        category: 'needs-judgment',
        code: 'parse = go',
      },
    ]);
  });
  it('still finds a trailing comment after a quote that never closes on its line', () => {
    const records = classifyFile('src/quote.js', 'const quote = /"/; // matches a double quote', SYNTAX);
    expect(records).toEqual([
      {
        file: 'src/quote.js',
        startLine: 1,
        endLine: 1,
        text: '// matches a double quote',
        category: 'needs-judgment',
        code: 'const quote = /"/;',
      },
    ]);
  });

  it('does not read prose that contains an equals sign or a semicolon as commented-out code', () => {
    const content = [
      'run();',
      '// total = sum of all line items',
      'run();',
      '// the vendor API returns {} when empty;',
      '// we retry once before we give up;',
    ].join('\n');
    expect(classifyFile('src/retry.js', content, SYNTAX).map((record) => record.category)).toEqual([
      'needs-judgment',
      'needs-judgment',
    ]);
  });

  it('does not read a mention of noqa inside prose as a suppression', () => {
    expect(classifyFile('app/lint.py', '# we avoid noqa in this module', SYNTAX)[0].category).toBe('needs-judgment');
  });

  it('keeps no carriage return in a record from a file with CRLF line endings', () => {
    expect(classifyFile('src/win.js', '// Windows line.\r\nrun();\r\n', SYNTAX)[0].text).toBe('// Windows line.');
  });

  it('returns no records for binary content, even with comment-like bytes', () => {
    expect(classifyFile('assets/logo.png', '\u0089PNG\r\n\u0000\u0000# not a comment\n// nor this', SYNTAX)).toEqual([]);
  });
});

describe('classifyDiff', () => {
  it('returns no records for an empty diff', () => {
    expect(classifyDiff('', SYNTAX)).toEqual([]);
  });

  it('reads only added lines and numbers them by the new file', () => {
    const diff = [
      'diff --git a/src/cart.js b/src/cart.js',
      'index 1111111..2222222 100644',
      '--- a/src/cart.js',
      '+++ b/src/cart.js',
      '@@ -10,4 +10,4 @@ function cart() {',
      '   const items = [];',
      '-  // Old narration that was removed.',
      '+  // Add the item to the cart.',
      '   items.push(item);',
      '   // A context comment that did not change.',
      '',
    ].join('\n');
    expect(classifyDiff(diff, SYNTAX)).toEqual([
      { file: 'src/cart.js', startLine: 11, endLine: 11, text: '// Add the item to the cart.', category: 'needs-judgment' },
    ]);
  });

  it('classifies the added lines of each file in a multi-file diff and skips a deleted file', () => {
    const diff = [
      'diff --git a/LICENSE.sh b/LICENSE.sh',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/bin/run.sh',
      '@@ -0,0 +1,2 @@',
      '+# Copyright 2026 Example Corp.',
      '+run "$@"',
      'diff --git a/src/old.js b/src/old.js',
      'deleted file mode 100644',
      '--- a/src/old.js',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-// gone',
      '',
    ].join('\n');
    expect(classifyDiff(diff, SYNTAX)).toEqual([
      { file: 'bin/run.sh', startLine: 1, endLine: 1, text: '# Copyright 2026 Example Corp.', category: 'license-header' },
    ]);
  });
});
