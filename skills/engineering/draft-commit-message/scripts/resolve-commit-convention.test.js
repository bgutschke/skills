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

const DOC_TYPE_SUBSECTION = `One of:

- \`feat\` — a new feature
- \`fix\` — a bug fix
- \`chore\` — tooling changes

Subject is lowercase, imperative, at or under 72 characters.`;

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
      typeGuidance: null,
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
      typeGuidance: DOC_TYPE_SUBSECTION,
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
      typeGuidance: null,
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

  describe('typeGuidance', () => {
    it('carries the type subsection of the commit section, ending at the next sibling heading', () => {
      const result = resolveCommitConvention(null, DOC_WITH_COMMIT_SECTION, []);
      expect(result.typeGuidance).toBe(DOC_TYPE_SUBSECTION);
      expect(result.typeGuidance).not.toContain('productivity');
    });

    it('still carries the doc guidance when commitlint wins the format rules', () => {
      const result = resolveCommitConvention(VALID_COMMITLINT_CONFIG, DOC_WITH_COMMIT_SECTION, []);
      expect(result.source).toBe('commitlint');
      expect(result.typeEnum).toEqual(['feat', 'fix', 'docs', 'chore']);
      expect(result.typeGuidance).toBe(DOC_TYPE_SUBSECTION);
    });

    it('carries the guidance of a doc too thin to win, when git-log wins the format rules', () => {
      const thinDoc = '## Commit messages\n\n### Types\n\nA fix to release tooling is `chore`.';
      const result = resolveCommitConvention(null, thinDoc, AGREEING_GIT_LOG_SUBJECTS);
      expect(result.source).toBe('git-log');
      expect(result.typeGuidance).toBe('A fix to release tooling is `chore`.');
    });

    it('carries the guidance of a thin doc on a fallback resolution, without clearing the fallback flag', () => {
      const thinDoc = '## Commit messages\n\n### Types\n\nA fix to release tooling is `chore`.';
      const result = resolveCommitConvention(null, thinDoc, []);
      expect(result.source).toBe('fallback');
      expect(result.fallback).toBe(true);
      expect(result.typeGuidance).toBe('A fix to release tooling is `chore`.');
    });

    it('carries the full commit section when it has no type heading', () => {
      const doc = '# Project\n\n## Commit messages\n\nUse `feat` and `fix` only.\n\n## Deploy\n\nRun the pipeline.';
      const result = resolveCommitConvention(null, doc, []);
      expect(result.typeGuidance).toBe('Use `feat` and `fix` only.');
    });

    it('is null when the doc has no commit heading', () => {
      const doc = '# Project\n\n## Types\n\n`feat` and `fix` are unrelated words here.';
      const result = resolveCommitConvention(null, doc, AGREEING_GIT_LOG_SUBJECTS);
      expect(result.typeGuidance).toBeNull();
    });

    it('is null when no doc exists', () => {
      const result = resolveCommitConvention(VALID_COMMITLINT_CONFIG, null, AGREEING_GIT_LOG_SUBJECTS);
      expect(result.typeGuidance).toBeNull();
    });

    it('is null when the type subsection is empty', () => {
      const doc = '## Commit messages\n\n### Type\n\n### Scope\n\nAny scope.';
      const result = resolveCommitConvention(null, doc, []);
      expect(result.typeGuidance).toBeNull();
    });

    it('caps the guidance at 2,000 characters', () => {
      const doc = `## Commit messages\n\n### Type\n\n${'x'.repeat(2500)}`;
      const result = resolveCommitConvention(null, doc, []);
      expect(result.typeGuidance).toBe('x'.repeat(2000));
    });
  });
});
