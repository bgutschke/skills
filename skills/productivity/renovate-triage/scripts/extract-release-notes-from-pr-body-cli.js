#!/usr/bin/env node
const fs = require('fs');
const { extractReleaseNotesFromPrBody } = require('./extract-release-notes-from-pr-body');

const USAGE = 'Usage: extract-release-notes-from-pr-body-cli.js --body-file <path> --dependency <name>';

function parseArgs(argv) {
  let bodyFile;
  let dependency;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--body-file') {
      bodyFile = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--dependency') {
      dependency = argv[i + 1];
      i += 1;
    }
  }
  return { bodyFile, dependency };
}

const { bodyFile, dependency } = parseArgs(process.argv.slice(2));
if (!bodyFile || !dependency) {
  console.error(USAGE);
  process.exit(1);
}

let prBody;
try {
  prBody = fs.readFileSync(bodyFile, 'utf8');
} catch (error) {
  console.error(`Could not read file: ${error.message}`);
  process.exit(1);
}

const result = extractReleaseNotesFromPrBody(prBody, dependency);

console.log(JSON.stringify(result, null, 2));
