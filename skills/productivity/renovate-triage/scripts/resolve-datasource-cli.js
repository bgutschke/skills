#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const { resolveDatasource } = require('./resolve-datasource');

const USAGE = 'Usage: resolve-datasource-cli.js --file <path> [--file <path> ...]';
const CONFIG_LOCATIONS = ['renovate.json', path.join('.github', 'renovate.json')];

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const files = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file') {
      files.push(argv[i + 1]);
      i += 1;
    }
  }
  return files;
}

/**
 * @returns {string | null}
 */
function readRenovateConfig() {
  const location = CONFIG_LOCATIONS.find((candidate) => fs.existsSync(candidate));
  return location ? fs.readFileSync(location, 'utf8') : null;
}

const files = parseArgs(process.argv.slice(2));
if (files.length === 0) {
  console.error(USAGE);
  process.exit(1);
}

const result = resolveDatasource(readRenovateConfig(), files);

console.log(JSON.stringify(result, null, 2));
