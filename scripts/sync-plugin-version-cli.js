#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const { syncPluginVersion } = require('./sync-plugin-version');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: sync-plugin-version-cli.js <new-version>');
  process.exit(1);
}

const pluginJsonPath = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
const content = fs.readFileSync(pluginJsonPath, 'utf8');
fs.writeFileSync(pluginJsonPath, syncPluginVersion(content, newVersion));
