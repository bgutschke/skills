const { classifyBumpSize } = require('./classify-bump-size');

describe('classifyBumpSize', () => {
  it('classifies a major bump', () => {
    expect(classifyBumpSize('1.2.3', '2.0.0')).toBe('major');
  });

  it('classifies a minor bump', () => {
    expect(classifyBumpSize('1.2.3', '1.3.0')).toBe('minor');
  });

  it('classifies a patch bump', () => {
    expect(classifyBumpSize('1.2.3', '1.2.4')).toBe('patch');
  });

  it('tolerates a leading v on either version', () => {
    expect(classifyBumpSize('v1.2.3', 'v1.3.0')).toBe('minor');
  });

  it('classifies as indeterminate when the old version is not semver', () => {
    expect(classifyBumpSize('latest', '1.0.0')).toBe('indeterminate');
  });

  it('classifies as indeterminate when the new version is not semver', () => {
    expect(classifyBumpSize('1.0.0', 'latest')).toBe('indeterminate');
  });

  it('classifies as indeterminate when neither version is semver', () => {
    expect(classifyBumpSize('latest', 'stable')).toBe('indeterminate');
  });
});
