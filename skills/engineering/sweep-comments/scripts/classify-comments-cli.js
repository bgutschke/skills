#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const { classifyDiff, classifyFile } = require('./classify-comments');

const USAGE = [
  'Usage: git diff <base> | classify-comments-cli.js',
  '       classify-comments-cli.js <file>...',
  'Prints one JSON array of comment records.',
].join('\n');

if (process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

const syntaxTable = JSON.parse(fs.readFileSync(path.join(__dirname, 'comment-syntax.json'), 'utf8'));
const files = process.argv.slice(2);
const records =
  files.length === 0
    ? classifyDiff(fs.readFileSync(0, 'utf8'), syntaxTable)
    : files.flatMap((file) => classifyFile(file, fs.readFileSync(file, 'utf8'), syntaxTable));
console.log(JSON.stringify(records, null, 2));
