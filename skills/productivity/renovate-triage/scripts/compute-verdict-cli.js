#!/usr/bin/env node
// @ts-check
const { classifyBumpSize } = require('./classify-bump-size');
const { computeVerdict } = require('./compute-verdict');

/** @typedef {import('./compute-verdict').CiStatus} CiStatus */

const CI_STATUSES = ['passing', 'pending', 'failing'];
const USAGE = 'Usage: compute-verdict-cli.js --old-version <v> --new-version <v> --changelog-found <true|false> --breaking-callout <true|false> --ci-status <passing|pending|failing> --blast-radius-large <true|false>';

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['old-version', 'new-version', 'changelog-found', 'breaking-callout', 'ci-status', 'blast-radius-large']) {
  if (args[required] === undefined) {
    console.error(USAGE);
    console.error(`Missing --${required}`);
    process.exit(1);
  }
}
if (!CI_STATUSES.includes(args['ci-status'])) {
  console.error(USAGE);
  console.error(`--ci-status must be one of ${CI_STATUSES.join(', ')}, got "${args['ci-status']}"`);
  process.exit(1);
}

const bumpSize = classifyBumpSize(args['old-version'], args['new-version']);
const result = computeVerdict({
  bumpSize,
  changelogFound: args['changelog-found'] === 'true',
  relevantBreakingChangeCallout: args['breaking-callout'] === 'true',
  ciStatus: /** @type {CiStatus} */ (args['ci-status']),
  blastRadiusLarge: args['blast-radius-large'] === 'true',
});

console.log(JSON.stringify({ bumpSize, ...result }, null, 2));
