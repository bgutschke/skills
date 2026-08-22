const { syncPluginVersion } = require('./sync-plugin-version');

describe('syncPluginVersion', () => {
  it('bumps the version field to the given version', () => {
    const input = JSON.stringify({ name: 'skills', version: '0.1.0' });

    const result = syncPluginVersion(input, '0.2.0');

    expect(JSON.parse(result).version).toBe('0.2.0');
  });

  it('preserves every other field, including the skills array, untouched', () => {
    const plugin = {
      name: 'skills',
      version: '0.1.0',
      description: 'Personal agent skills for real engineering.',
      author: { name: 'bgutschke', url: 'https://github.com/bgutschke' },
      repository: 'https://github.com/bgutschke/skills',
      license: 'MIT',
      keywords: ['engineering', 'skills', 'personal'],
      skills: ['./skills/engineering/foo', './skills/productivity/bar'],
    };

    const result = syncPluginVersion(JSON.stringify(plugin), '1.0.0');

    expect(JSON.parse(result)).toEqual({ ...plugin, version: '1.0.0' });
  });

  it('throws explicitly when the input has no version field, rather than a silent no-op', () => {
    const input = JSON.stringify({ name: 'skills' });

    expect(() => syncPluginVersion(input, '1.0.0')).toThrow(/version/i);
  });
});
