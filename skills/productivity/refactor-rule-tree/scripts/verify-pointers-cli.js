#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyPointer } = require('./classify-pointer');
const { generateCandidatePaths } = require('./generate-candidate-paths');
const { findPartialPathCompletion } = require('./find-partial-path-completion');

/** @typedef {import('./classify-pointer').PointerKind} PointerKind */
/** @typedef {import('./classify-pointer').Formedness} Formedness */

/**
 * @typedef {{
 *   raw: string,
 *   kind: PointerKind,
 *   path: string,
 *   formedness: Formedness,
 *   reason: string | null,
 *   verdict: 'live' | 'dead' | 'unverifiable',
 *   candidatePaths?: string[],
 *   resolvedTo?: string,
 *   completedPath?: string,
 * }} ResolvedPointer
 */

// Directories that would otherwise flood a repo-wide walk with duplicates of files already
// reachable through their real location — a nested `.git` (including its `worktrees/`
// checkouts) and dependency trees never hold a citation's genuine target.
const EXCLUDED_DIRECTORY_NAMES = new Set(['.git', 'node_modules']);

const USAGE = `Usage:
  verify-pointers-cli.js verify <rootFilePath> <pointers.json>
      Resolve every pointer cited in <rootFilePath>'s prose. <pointers.json> is a JSON
      array of the raw citation strings (as they appear in the text, backticks and \`@\`
      prefix included) that a careful read of the file turned up. Reports one verdict per
      pointer — live, dead, or unverifiable — plus any sibling file in the root file's own
      directory that no live pointer in it ever cites (unrouted). Resolution runs entirely
      through Node's \`fs\`, never a shell \`find\`/\`grep\`, so a hook that rewrites search
      commands can't cause a real file to be reported missing.`;

/**
 * @param {string[]} argv
 * @returns {number}
 */
function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'verify') return verify(rest[0], rest[1]);
  console.error(USAGE);
  return 1;
}

/**
 * @param {string} rootFilePathArg
 * @param {string} pointersPathArg
 * @returns {number}
 */
function verify(rootFilePathArg, pointersPathArg) {
  if (!rootFilePathArg || !pointersPathArg) {
    console.error(USAGE);
    return 1;
  }

  const rootFilePath = path.resolve(rootFilePathArg);
  if (!fs.existsSync(rootFilePath) || !fs.statSync(rootFilePath).isFile()) {
    console.error(`${rootFilePath} does not exist or is not a file.`);
    return 1;
  }

  /** @type {string[]} */
  let rawPointers;
  try {
    rawPointers = JSON.parse(fs.readFileSync(path.resolve(pointersPathArg), 'utf8'));
  } catch (error) {
    console.error(`Could not read or parse ${pointersPathArg} as JSON: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const citingFileDir = path.dirname(rootFilePath);
  const repoRoot = findRepoRoot(citingFileDir) ?? citingFileDir;
  const homeDir = os.homedir();
  // `||`, not `??`, matches this skill's own resolve-root convention (plan-invariant-cli.js):
  // an exported-but-blank value is not a real override either, so it must fall through to
  // the default the same as an unset one. Every name classify-pointer.js recognizes as a
  // known harness variable needs an entry here — an unrecognized one is deliberately left
  // unverifiable, but a recognized one that isn't actually wired up here would silently
  // fail to expand and come back a false "dead", exactly the failure this verdict exists to
  // prevent.
  const env = {
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude'),
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR || repoRoot,
  };
  const knownPaths = listRepoFiles(repoRoot);

  const pointers = rawPointers.map((raw) => resolvePointer(raw, { citingFileDir, repoRoot, homeDir, env, knownPaths }));
  const unrouted = findUnrouted(citingFileDir, rootFilePath, pointers);

  console.log(JSON.stringify({ pointers, unrouted }, null, 2));
  return 0;
}

/**
 * @param {string} raw
 * @param {{ citingFileDir: string, repoRoot: string, homeDir: string, env: Record<string, string>, knownPaths: string[] }} context
 * @returns {ResolvedPointer}
 */
function resolvePointer(raw, { citingFileDir, repoRoot, homeDir, env, knownPaths }) {
  const classification = classifyPointer(raw);
  if (classification.formedness === 'unverifiable') {
    return { raw, ...classification, verdict: 'unverifiable' };
  }

  const candidatePaths = generateCandidatePaths(classification.path, { citingFileDir, repoRoot, homeDir, env });
  const resolvedTo = candidatePaths.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (resolvedTo) {
    return { raw, ...classification, verdict: 'live', candidatePaths, resolvedTo };
  }

  const completion = findPartialPathCompletion(classification.path, knownPaths);
  if (completion) {
    return {
      raw,
      ...classification,
      reason: 'partial-path',
      verdict: 'unverifiable',
      candidatePaths,
      completedPath: path.join(repoRoot, completion),
    };
  }

  return { raw, ...classification, verdict: 'dead', candidatePaths };
}

// "Unrouted" is scoped to the root file's own directory, matching this pass's single-file
// bound (see SKILL.md) — a pass that doesn't traverse can't know about a target that exists
// only two directories over, but it can know about one sitting right beside the file it read.
/**
 * @param {string} citingFileDir
 * @param {string} rootFilePath
 * @param {ResolvedPointer[]} pointers
 * @returns {string[]}
 */
function findUnrouted(citingFileDir, rootFilePath, pointers) {
  const liveTargets = new Set(
    pointers
      .filter((pointer) => pointer.verdict === 'live')
      .map((pointer) => fs.realpathSync(/** @type {string} */ (pointer.resolvedTo))),
  );
  const canonicalRoot = fs.realpathSync(rootFilePath);

  return fs
    .readdirSync(citingFileDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, real: fs.realpathSync(path.join(citingFileDir, entry.name)) }))
    .filter(({ real }) => real !== canonicalRoot && !liveTargets.has(real))
    .map(({ name }) => name);
}

/**
 * @param {string} startDir
 * @returns {string | null}
 */
function findRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
function listRepoFiles(repoRoot) {
  /** @type {string[]} */
  const results = [];
  walk(repoRoot);
  return results;

  /**
   * @param {string} directory
   * @returns {void}
   */
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORY_NAMES.has(entry.name)) continue;
        walk(path.join(directory, entry.name));
      } else if (entry.isFile()) {
        results.push(path.relative(repoRoot, path.join(directory, entry.name)).split(path.sep).join('/'));
      }
    }
  }
}

process.exit(main(process.argv.slice(2)));
