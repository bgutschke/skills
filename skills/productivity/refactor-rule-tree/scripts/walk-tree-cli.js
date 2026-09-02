#!/usr/bin/env node
// Everything here is filesystem-touching by nature — canonicalizing a path, listing git
// worktrees, persisting visited state between separate `node` invocations — so none of it
// sits behind classify-node.js's pure, tested boundary. It is exercised by the worked
// example instead (see SKILL.md), the same split this skill already uses for pointer
// resolution in verify-pointers-cli.js.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { classifyNode, shouldWalkOnward } = require('./classify-node');

// Matches verify-pointers-cli.js's own exclusion set: a nested `.git` (including its
// `worktrees/` checkouts) and a dependency tree never hold a citation's genuine target, so
// walking into either would just double-report whatever the real location already found.
const EXCLUDED_DIRECTORY_NAMES = new Set(['.git', 'node_modules']);

const USAGE = `Usage:
  walk-tree-cli.js init <statePath> <rootPath>
      Start a walk: canonicalize <rootPath> and seed <statePath> with it as the walk's one
      root node — always restructurable, since Step 1 already resolved it as the file this
      pass was pointed at.

  walk-tree-cli.js visit <statePath> <parentRealPath> <resolvedPath> <import|mention>
      Advance the walk by one edge. <resolvedPath> is a pointer's already-resolved target —
      the \`resolvedTo\` a \`live\` verdict from verify-pointers-cli.js already computed, not
      a raw citation to re-resolve. Records one of three outcomes in <statePath>:
        - excluded: the target sits inside a worktree or dependency directory. Recorded,
          never classified, never walked onward.
        - alreadyVisited: the target's real path is already in the state — a cycle or a
          diamond. No new node, so nothing is ever reported twice.
        - a new node: classified by classify-node.js from the edge kind and the parent's
          own auto-loaded status (an import edge only carries auto-load through when the
          parent was itself auto-loaded — a file merely mentioned doesn't get its own
          imports auto-loaded just because something opened it). A resolve-only result
          carries shouldWalkOnward: false; every other class carries true.

  walk-tree-cli.js report <statePath>
      Print every node and every excluded path the walk has recorded so far.`;

function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'init') return init(rest[0], rest[1]);
  if (command === 'visit') return visit(rest[0], rest[1], rest[2], rest[3]);
  if (command === 'report') return report(rest[0]);
  console.error(USAGE);
  return 1;
}

function init(statePathArg, rootPathArg) {
  if (!statePathArg || !rootPathArg) {
    console.error(USAGE);
    return 1;
  }
  const rootPath = path.resolve(rootPathArg);
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isFile()) {
    console.error(`${rootPath} does not exist or is not a file.`);
    return 1;
  }

  const canonicalRoot = fs.realpathSync(rootPath);
  const rootNode = {
    path: canonicalRoot,
    class: 'restructurable',
    reason: null,
    edgeFromParent: null,
    autoLoaded: true,
    shouldWalkOnward: true,
  };
  writeState(path.resolve(statePathArg), { root: canonicalRoot, nodes: { [canonicalRoot]: rootNode }, excluded: [] });
  console.log(JSON.stringify({ root: canonicalRoot, node: rootNode }, null, 2));
  return 0;
}

