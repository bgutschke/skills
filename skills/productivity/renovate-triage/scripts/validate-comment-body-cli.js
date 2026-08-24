#!/usr/bin/env node
const fs = require('fs');
const { validateCommentBody } = require('./validate-comment-body');

const [verdict, bodyFile] = process.argv.slice(2);
if (!verdict || !bodyFile) {
  console.error('Usage: validate-comment-body-cli.js <verdict> <body-file>');
  process.exit(1);
}

let body;
try {
  body = fs.readFileSync(bodyFile, 'utf8');
} catch (error) {
  console.error(`Could not read body file "${bodyFile}": ${error.message}`);
  process.exit(1);
}

const result = validateCommentBody(body, verdict);

console.log(JSON.stringify(result, null, 2));
if (!result.valid) {
  process.exit(1);
}
