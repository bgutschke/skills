import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const releaseConfig = require('../release.config.js');
const { generateNotes } = await import('@semantic-release/release-notes-generator');

const [, pluginConfig] = releaseConfig.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/release-notes-generator'
);

const fixtureSubject = 'fix(engineering): example fix for the notes smoke test';
const notes = await generateNotes(pluginConfig, {
  commits: [
    {
      hash: 'a1111111111111111111111111111111111111',
      message: fixtureSubject,
      subject: fixtureSubject,
      body: '',
      committerDate: new Date(0).toISOString(),
    },
  ],
  lastRelease: { version: '1.0.0', gitTag: 'v1.0.0' },
  nextRelease: { version: '1.0.1', gitTag: 'v1.0.1', type: 'patch' },
  logger: { log: () => {}, error: console.error },
  options: { repositoryUrl: 'https://github.com/bgutschke/skills.git' },
  env: {},
});

// Guards against a preset/writer version mismatch silently dropping the commit list and
// leaving only the version header (see conventional-changelog/conventional-changelog#1495).
if (!notes.includes(fixtureSubject.slice('fix(engineering): '.length))) {
  console.error('release-notes-generator produced no commit content for a fix commit:');
  console.error(notes);
  process.exit(1);
}

console.log('release-notes-generator: commit content renders correctly.');