function visit(statePathArg, parentPathArg, resolvedPathArg, edgeKindArg) {
  if (!statePathArg || !parentPathArg || !resolvedPathArg || !edgeKindArg) {
    console.error(USAGE);
    return 1;
  }
  if (edgeKindArg !== 'import' && edgeKindArg !== 'mention') {
    console.error(`Edge kind must be "import" or "mention", got "${edgeKindArg}".`);
    return 1;
  }

  const statePath = path.resolve(statePathArg);
  const state = readState(statePath);
  if (!state) {
    console.error(`No walk state at ${statePath} — run "init" first.`);
    return 1;
  }

  const canonicalParent = tryRealpath(parentPathArg);
  if (!canonicalParent) {
    console.error(`Parent path does not resolve: ${parentPathArg}`);
    return 1;
  }
  const parentNode = state.nodes[canonicalParent];
  if (!parentNode) {
    console.error(`${canonicalParent} was never visited — walk from a node this state already knows about.`);
    return 1;
  }

  const canonicalTarget = tryRealpath(resolvedPathArg);
  if (!canonicalTarget) {
    console.error(`Target path does not resolve to a real file: ${resolvedPathArg}`);
    return 1;
  }

  // Anchored at the walk's own root, never at the target being visited: a target that
  // happens to sit inside another worktree has its own `.git` file (worktrees keep one,
  // pointing back at the main checkout), so searching upward from the target would find
  // that worktree's checkout and mistake it for the main one — silently exempting the very
  // directory this check exists to exclude.
  const repoRoot = findRepoRoot(path.dirname(state.root)) ?? path.dirname(state.root);
  if (isExcludedPath(canonicalTarget, listWorktreePaths(repoRoot))) {
    state.excluded = dedupeByPath([...state.excluded, { path: canonicalTarget, edgeFromParent: edgeKindArg }]);
    writeState(statePath, state);
    console.log(JSON.stringify({ path: canonicalTarget, excluded: true, alreadyVisited: false, node: null }, null, 2));
    return 0;
  }

  if (state.nodes[canonicalTarget]) {
    console.log(
      JSON.stringify({ path: canonicalTarget, excluded: false, alreadyVisited: true, node: state.nodes[canonicalTarget] }, null, 2),
    );
    return 0;
  }

  const autoLoaded = edgeKindArg === 'import' && parentNode.autoLoaded;
  const classification = classifyNode({ path: canonicalTarget, isAutoLoaded: autoLoaded });
  const node = {
    path: canonicalTarget,
    class: classification.class,
    reason: classification.reason,
    edgeFromParent: edgeKindArg,
    autoLoaded,
    shouldWalkOnward: shouldWalkOnward(classification.class),
  };
  state.nodes[canonicalTarget] = node;
  writeState(statePath, state);
  console.log(JSON.stringify({ path: canonicalTarget, excluded: false, alreadyVisited: false, node }, null, 2));
  return 0;
}

function report(statePathArg) {
  if (!statePathArg) {
    console.error(USAGE);
    return 1;
  }
  const statePath = path.resolve(statePathArg);
  const state = readState(statePath);
  if (!state) {
    console.error(`No walk state at ${statePath}.`);
    return 1;
  }
  console.log(JSON.stringify({ root: state.root, nodes: Object.values(state.nodes), excluded: state.excluded }, null, 2));
  return 0;
}

function tryRealpath(candidatePath) {
  try {
    return fs.realpathSync(path.resolve(candidatePath));
  } catch {
    return null;
  }
}

function readState(statePath) {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(statePath, state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function dedupeByPath(entries) {
  const seen = new Set();
  return entries.filter((entry) => (seen.has(entry.path) ? false : seen.add(entry.path)));
}

function isExcludedPath(canonicalPath, worktreePaths) {
  if (canonicalPath.split(path.sep).some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment))) return true;
  return worktreePaths.some((worktreePath) => canonicalPath === worktreePath || canonicalPath.startsWith(worktreePath + path.sep));
}

// A worktree's own checkout is never itself excluded — only the *other* duplicated
// checkouts a walk could wander into are. `git worktree list` is the source of truth for
// where those live; a name-based guess (like the `.git`/`node_modules` set above) can't
// cover an arbitrary sibling directory a tool such as `git worktree add` may have created.
function listWorktreePaths(repoRoot) {
  try {
    const output = execFileSync('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const mainWorktree = tryRealpath(repoRoot);
    return output
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => tryRealpath(line.slice('worktree '.length).trim()))
      .filter((worktreePath) => worktreePath && worktreePath !== mainWorktree);
  } catch {
    return [];
  }
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
