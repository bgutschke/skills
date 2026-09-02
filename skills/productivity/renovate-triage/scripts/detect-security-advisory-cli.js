#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const { detectSecurityAdvisory } = require('./detect-security-advisory');

const [changelogFile] = process.argv.slice(2);
if (!changelogFile) {
  console.error('Usage: detect-security-advisory-cli.js <changelog-file>');
  process.exit(1);
}

/** @type {string} */
let changelogText;
try {
  changelogText = fs.readFileSync(changelogFile, 'utf8');
} catch (error) {
  console.error(`Could not read changelog file "${changelogFile}": ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log(JSON.stringify(detectSecurityAdvisory(changelogText), null, 2));
