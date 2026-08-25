const { extractReleaseNotesFromPrBody } = require('./extract-release-notes-from-pr-body');

describe('extractReleaseNotesFromPrBody', () => {
  it('resolves found with the itemized release notes text', () => {
    const prBody = [
      '### Release Notes',
      '',
      '<details>',
      '<summary>adinhodovic/tailscale-exporter (adinhodovic/tailscale-exporter)</summary>',
      '',
      '### [`v0.7.0`](https://github.com/adinhodovic/tailscale-exporter/releases/tag/v0.7.0)',
      '',
      '[Compare Source](https://github.com/adinhodovic/tailscale-exporter/compare/v0.6.1...v0.7.0)',
      '',
      '#### Features',
      '',
      '- add device tag labels',
      '',
      '</details>',
    ].join('\n');

    const result = extractReleaseNotesFromPrBody(prBody, 'adinhodovic/tailscale-exporter');

    expect(result.status).toBe('found');
    expect(result.text).toContain('#### Features');
    expect(result.text).toContain('add device tag labels');
  });

  it('resolves compare-link-only when the section has nothing but the Compare Source link', () => {
    const prBody = [
      '### Release Notes',
      '',
      '<details>',
      '<summary>prom/prometheus (prom/prometheus)</summary>',
      '',
      '### [`v2.54.0`](https://github.com/prometheus/prometheus/releases/tag/v2.54.0)',
      '',
      '[Compare Source](https://github.com/prometheus/prometheus/compare/v2.53.0...v2.54.0)',
      '',
      '</details>',
    ].join('\n');

    const result = extractReleaseNotesFromPrBody(prBody, 'prom/prometheus');

    expect(result).toEqual({ status: 'compare-link-only' });
  });

  it('resolves absent when no section matches the given dependency', () => {
    const prBody = [
      '### Release Notes',
      '',
      '<details>',
      '<summary>prom/prometheus (prom/prometheus)</summary>',
      '',
      '#### Features',
      '',
      '- add feature',
      '',
      '</details>',
    ].join('\n');

    const result = extractReleaseNotesFromPrBody(prBody, 'adinhodovic/tailscale-exporter');

    expect(result).toEqual({ status: 'absent' });
  });

  it('matches each dependency to its own section on a grouped PR', () => {
    const prBody = [
      '### Release Notes',
      '',
      '<details>',
      '<summary>facebook/react (react)</summary>',
      '',
      '#### Features',
      '',
      '- add useEffectEvent',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>vitejs/vite (vite)</summary>',
      '',
      '#### Bug Fixes',
      '',
      '- fix HMR race condition',
      '',
      '</details>',
    ].join('\n');

    const reactResult = extractReleaseNotesFromPrBody(prBody, 'react');
    const viteResult = extractReleaseNotesFromPrBody(prBody, 'vite');

    expect(reactResult.status).toBe('found');
    expect(reactResult.text).toContain('useEffectEvent');
    expect(reactResult.text).not.toContain('HMR race condition');

    expect(viteResult.status).toBe('found');
    expect(viteResult.text).toContain('HMR race condition');
    expect(viteResult.text).not.toContain('useEffectEvent');
  });

  it('never matches a dependency whose name is a substring of another dependency in the group', () => {
    const prBody = [
      '### Release Notes',
      '',
      '<details>',
      '<summary>webpack-contrib/css-webpack-plugin (css-webpack-plugin)</summary>',
      '',
      '#### Features',
      '',
      '- unrelated plugin feature',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>webpack/webpack (webpack)</summary>',
      '',
      '#### Features',
      '',
      '- webpack own feature',
      '',
      '</details>',
    ].join('\n');

    const result = extractReleaseNotesFromPrBody(prBody, 'webpack');

    expect(result.status).toBe('found');
    expect(result.text).toContain('webpack own feature');
    expect(result.text).not.toContain('unrelated plugin feature');
  });
});
