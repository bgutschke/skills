const { generateCandidatePaths, expandVariables } = require('./generate-candidate-paths');

const context = {
  citingFileDir: '/repo/skills/productivity/refactor-rule-tree',
  repoRoot: '/repo',
  homeDir: '/home/user',
  env: { CLAUDE_CONFIG_DIR: '/home/user/.claude' },
};

describe('generateCandidatePaths', () => {
  it('tries the citing file\'s own directory, then the repo root, then the home directory, in that order', () => {
    expect(generateCandidatePaths('foo.md', context)).toEqual([
      '/repo/skills/productivity/refactor-rule-tree/foo.md',
      '/repo/foo.md',
      '/home/user/foo.md',
    ]);
  });

  it('resolves a relative path with directory segments against each root', () => {
    expect(generateCandidatePaths('docs/adr/0024-foo.md', context)).toEqual([
      '/repo/skills/productivity/refactor-rule-tree/docs/adr/0024-foo.md',
      '/repo/docs/adr/0024-foo.md',
      '/home/user/docs/adr/0024-foo.md',
    ]);
  });

  it('deduplicates candidates when two roots coincide', () => {
    const sameRootContext = { ...context, citingFileDir: '/repo' };
    expect(generateCandidatePaths('foo.md', sameRootContext)).toEqual(['/repo/foo.md', '/home/user/foo.md']);
  });

  it('skips a root that was not supplied rather than producing a bad candidate', () => {
    expect(generateCandidatePaths('foo.md', { citingFileDir: '/repo/dir', repoRoot: '/repo' })).toEqual([
      '/repo/dir/foo.md',
      '/repo/foo.md',
    ]);
  });

  it('expands a recognized harness variable and returns the single resulting absolute candidate', () => {
    expect(generateCandidatePaths('$CLAUDE_CONFIG_DIR/CLAUDE.md', context)).toEqual(['/home/user/.claude/CLAUDE.md']);
  });

  it('expands a home-directory tilde reference to a single absolute candidate', () => {
    expect(generateCandidatePaths('~/.claude/CLAUDE.md', context)).toEqual(['/home/user/.claude/CLAUDE.md']);
  });

  it('returns an already-absolute path unchanged, without joining it against any root', () => {
    expect(generateCandidatePaths('/etc/hosts', context)).toEqual(['/etc/hosts']);
  });
});

describe('expandVariables', () => {
  it('substitutes a recognized variable from the supplied env', () => {
    expect(expandVariables('$CLAUDE_CONFIG_DIR/CLAUDE.md', { homeDir: '/home/user', env: { CLAUDE_CONFIG_DIR: '/x/.claude' } })).toBe(
      '/x/.claude/CLAUDE.md',
    );
  });

  it('substitutes $HOME from homeDir directly, independent of env', () => {
    expect(expandVariables('$HOME/CLAUDE.md', { homeDir: '/home/user', env: {} })).toBe('/home/user/CLAUDE.md');
  });

  it('leaves an unrecognized or blank variable reference untouched', () => {
    expect(expandVariables('$UNKNOWN/foo.md', { homeDir: '/home/user', env: {} })).toBe('$UNKNOWN/foo.md');
    expect(expandVariables('$CLAUDE_CONFIG_DIR/foo.md', { homeDir: '/home/user', env: { CLAUDE_CONFIG_DIR: '' } })).toBe(
      '$CLAUDE_CONFIG_DIR/foo.md',
    );
  });

  it('leaves a path with no variable reference untouched', () => {
    expect(expandVariables('docs/adr/0024-foo.md', { homeDir: '/home/user', env: {} })).toBe('docs/adr/0024-foo.md');
  });
});
