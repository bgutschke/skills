#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const { extractOciSourceLabel } = require('./extract-oci-source-label');

const USAGE = 'Usage: extract-oci-source-label-cli.js --labels-file <path>';

/**
 * @param {string[]} argv
 * @returns {{ labelsFile: string | undefined }}
 */
function parseArgs(argv) {
  /** @type {string | undefined} */
  let labelsFile;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--labels-file') {
      labelsFile = argv[i + 1];
      i += 1;
    }
  }
  return { labelsFile };
}

const { labelsFile } = parseArgs(process.argv.slice(2));
if (!labelsFile) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {Record<string, string>} */
let labels;
try {
  labels = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
} catch (error) {
  console.error(`Could not read labels file: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const result = extractOciSourceLabel(labels);

console.log(JSON.stringify(result, null, 2));
