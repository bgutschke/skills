const { findPartialPathCompletion } = require('./find-partial-path-completion');

describe('findPartialPathCompletion', () => {
  const knownPaths = [
    'skills/productivity/refactor-rule-tree/SKILL.md',
    'skills/productivity/renovate-triage/SKILL.md',
    'README.md',
  ];

  it('completes a partial path that uniquely matches one known file as a path suffix', () => {
    expect(findPartialPathCompletion('refactor-rule-tree/SKILL.md', knownPaths)).toBe(
      'skills/productivity/refactor-rule-tree/SKILL.md',
    );
  });

  it('returns null when no known file ends with the partial path', () => {
    expect(findPartialPathCompletion('nonexistent-skill/SKILL.md', knownPaths)).toBeNull();
  });

  it('returns null rather than guessing when more than one known file matches', () => {
    expect(findPartialPathCompletion('SKILL.md', knownPaths)).toBeNull();
  });

  it('returns the exact match when the raw path already equals a known file in full', () => {
    expect(findPartialPathCompletion('README.md', knownPaths)).toBe('README.md');
  });

  it('normalizes a leading "./" before matching', () => {
    expect(findPartialPathCompletion('./README.md', knownPaths)).toBe('README.md');
  });

  it('treats a missing knownPaths argument as no matches rather than throwing', () => {
    expect(findPartialPathCompletion('README.md')).toBeNull();
  });
});
