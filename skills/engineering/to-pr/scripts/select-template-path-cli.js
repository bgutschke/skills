#!/usr/bin/env node
// @ts-check
const { selectTemplatePath } = require('./select-template-path');

const USAGE = 'Usage: select-template-path-cli.js [--github <name> ...] [--root <name> ...] [--docs <name> ...]';

/**
 * @param {string[]} argv
 * @returns {import('./select-template-path').FolderListings}
 */
function parseArgs(argv) {
  /** @type {import('./select-template-path').FolderListings} */
  const listings = { github: [], root: [], docs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--github' && argv[i + 1] !== undefined) {
      listings.github.push(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--root' && argv[i + 1] !== undefined) {
      listings.root.push(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--docs' && argv[i + 1] !== undefined) {
      listings.docs.push(argv[i + 1]);
      i += 1;
    }
  }
  return listings;
}

if (process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

const path = selectTemplatePath(parseArgs(process.argv.slice(2)));
if (path) console.log(path);
