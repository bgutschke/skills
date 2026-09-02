#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const { extractUpstreamRepo } = require('./extract-upstream-repo');

const USAGE = 'Usage: extract-upstream-repo-cli.js --packaging-repo <owner/repo> --file <path> [--file <path> ...]';

/**
 * @param {string[]} argv
 * @returns {{ packagingRepo: string | undefined, files: string[] }}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const files = [];
  /** @type {string | undefined} */
  let packagingRepo;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--packaging-repo') {
      packagingRepo = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--file') {
      files.push(argv[i + 1]);
      i += 1;
    }
  }
  return { packagingRepo, files };
}

const { packagingRepo, files } = parseArgs(process.argv.slice(2));
if (!packagingRepo || files.length === 0) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {string} */
let content;
try {
  content = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
} catch (error) {
  console.error(`Could not read file: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const result = extractUpstreamRepo(packagingRepo, content);

console.log(JSON.stringify(result, null, 2));
