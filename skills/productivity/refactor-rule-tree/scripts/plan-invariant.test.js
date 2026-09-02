const { checkPlanInvariant, VALID_VERDICTS } = require('./plan-invariant');

function entry(ruleId, verdict) {
  return { ruleId, verdict };
}

describe('checkPlanInvariant', () => {
  it('passes when every source rule appears exactly once with a valid verdict', () => {
    const result = checkPlanInvariant({
      ruleIds: ['squash-before-merge', 'no-auto-commit', 'spaces-not-tabs'],
      entries: [
        entry('squash-before-merge', 'stay'),
        entry('no-auto-commit', 'move'),
        entry('spaces-not-tabs', 'delete'),
      ],
    });
    expect(result).toEqual({ ok: true, duplicates: [], missing: [], unknown: [], invalidVerdict: [] });
  });

  it('passes on an empty source file with an empty plan', () => {
    expect(checkPlanInvariant({ ruleIds: [], entries: [] })).toEqual({
      ok: true,
      duplicates: [],
      missing: [],
      unknown: [],
      invalidVerdict: [],
    });
  });

  it('does not depend on matching order between the source list and the plan', () => {
    const result = checkPlanInvariant({
      ruleIds: ['a', 'b', 'c'],
      entries: [entry('c', 'stay'), entry('a', 'move'), entry('b', 'skill')],
    });
    expect(result.ok).toBe(true);
  });

  it('fails and names a rule appearing twice in the plan', () => {
    const result = checkPlanInvariant({
      ruleIds: ['no-auto-commit'],
      entries: [entry('no-auto-commit', 'stay'), entry('no-auto-commit', 'move')],
    });
    expect(result.ok).toBe(false);
    expect(result.duplicates).toEqual(['no-auto-commit']);
    expect(result.missing).toEqual([]);
  });

  it('fails and names a rule missing from the plan entirely', () => {
    const result = checkPlanInvariant({
      ruleIds: ['squash-before-merge', 'no-auto-commit'],
      entries: [entry('squash-before-merge', 'stay')],
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['no-auto-commit']);
    expect(result.duplicates).toEqual([]);
  });

  it('fails on both a duplicate and a missing rule in the same plan', () => {
    const result = checkPlanInvariant({
      ruleIds: ['a', 'b'],
      entries: [entry('a', 'stay'), entry('a', 'delete')],
    });
    expect(result.ok).toBe(false);
    expect(result.duplicates).toEqual(['a']);
    expect(result.missing).toEqual(['b']);
  });

  it('fails and names a plan entry for a ruleId the source file never had', () => {
    const result = checkPlanInvariant({
      ruleIds: ['a'],
      entries: [entry('a', 'stay'), entry('invented-rule', 'move')],
    });
    expect(result.ok).toBe(false);
    expect(result.unknown).toEqual(['invented-rule']);
  });

  it('fails and names a rule carrying a verdict outside the four placements', () => {
    const result = checkPlanInvariant({
      ruleIds: ['a'],
      entries: [entry('a', 'archive')],
    });
    expect(result.ok).toBe(false);
    expect(result.invalidVerdict).toEqual(['a']);
  });

  it('exposes the exact four valid verdicts the rest of the skill relies on', () => {
    expect(VALID_VERDICTS).toEqual(new Set(['stay', 'move', 'skill', 'delete']));
  });

  it('treats a missing entries key as an empty plan rather than throwing', () => {
    const result = checkPlanInvariant({ ruleIds: ['a'] });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['a']);
  });

  it('treats a missing ruleIds key as an empty source rather than throwing', () => {
    const result = checkPlanInvariant({ entries: [entry('a', 'stay')] });
    expect(result.ok).toBe(false);
    expect(result.unknown).toEqual(['a']);
  });
});
