const { computeVerdict } = require('./compute-verdict');

describe('computeVerdict', () => {
  const passing = { changelogFound: true, relevantBreakingChangeCallout: false, ciStatus: 'passing', blastRadiusLarge: false };

  it('blocks on a relevant breaking-change callout regardless of everything else', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'minor', relevantBreakingChangeCallout: true });
    expect(result.verdict).toBe('blocked');
    expect(result.reason).toMatch(/breaking-change callout/);
  });

  it('blocks on a failing CI check regardless of everything else', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'patch', ciStatus: 'failing' });
    expect(result.verdict).toBe('blocked');
    expect(result.reason).toMatch(/failing CI/);
  });

  it('blocks a major bump with no changelog found anywhere', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'major', changelogFound: false });
    expect(result.verdict).toBe('blocked');
    expect(result.reason).toMatch(/no changelog/);
  });

  it('is safe for a patch/minor bump with a changelog found and nothing else firing', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'patch' });
    expect(result.verdict).toBe('safe');
  });

  it('is needs-review for a major bump with a changelog and no relevant callout', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'major' });
    expect(result.verdict).toBe('needs-review');
  });

  it('is needs-review for a patch/minor bump with no changelog found', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'minor', changelogFound: false });
    expect(result.verdict).toBe('needs-review');
  });

  it('escalates an otherwise-safe verdict to needs-review on a large blast radius', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'minor', blastRadiusLarge: true });
    expect(result.verdict).toBe('needs-review');
    expect(result.reason).toMatch(/blast radius/);
  });

  it('escalates an otherwise-safe verdict to needs-review on pending CI', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'minor', ciStatus: 'pending' });
    expect(result.verdict).toBe('needs-review');
    expect(result.reason).toMatch(/CI pending/);
  });

  it('never escalates past needs-review even when both escalations fire on the same dependency', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'patch', blastRadiusLarge: true, ciStatus: 'pending' });
    expect(result.verdict).toBe('needs-review');
  });

  it('reaches blocked only via a hard-stop, never via baseline plus escalations', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'major', blastRadiusLarge: true, ciStatus: 'pending' });
    expect(result.verdict).toBe('needs-review');
  });

  it('still reports escalation detail in reason even when the baseline was already needs-review', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'major', ciStatus: 'pending' });
    expect(result.verdict).toBe('needs-review');
    expect(result.reason).toMatch(/CI pending/);
  });

  it('defaults an indeterminate bump size to a needs-review baseline', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'indeterminate' });
    expect(result.verdict).toBe('needs-review');
    expect(result.reason).toMatch(/indeterminate/);
  });

  it('still blocks an indeterminate bump size on a failing CI check', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'indeterminate', ciStatus: 'failing' });
    expect(result.verdict).toBe('blocked');
    expect(result.reason).toMatch(/failing CI/);
  });

  it('still blocks an indeterminate bump size on a relevant breaking-change callout', () => {
    const result = computeVerdict({ ...passing, bumpSize: 'indeterminate', relevantBreakingChangeCallout: true });
    expect(result.verdict).toBe('blocked');
    expect(result.reason).toMatch(/breaking-change callout/);
  });
});
