const { classifyNode, shouldWalkOnward, CODE_EXTENSIONS, CONFIGURATION_EXTENSIONS } = require('./classify-node');

describe('classifyNode', () => {
  it('classifies an auto-loaded prose file as restructurable', () => {
    expect(classifyNode({ path: 'CLAUDE.md', isAutoLoaded: true })).toEqual({
      class: 'restructurable',
      reason: null,
    });
  });

  it('classifies a non-auto-loaded prose file as verify-only', () => {
    expect(classifyNode({ path: 'docs/adr/0024-foo.md', isAutoLoaded: false })).toEqual({
      class: 'verify-only',
      reason: null,
    });
  });

  it('decides restructurable vs. verify-only on auto-load status, not extension: two .md files split by the same flag alone', () => {
    const imported = classifyNode({ path: 'ROUTING.md', isAutoLoaded: true });
    const mentioned = classifyNode({ path: 'ROUTING.md', isAutoLoaded: false });
    expect(imported.class).toBe('restructurable');
    expect(mentioned.class).toBe('verify-only');
  });

  it('classifies a code file as resolve-only regardless of auto-load status', () => {
    expect(classifyNode({ path: 'scripts/verify-pointers-cli.js', isAutoLoaded: true })).toEqual({
      class: 'resolve-only',
      reason: 'code',
    });
    expect(classifyNode({ path: 'scripts/verify-pointers-cli.js', isAutoLoaded: false })).toEqual({
      class: 'resolve-only',
      reason: 'code',
    });
  });

  it('classifies structured configuration as resolve-only', () => {
    expect(classifyNode({ path: '.claude/settings.json', isAutoLoaded: true })).toEqual({
      class: 'resolve-only',
      reason: 'configuration',
    });
  });

  it('classifies the memory index file as resolve-only', () => {
    expect(classifyNode({ path: 'memory/MEMORY.md', isAutoLoaded: false })).toEqual({
      class: 'resolve-only',
      reason: 'memory-file',
    });
  });

  it('classifies a file inside a memory directory as resolve-only, wherever that directory is rooted', () => {
    expect(
      classifyNode({ path: '/Users/bge/.claude/projects/foo/memory/feedback_example.md', isAutoLoaded: false }),
    ).toEqual({ class: 'resolve-only', reason: 'memory-file' });
  });

  it('classifies another skill\'s SKILL.md as resolve-only', () => {
    expect(classifyNode({ path: 'skills/productivity/commit-msg/SKILL.md', isAutoLoaded: false })).toEqual({
      class: 'resolve-only',
      reason: 'skill-manifest',
    });
  });

  it('exposes the exact extension sets classification relies on', () => {
    expect(CODE_EXTENSIONS.has('.ts')).toBe(true);
    expect(CONFIGURATION_EXTENSIONS.has('.yaml')).toBe(true);
  });
});

describe('shouldWalkOnward', () => {
  it('is false for a resolve-only node, so the walk stops there', () => {
    expect(shouldWalkOnward('resolve-only')).toBe(false);
  });

  it('is true for a restructurable or verify-only node', () => {
    expect(shouldWalkOnward('restructurable')).toBe(true);
    expect(shouldWalkOnward('verify-only')).toBe(true);
  });
});
