#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkPlanInvariant } = require('./plan-invariant');

const USAGE = `Usage:
  plan-invariant-cli.js resolve-root [path]
      Resolve the pass's root rule file. With no path, defaults to the personal global
      rule file (\`$CLAUDE_CONFIG_DIR/CLAUDE.md\`, falling back to \`~/.claude/CLAUDE.md\`
      when that variable is unset). Reports whether the resolved file exists and lists the
      other files already sitting beside it, so a proposed topic-file name can be checked
      for a collision without a second read.

  plan-invariant-cli.js check-plan <plan.json>
      Check the plan invariant against a JSON file shaped
      { "ruleIds": [...], "entries": [{ "ruleId": ..., "verdict": ... }, ...] }.
      Exits non-zero the moment the invariant fails — that exit code is what blocks
      execution; a failing check must never be treated as advisory.`;

/**
 * @param {string[]} argv
 * @returns {number}
 */
function main(argv) {
  const [command, ...rest] = argv;
  // A given path is distinguished from "no argument" by strict absence (`undefined`),
  // never by truthiness — an explicit empty string is still an argument the caller passed,
  // not license to fall back to the default root as though nothing had been given.
  if (command === 'resolve-root') return resolveRoot(rest[0] !== undefined ? rest[0] : null);
  if (command === 'check-plan') return checkPlan(rest[0] ?? null);
  console.error(USAGE);
  return 1;
}

/**
 * @param {string | null} givenPath
 * @returns {number}
 */
function resolveRoot(givenPath) {
  const root = givenPath !== null ? path.resolve(givenPath) : defaultRoot();
  const exists = fs.existsSync(root) && fs.statSync(root).isFile();
  console.log(JSON.stringify({
    root,
    source: givenPath !== null ? 'argument' : 'default',
    exists,
    siblingFiles: exists ? readSiblingNames(path.dirname(root), root) : [],
  }, null, 2));
  return exists ? 0 : 1;
}

// An explicit CLAUDE_CONFIG_DIR always wins, matching this repo's other rule-aware skills
// — a machine that relocated its Claude Code config directory still resolves to the right
// personal rule file, rather than one hardcoded to the caller's home directory. `||`
// rather than `??` is deliberate: an exported-but-blank CLAUDE_CONFIG_DIR is not a real
// override either, so it must fall through to the default the same as an unset one.
/**
 * @returns {string}
 */
function defaultRoot() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'CLAUDE.md');
}

// Sibling entries are compared by realpath rather than by the joined string, so the root
// still excludes itself on a case-insensitive filesystem (the macOS/APFS default) even when
// the resolved root's case doesn't exactly match the name `readdirSync` reports back.
/**
 * @param {string} directory
 * @param {string} root
 * @returns {string[]}
 */
function readSiblingNames(directory, root) {
  const canonicalRoot = fs.realpathSync(root);
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && fs.realpathSync(path.join(directory, entry.name)) !== canonicalRoot)
    .map((entry) => entry.name);
}

/**
 * @param {string | null} planPath
 * @returns {number}
 */
function checkPlan(planPath) {
  if (!planPath) {
    console.error(USAGE);
    return 1;
  }
  /** @type {any} */
  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  } catch (error) {
    console.error(`Could not read or parse ${planPath} as JSON: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const result = checkPlanInvariant(plan);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
