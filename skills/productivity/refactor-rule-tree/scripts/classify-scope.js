// @ts-check

// A rule-file's edit-authority scope is decided by where it was cited as living, not by
// its real, possibly-symlinked target — a dotfiles-managed personal rule file resolves
// through a symlink into a completely different directory, and classifying the
// canonicalized path instead would report it project-scoped, or scopeless, depending on
// where the dotfiles repo happens to sit. Callers pass the pre-realpath path in.
const path = require('path');

/** @typedef {'personal' | 'project' | 'external'} Scope */

// The config directory takes precedence over project detection: both scopes are defined by
// location, not by whether the location happens to be under version control (see the
// Personal/Project rule file glossary this pass reuses), and `configDir` is a fixed,
// specific marker rather than the whole home directory — a project checked out elsewhere
// under $HOME (the common case; see the worked example's own repository) is never nested
// inside it, so checking `configDir` first costs that case nothing. Checking `projectRoot`
// first instead would get this backwards for a very real setup: a dotfiles-managed
// `$CLAUDE_CONFIG_DIR` that is itself a git repository would then classify every file in it,
// including the personal root, as project scope purely because a `.git` sits above it.
/**
 * @param {{ path: string, configDir: string, projectRoot: string | null }} params
 * @returns {Scope}
 */
function classifyScope({ path: candidatePath, configDir, projectRoot }) {
  if (isUnderDir(candidatePath, configDir)) return 'personal';
  if (projectRoot && isUnderDir(candidatePath, projectRoot)) return 'project';
  return 'external';
}

// A candidate outside both known roots is never assumed in scope — an unclassifiable
// candidate is exactly the case decideEditAuthority's "external" test guards against, and
// treating it as a crossing rather than a pass is deliberate, not an oversight.
/**
 * @param {{ rootScope: Scope, candidateScope: Scope }} params
 * @returns {{ editable: boolean, scopeCrossing: boolean }}
 */
function decideEditAuthority({ rootScope, candidateScope }) {
  return rootScope === candidateScope ? { editable: true, scopeCrossing: false } : { editable: false, scopeCrossing: true };
}

/**
 * @param {string} candidatePath
 * @param {string} dirPath
 * @returns {boolean}
 */
function isUnderDir(candidatePath, dirPath) {
  const resolvedDir = path.resolve(dirPath);
  const resolvedCandidate = path.resolve(candidatePath);
  if (resolvedCandidate === resolvedDir) return true;
  const relative = path.relative(resolvedDir, resolvedCandidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = { classifyScope, decideEditAuthority };
