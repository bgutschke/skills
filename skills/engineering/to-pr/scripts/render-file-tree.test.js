const { renderFileTree } = require('./render-file-tree');

describe('renderFileTree', () => {
  it('returns null for empty input', () => {
    expect(renderFileTree('')).toBeNull();
  });

  it('renders one added file at the repo root', () => {
    expect(renderFileTree('A\tREADME.md\n')).toBe(['```diff', '+README.md', '```'].join('\n'));
  });

  it('returns null when every entry is a modification', () => {
    expect(renderFileTree('M\tREADME.md\nM\tsrc/index.js\n')).toBeNull();
  });

  it('renders one deleted file in a nested folder', () => {
    expect(renderFileTree('D\tsrc/lib/old.js\n')).toBe(
      ['```diff', ' src/', '   lib/', '-    old.js', '```'].join('\n'),
    );
  });

  it('renders a rename across folders as the old path removed and the new path added', () => {
    expect(renderFileTree('R100\tlib/util.js\tsrc/util.js\n')).toBe(
      ['```diff', ' lib/', '-  util.js', ' src/', '+  util.js', '```'].join('\n'),
    );
  });

  it('parses a rename with a similarity score below 100 the same way', () => {
    expect(renderFileTree('R087\tlib/util.js\tsrc/util.js\n')).toBe(
      ['```diff', ' lib/', '-  util.js', ' src/', '+  util.js', '```'].join('\n'),
    );
  });

  it('renders a copy as only the target added', () => {
    expect(renderFileTree('C075\tsrc/a.js\tsrc/b.js\n')).toBe(['```diff', ' src/', '+  b.js', '```'].join('\n'));
  });

  it('leaves out type changes', () => {
    expect(renderFileTree('T\tbin/run\nA\tbin/setup\n')).toBe(['```diff', ' bin/', '+  setup', '```'].join('\n'));
  });

  it('sorts folders first, then files, each alphabetically', () => {
    expect(renderFileTree('A\tz.md\nD\tb/x.js\nA\ta.md\nA\ta/y.js\n')).toBe(
      ['```diff', ' a/', '+  y.js', ' b/', '-  x.js', '+a.md', '+z.md', '```'].join('\n'),
    );
  });

  it('puts two files in the same folder under one folder line', () => {
    expect(renderFileTree('A\tdocs/one.md\nD\tdocs/two.md\n')).toBe(
      ['```diff', ' docs/', '+  one.md', '-  two.md', '```'].join('\n'),
    );
  });

  it('renders output of exactly the maximum line count', () => {
    const entries = Array.from({ length: 40 }, (_, i) => `A\tfile-${String(i).padStart(2, '0')}.md`);
    const rendered = renderFileTree(entries.join('\n'));
    expect(rendered?.split('\n')).toHaveLength(42);
  });

  it('returns null when the output exceeds the maximum line count', () => {
    const entries = Array.from({ length: 40 }, (_, i) => `A\tdocs/file-${String(i).padStart(2, '0')}.md`);
    expect(renderFileTree(entries.join('\n'))).toBeNull();
  });
});
