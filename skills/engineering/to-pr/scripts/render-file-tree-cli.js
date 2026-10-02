#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const { renderFileTree } = require('./render-file-tree');

const USAGE = 'Usage: git diff --name-status <base>...HEAD | render-file-tree-cli.js';

if (process.argv.includes('--help')) {
  console.error(USAGE);
  process.exit(1);
}

const tree = renderFileTree(fs.readFileSync(0, 'utf8'));
if (tree) console.log(tree);
