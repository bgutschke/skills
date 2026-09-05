const { resolveBoundary, parseRelativePhrase } = require('./resolve-boundary');

const TODAY = '2026-03-15';

describe('parseRelativePhrase', () => {
  it('resolves "today" to the anchor date', () => {
    expect(parseRelativePhrase('today', TODAY)).toBe('2026-03-15');
  });

  it('resolves "yesterday" to one day before the anchor', () => {
    expect(parseRelativePhrase('yesterday', TODAY)).toBe('2026-03-14');
  });

  it('resolves "last week" to seven days before the anchor', () => {
    expect(parseRelativePhrase('last week', TODAY)).toBe('2026-03-08');
  });

  it('resolves "last month" to the same day one calendar month back', () => {
    expect(parseRelativePhrase('last month', TODAY)).toBe('2026-02-15');
  });

  it('resolves "last year" to the same day one calendar year back', () => {
    expect(parseRelativePhrase('last year', TODAY)).toBe('2025-03-15');
  });

  it('resolves a numeric "N days ago" phrase', () => {
    expect(parseRelativePhrase('3 days ago', TODAY)).toBe('2026-03-12');
  });

  it('resolves a numeric "N weeks ago" phrase', () => {
    expect(parseRelativePhrase('2 weeks ago', TODAY)).toBe('2026-03-01');
  });

  it('resolves a numeric "N months ago" phrase, rolling the year back when needed', () => {
    expect(parseRelativePhrase('4 months ago', TODAY)).toBe('2025-11-15');
  });

  it('clamps a month-end anchor to the target month\'s own last day', () => {
    expect(parseRelativePhrase('last month', '2026-03-31')).toBe('2026-02-28');
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(parseRelativePhrase('  Last Week  ', TODAY)).toBe('2026-03-08');
  });

  it('returns null for a phrase this grammar does not recognize', () => {
    expect(parseRelativePhrase('next tuesday', TODAY)).toBeNull();
  });
});

describe('resolveBoundary', () => {
  it('passes an absolute date through unchanged, without consulting the git callback', () => {
    const resolveGitRefDate = jest.fn();
    const result = resolveBoundary('--from', '2026-01-01', TODAY, resolveGitRefDate);
    expect(result).toBe('2026-01-01');
    expect(resolveGitRefDate).not.toHaveBeenCalled();
  });

  it('resolves a relative phrase without consulting the git callback', () => {
    const resolveGitRefDate = jest.fn();
    const result = resolveBoundary('--to', 'yesterday', TODAY, resolveGitRefDate);
    expect(result).toBe('2026-03-14');
    expect(resolveGitRefDate).not.toHaveBeenCalled();
  });

  it('falls back to the git callback for a value that is neither an absolute date nor a relative phrase', () => {
    const resolveGitRefDate = jest.fn().mockReturnValue('2025-12-01');
    const result = resolveBoundary('--from', 'v2.0.0', TODAY, resolveGitRefDate);
    expect(result).toBe('2025-12-01');
    expect(resolveGitRefDate).toHaveBeenCalledWith('v2.0.0');
  });

  it('resolves a mix of one absolute date and one git ref on opposite sides independently', () => {
    const resolveGitRefDate = jest.fn().mockReturnValue('2025-12-01');
    const from = resolveBoundary('--from', 'release-branch', TODAY, resolveGitRefDate);
    const to = resolveBoundary('--to', '2026-01-01', TODAY, resolveGitRefDate);
    expect(from).toBe('2025-12-01');
    expect(to).toBe('2026-01-01');
  });

  it('resolves a mix of one absolute date and one relative phrase on opposite sides independently', () => {
    const resolveGitRefDate = jest.fn();
    const from = resolveBoundary('--from', 'last week', TODAY, resolveGitRefDate);
    const to = resolveBoundary('--to', '2026-03-20', TODAY, resolveGitRefDate);
    expect(from).toBe('2026-03-08');
    expect(to).toBe('2026-03-20');
    expect(resolveGitRefDate).not.toHaveBeenCalled();
  });

  it('throws when the value is neither an absolute date, a relative phrase, nor a resolvable git ref', () => {
    const resolveGitRefDate = jest.fn().mockReturnValue(null);
    expect(() => resolveBoundary('--from', 'not-a-real-ref', TODAY, resolveGitRefDate)).toThrow(
      /--from must be an absolute date/,
    );
  });
});
