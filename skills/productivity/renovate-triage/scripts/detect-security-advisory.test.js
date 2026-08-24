const { detectSecurityAdvisory } = require('./detect-security-advisory');

describe('detectSecurityAdvisory', () => {
  it('matches a changelog containing a CVE identifier', () => {
    const result = detectSecurityAdvisory('Fixes a heap overflow (CVE-2024-31449) in the Lua scripting engine.');
    expect(result.found).toBe(true);
    expect(result.signals).toContain('cve');
  });

  it('matches a changelog containing a GitHub Security Advisory ID', () => {
    const result = detectSecurityAdvisory('See GHSA-abcd-1234-efgh for full details.');
    expect(result.found).toBe(true);
    expect(result.signals).toContain('ghsa');
  });

  it('matches a changelog containing a "Security" heading', () => {
    const result = detectSecurityAdvisory('## Security\n\nThis release addresses a reported issue.');
    expect(result.found).toBe(true);
    expect(result.signals).toContain('security-heading');
  });

  it('matches explicit urgency/vulnerability language with no CVE, GHSA, or heading present', () => {
    const result = detectSecurityAdvisory('Update urgency: SECURITY\n\nThis release fixes a remote code execution vulnerability in RDB loading.');
    expect(result.found).toBe(true);
    expect(result.signals).toContain('urgency-language');
    expect(result.signals).not.toContain('cve');
    expect(result.signals).not.toContain('ghsa');
    expect(result.signals).not.toContain('security-heading');
  });

  it('finds nothing in a clean changelog with none of the four signals', () => {
    const result = detectSecurityAdvisory('## Changes\n\n- Improved startup time.\n- Fixed a typo in the CLI help text.');
    expect(result).toEqual({ found: false, signals: [] });
  });

  it('matches regardless of bump size, since the module takes no bump-size input at all', () => {
    const text = 'CVE-2024-31449 fixed.';
    expect(detectSecurityAdvisory(text)).toEqual(detectSecurityAdvisory(text));
    expect(detectSecurityAdvisory.length).toBe(1);
  });
});
