#!/usr/bin/env node
// @ts-check
const { execFileSync } = require('child_process');
const { resolveTemplateLookup } = require('./select-template-path');

const USAGE = 'Usage: gather-template-path-cli.js --repo <owner/repo> --ref <base>';
const MAX_BUFFER = 16 * 1024 * 1024;

/**
 * @param {string[]} argv
 * @returns {{ repo: string | undefined, ref: string | undefined }}
 */
function parseArgs(argv) {
  return { repo: valueAfter(argv, '--repo'), ref: valueAfter(argv, '--ref') };
}

/**
 * @param {string[]} argv
 * @param {string} flag
 * @returns {string | undefined}
 */
function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

/**
 * @param {string} repo
 * @param {string} folder empty for the repo root
 * @param {string} ref
 * @returns {import('./select-template-path').ListingOutcome}
 */
function listFolder(repo, folder, ref) {
  const path = folder ? `repos/${repo}/contents/${folder}` : `repos/${repo}/contents`;
  try {
    return {
      stdout: execFileSync('gh', ['api', `${path}?ref=${encodeURIComponent(ref)}`], {
        encoding: 'utf8',
        maxBuffer: MAX_BUFFER,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
  } catch (error) {
    const failure = /** @type {{ stderr?: string, message: string }} */ (error);
    // An empty stderr carries no reason, so it must fall through to the message too.
    return { stderr: failure.stderr || failure.message };
  }
}

const { repo, ref } = parseArgs(process.argv.slice(2));
if (process.argv.includes('--help') || !repo || !ref) {
  console.error(USAGE);
  process.exit(1);
}

try {
  const lookup = resolveTemplateLookup({
    github: listFolder(repo, '.github', ref),
    root: listFolder(repo, '', ref),
    docs: listFolder(repo, 'docs', ref),
  });
  console.log(JSON.stringify(lookup));
} catch (error) {
  console.error(`Template lookup failed for ${repo} at ${ref}: ${/** @type {Error} */ (error).message}`);
  process.exit(1);
}
