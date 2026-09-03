#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const { resolveCommitConvention } = require('./resolve-commit-convention');

const USAGE = 'Usage: resolve-commit-convention-cli.js [--commitlint-config-file <path>] [--doc-file <path>] [--subject <line> ...]';

/**
 * @param {string[]} argv
 * @returns {{ commitlintConfigFile: string | null, docFile: string | null, subjects: string[] }}
 */
function parseArgs(argv) {
  let commitlintConfigFile = null;
  let docFile = null;
  /** @type {string[]} */
  const subjects = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--commitlint-config-file') {
      commitlintConfigFile = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--doc-file') {
      docFile = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--subject') {
      subjects.push(argv[i + 1]);
      i += 1;
    }
  }
  return { commitlintConfigFile, docFile, subjects };
}

/**
 * @param {string | null} filePath
 * @returns {import('./resolve-commit-convention').CommitlintConfig | null}
 */
function readCommitlintConfig(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string | null} filePath
 * @returns {string | null}
 */
function readDocText(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

const { commitlintConfigFile, docFile, subjects } = parseArgs(process.argv.slice(2));
if (process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

const result = resolveCommitConvention(readCommitlintConfig(commitlintConfigFile), readDocText(docFile), subjects);

console.log(JSON.stringify(result, null, 2));
