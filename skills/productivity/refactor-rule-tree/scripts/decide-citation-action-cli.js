#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { decideCitationAction } = require('./decide-citation-action');

const USAGE = `Usage:
  decide-citation-action-cli.js decide <citations.json>
      Decide move, update, or block for one rule's inbound citations. <citations.json> is a
      JSON array of { "citingPath": ..., "editable": ... } — one entry per file a scope- and
      class-classified search turned up as citing the rule's current node by path. Prints
      "move" (no citations found), "update" (every citation sits in a file this pass may
      edit, each one to be updated in the same change as the move), or "blocked" (at least
      one citation sits in a file this pass may not edit, naming every one that does).`;

function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'decide') return decide(rest[0] ?? null);
  console.error(USAGE);
  return 1;
}

function decide(citationsPath) {
  if (!citationsPath) {
    console.error(USAGE);
    return 1;
  }
  let citations;
  try {
    citations = JSON.parse(fs.readFileSync(path.resolve(citationsPath), 'utf8'));
  } catch (error) {
    console.error(`Could not read or parse ${citationsPath} as JSON: ${error.message}`);
    return 1;
  }
  const result = decideCitationAction({ citations });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

process.exit(main(process.argv.slice(2)));
