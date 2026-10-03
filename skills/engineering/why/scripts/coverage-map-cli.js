#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const { buildCoverageMap } = require('./build-coverage-map');

const SOURCES_FILE = path.join(__dirname, 'evidence-sources.json');

try {
  const names = fs
    .readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const patterns = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  console.log(JSON.stringify(buildCoverageMap(names, patterns)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
