#!/usr/bin/env node
// A citation hit from Step 4's Grep sweep never arrives via a walk edge — that's the whole
// point of searching for it — so walk-tree-cli.js's `visit`, which needs a parent node
// already in the walk state, can't classify it. This wraps the same two pure modules `visit`
// itself calls (classify-scope.js, classify-node.js) for a hit that stands on its own.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyScope, decideEditAuthority } = require('./classify-scope');
const { classifyNode } = require('./classify-node');

const USAGE = `Usage:
  classify-citation-hit-cli.js classify <rootScope> <hitPath>
      Classify one inbound-citation hit Step 4's Grep sweep turned up: its own scope
      (classify-scope.js, against the same config-directory/project-root pair Step 2's walk
      uses) and its node class (classify-node.js). <rootScope> is the scope this pass's own
      root fixed at Step 2's \`init\` — "personal" or "project". Reports \`editable\`: true only
      when the hit's scope matches <rootScope> and its class isn't resolve-only — a skill's
      SKILL.md, an agent or command file, code, or configuration is never edited by this pass
      regardless of scope, and a scope mismatch is the same crossing Step 2 already refuses
      to open.`;

function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'classify') return classify(rest[0], rest[1]);
  console.error(USAGE);
  return 1;
}

function classify(rootScopeArg, hitPathArg) {
  if (!rootScopeArg || !hitPathArg) {
    console.error(USAGE);
    return 1;
  }
  if (rootScopeArg !== 'personal' && rootScopeArg !== 'project') {
    console.error(`Root scope must be "personal" or "project", got "${rootScopeArg}".`);
    return 1;
  }
  const hitPath = path.resolve(hitPathArg);
  if (!fs.existsSync(hitPath) || !fs.statSync(hitPath).isFile()) {
    console.error(`${hitPath} does not exist or is not a file.`);
    return 1;
  }

  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const projectRoot = findRepoRoot(path.dirname(hitPath));
  const scope = classifyScope({ path: hitPath, configDir, projectRoot });
  // isAutoLoaded is irrelevant to editability: it only decides restructurable versus
  // verify-only, a split classifyNode resolves after the resolve-only check this command
  // actually cares about, so a fixed `false` never changes the class this reports.
  const classification = classifyNode({ path: hitPath, isAutoLoaded: false });
  const { editable: scopeEditable } = decideEditAuthority({ rootScope: rootScopeArg, candidateScope: scope });

  console.log(JSON.stringify({
    path: hitPath,
    scope,
    class: classification.class,
    reason: classification.reason,
    editable: scopeEditable && classification.class !== 'resolve-only',
  }, null, 2));
  return 0;
}

function findRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

process.exit(main(process.argv.slice(2)));
