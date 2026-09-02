const path = require('path');

// The defined resolution order: a citation is most likely relative to the file that makes
// it, next most likely anchored at the repository the file lives in, and only least likely
// meant relative to the user's home directory — checking in any other order would report a
// path as dead before the candidate that would have actually resolved was ever tried.
function generateCandidatePaths(rawPath, { citingFileDir, repoRoot, homeDir, env = {} } = {}) {
  const expanded = expandVariables(rawPath, { homeDir, env });

  if (path.isAbsolute(expanded)) {
    return [path.normalize(expanded)];
  }

  const seen = new Set();
  const candidates = [];
  for (const root of [citingFileDir, repoRoot, homeDir]) {
    if (!root) continue;
    const candidate = path.resolve(root, expanded);
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    candidates.push(candidate);
  }
  return candidates;
}

// Only ever called on a path classify-pointer has already confirmed carries no unrecognized
// variable, so every substitution below is expected to succeed; an unmatched name is left
// untouched rather than thrown on, since a caller resolving a raw path directly (bypassing
// classification, e.g. in a test) should get back something inspectable, not a crash.
function expandVariables(rawPath, { homeDir, env = {} }) {
  let result = rawPath;
  if (result === '~' || result.startsWith('~/')) {
    result = path.join(homeDir, result.slice(1));
  }
  return result.replace(VARIABLE_REFERENCE, (match, name) => {
    if (name === 'HOME') return homeDir;
    if (Object.prototype.hasOwnProperty.call(env, name) && env[name]) return env[name];
    return match;
  });
}

const VARIABLE_REFERENCE = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g;

module.exports = { generateCandidatePaths, expandVariables };
