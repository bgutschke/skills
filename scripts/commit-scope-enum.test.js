const { buildScopeEnum } = require('./commit-scope-enum');

describe('buildScopeEnum', () => {
  it('unions skill names with the fixed bucket and maintenance vocabularies', () => {
    const result = buildScopeEnum(['to-pr', 'audit-rules']);

    expect(result).toEqual(
      expect.arrayContaining(['to-pr', 'audit-rules', 'engineering', 'productivity', 'deps', 'config'])
    );
  });

  it('produces no duplicates when a skill happens to share a name with a fixed scope', () => {
    const result = buildScopeEnum(['deps']);

    expect(result.filter((scope) => scope === 'deps')).toHaveLength(1);
  });
});
