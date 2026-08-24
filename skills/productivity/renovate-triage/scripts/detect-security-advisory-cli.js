#!/usr/bin/env node
const fs = require('fs');
const { detectSecurityAdvisory } = require('./detect-security-advisory');

const [changelogFile] = process.argv.slice(2);
if (!changelogFile) {
  console.error('Usage: detect-security-advisory-cli.js <changelog-file>');
  process.exit(1);
}

let changelogText;
try {
  changelogText = fs.readFileSync(changelogFile, 'utf8');
} catch (error) {
  console.error(`Could not read changelog file "${changelogFile}": ${error.message}`);
  process.exit(1);
}

console.log(JSON.stringify(detectSecurityAdvisory(changelogText), null, 2));
