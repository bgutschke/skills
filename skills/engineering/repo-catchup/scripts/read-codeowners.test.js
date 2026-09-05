const { readCodeownersContent } = require('./read-codeowners');

describe('readCodeownersContent', () => {
  it('reads the root CODEOWNERS file when present', () => {
    const readFile = (path) => (path === 'CODEOWNERS' ? '* @team-a\n' : null);
    expect(readCodeownersContent(readFile)).toBe('* @team-a\n');
  });

  it('falls back to .github/CODEOWNERS when the root file is absent', () => {
    const readFile = (path) => (path === '.github/CODEOWNERS' ? '* @team-b\n' : null);
    expect(readCodeownersContent(readFile)).toBe('* @team-b\n');
  });

  it('falls back to docs/CODEOWNERS when neither other location has one', () => {
    const readFile = (path) => (path === 'docs/CODEOWNERS' ? '* @team-c\n' : null);
    expect(readCodeownersContent(readFile)).toBe('* @team-c\n');
  });

  it('prefers the root file over .github/CODEOWNERS when both exist', () => {
    const readFile = (path) => {
      if (path === 'CODEOWNERS') return '* @team-root\n';
      if (path === '.github/CODEOWNERS') return '* @team-github\n';
      return null;
    };
    expect(readCodeownersContent(readFile)).toBe('* @team-root\n');
  });

  it('returns null when no location has a CODEOWNERS file', () => {
    expect(readCodeownersContent(() => null)).toBeNull();
  });
});
