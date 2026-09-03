const { resolveCommitConvention, FALLBACK_CONVENTION } = require('./resolve-commit-convention');

const VALID_COMMITLINT_CONFIG = {
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore']],
    'header-max-length': [2, 'always', 100],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'scope-enum': [2, 'always', ['api', 'ui']],
  },
};

const DOC_WITH_COMMIT_SECTION = `
# Project

## Unrelated section

Mentions \`docker\` and \`config\` in passing, not a type list.

## Commit messages

### Type

One of:

- \`feat\` — a new feature
- \`fix\` — a bug fix
- \`chore\` — tooling changes

Subject is lowercase, imperative, at or under 72 characters.

### Scope

Optional, one of \`engineering\`, \`productivity\`.
`;

const AGREEING_GIT_LOG_SUBJECTS = ['feat(engineering): add widget', 'fix(engineering): correct off-by-one', 'chore: bump deps', 'docs: update readme'];

describe('resolveCommitConvention', () => {
  it('resolves from commitlint config alone', () => {
    const result = resolveCommitConvention(VALID_COMMITLINT_CONFIG, null, []);
    expect(result).toEqual({
      source: 'commitlint',
      typeEnum: ['feat', 'fix', 'docs', 'chore'],
      subjectCase: 'lower-case',
      headerMaxLength: 100,
      scopeRule: { type: 'enum', values: ['api', 'ui'] },
      fallback: false,
    });
  });

  it('resolves from a written convention doc alone', () => {
    const result = resolveCommitConvention(null, DOC_WITH_COMMIT_SECTION, []);
    expect(result).toEqual({
      source: 'doc',
      typeEnum: ['feat', 'fix', 'chore'],
      subjectCase: 'lower-case',
      headerMaxLength: 72,
      scopeRule: { type: 'enum', values: ['engineering', 'productivity'] },
      fallback: false,
    });
  });

  it('resolves from a git-log subject sample alone', () => {
    const result = resolveCommitConvention(null, null, AGREEING_GIT_LOG_SUBJECTS);
    expect(result).toEqual({
      source: 'git-log',
      typeEnum: ['chore', 'docs', 'feat', 'fix'],
      subjectCase: 'lower-case',
      headerMaxLength: 72,
      scopeRule: { type: 'free' },
      fallback: false,
    });
  });

  it('prefers commitlint when all three sources agree', () => {
    const result = resolveCommitConvention(VALID_COMMITLINT_CONFIG, DOC_WITH_COMMIT_SECTION, AGREEING_GIT_LOG_SUBJECTS);
    expect(result.source).toBe('commitlint');
    expect(result.typeEnum).toEqual(['feat', 'fix', 'docs', 'chore']);
  });

  it('prefers commitlint over doc and git-log when all three disagree', () => {
    const conflictingDoc = `## Commit messages\n\n\`build\`, \`revert\`, \`perf\` are the only types.`;
    const conflictingGitLog = ['style: reformat', 'test: add coverage', 'ci: tune pipeline'];
    const result = resolveCommitConvention(VALID_COMMITLINT_CONFIG, conflictingDoc, conflictingGitLog);
    expect(result.source).toBe('commitlint');
    expect(result.typeEnum).toEqual(['feat', 'fix', 'docs', 'chore']);
  });

  it('falls back to the doc when commitlint config is absent, over a disagreeing git-log sample', () => {
    const conflictingGitLog = ['style: reformat', 'test: add coverage', 'ci: tune pipeline'];
    const result = resolveCommitConvention(null, DOC_WITH_COMMIT_SECTION, conflictingGitLog);
    expect(result.source).toBe('doc');
    expect(result.typeEnum).toEqual(['feat', 'fix', 'chore']);
  });

  it('returns the Fallback convention when no source yields a signal', () => {
    const result = resolveCommitConvention(null, null, []);
    expect(result).toEqual(FALLBACK_CONVENTION);
  });

  it('degrades from a malformed commitlint config to the next-priority source', () => {
    const result = resolveCommitConvention({ rules: {} }, DOC_WITH_COMMIT_SECTION, []);
    expect(result.source).toBe('doc');
  });

  it('degrades from a null commitlint config (a failed --print-config) to the next-priority source', () => {
    const result = resolveCommitConvention(null, DOC_WITH_COMMIT_SECTION, []);
    expect(result.source).toBe('doc');
  });

  it('degrades from a doc with fewer than two recognized types to git-log', () => {
    const thinDoc = '## Commit messages\n\nUse `feat` for features.';
    const result = resolveCommitConvention(null, thinDoc, AGREEING_GIT_LOG_SUBJECTS);
    expect(result.source).toBe('git-log');
  });

  it('degrades from fewer than two conventional git-log subjects to the Fallback convention', () => {
    const result = resolveCommitConvention(null, null, ['fix stuff']);
    expect(result).toEqual(FALLBACK_CONVENTION);
  });

  it('ignores backticked words outside the commit-message section when isolating a doc', () => {
    const docWithNoise = `## Deploy\n\n\`build\`, \`ci\`, \`docs\` describe unrelated pipeline stages.\n\n## Commit messages\n\n\`feat\`, \`fix\` are the two types.`;
    const result = resolveCommitConvention(null, docWithNoise, []);
    expect(result.source).toBe('doc');
    expect(result.typeEnum).toEqual(['feat', 'fix']);
  });
});
