module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'angular' }],
    ['@semantic-release/release-notes-generator', { preset: 'angular' }],
    '@semantic-release/changelog',
    ['@semantic-release/npm', { npmPublish: false }],
    // Owns the `.claude-plugin/plugin.json` version bump directly, rather than pulling in
    // a third-party single-purpose plugin for a one-field sync.
    ['@semantic-release/exec', {
      prepareCmd: 'node scripts/sync-plugin-version-cli.js ${nextRelease.version}',
    }],
    ['@semantic-release/git', {
      // package-lock.json is included because `npm version` (run by @semantic-release/npm
      // above) updates its version field too — omitting it here would leave the committed
      // lockfile permanently out of sync with the package.json version it was generated for.
      assets: ['package.json', 'package-lock.json', '.claude-plugin/plugin.json', 'CHANGELOG.md'],
      // No scope: a version bump touches package.json/plugin.json/CHANGELOG.md at once,
      // which is a repo-wide change per this repo's own scope convention (AGENTS.md).
      message: 'chore: release ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    }],
    '@semantic-release/github',
  ],
};
