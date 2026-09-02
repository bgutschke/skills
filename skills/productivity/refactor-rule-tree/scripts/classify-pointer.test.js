const { classifyPointer, FAMILY_FILENAMES, KNOWN_HARNESS_VARIABLES } = require('./classify-pointer');

describe('classifyPointer', () => {
  it('classifies a glob as unverifiable', () => {
    expect(classifyPointer('docs/adr/*.md')).toEqual({
      kind: 'mention',
      path: 'docs/adr/*.md',
      formedness: 'unverifiable',
      reason: 'glob',
    });
  });

  it('classifies a bracket character class as a glob', () => {
    expect(classifyPointer('docs/adr/000[0-9].md').reason).toBe('glob');
  });

  it('classifies an angle-bracket placeholder as unverifiable', () => {
    expect(classifyPointer('<path-to-file>')).toEqual({
      kind: 'mention',
      path: '<path-to-file>',
      formedness: 'unverifiable',
      reason: 'placeholder',
    });
  });

  it('classifies a bare family filename as unverifiable', () => {
    expect(classifyPointer('CLAUDE.md')).toEqual({
      kind: 'mention',
      path: 'CLAUDE.md',
      formedness: 'unverifiable',
      reason: 'bare-family-filename',
    });
  });

  it('does not treat a qualified family filename as ambiguous', () => {
    const result = classifyPointer('docs/CLAUDE.md');
    expect(result.formedness).toBe('well-formed');
  });

  it('classifies an extension-only mention as unverifiable', () => {
    expect(classifyPointer('.env')).toEqual({
      kind: 'mention',
      path: '.env',
      formedness: 'unverifiable',
      reason: 'extension-only',
    });
  });

  it('classifies an unrecognized variable reference as unverifiable', () => {
    expect(classifyPointer('$SOME_RANDOM_VAR/foo.md')).toEqual({
      kind: 'mention',
      path: '$SOME_RANDOM_VAR/foo.md',
      formedness: 'unverifiable',
      reason: 'unexpanded-variable',
    });
  });

  it('treats a recognized harness variable as well-formed, deferred to resolution', () => {
    const result = classifyPointer('$CLAUDE_CONFIG_DIR/CLAUDE.md');
    expect(result).toEqual({
      kind: 'mention',
      path: '$CLAUDE_CONFIG_DIR/CLAUDE.md',
      formedness: 'well-formed',
      reason: null,
    });
  });

  it('treats a home-directory tilde reference as well-formed', () => {
    expect(classifyPointer('~/.claude/CLAUDE.md').formedness).toBe('well-formed');
  });

  it('treats a partial path missing leading segments as well-formed, deferred to resolution', () => {
    expect(classifyPointer('refactor-rule-tree/SKILL.md')).toEqual({
      kind: 'mention',
      path: 'refactor-rule-tree/SKILL.md',
      formedness: 'well-formed',
      reason: null,
    });
  });

  it('treats a bare filename outside the family list as well-formed', () => {
    expect(classifyPointer('COMMIT-SKELETON.md').formedness).toBe('well-formed');
  });

  it('distinguishes an import edge from a mention edge', () => {
    expect(classifyPointer('@ROUTING.md')).toEqual({
      kind: 'import',
      path: 'ROUTING.md',
      formedness: 'well-formed',
      reason: null,
    });
    expect(classifyPointer('ROUTING.md').kind).toBe('mention');
  });

  it('strips surrounding backticks and whitespace before classifying', () => {
    expect(classifyPointer('  `docs/adr/0024-foo.md`  ')).toEqual({
      kind: 'mention',
      path: 'docs/adr/0024-foo.md',
      formedness: 'well-formed',
      reason: null,
    });
  });

  it('exposes the exact family-filename and known-variable sets the classification relies on', () => {
    expect(FAMILY_FILENAMES).toEqual(new Set(['CLAUDE.md', 'CLAUDE.local.md', 'SKILL.md', 'README.md', 'AGENTS.md']));
    expect(KNOWN_HARNESS_VARIABLES).toEqual(new Set(['CLAUDE_CONFIG_DIR', 'CLAUDE_PROJECT_DIR', 'HOME']));
  });
});
