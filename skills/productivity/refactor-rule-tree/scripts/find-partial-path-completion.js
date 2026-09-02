// A partial-path citation (missing leading directory segments) still names a real file once
// it's checked as a suffix of every path the repository actually contains — but only when
// exactly one file matches. More than one match means the citation is genuinely ambiguous,
// and guessing which one was meant is worse than reporting it unresolved: the whole reason
// this verdict exists is so a confirmation gate is never asked to approve deleting something
// that was actually correct.
function findPartialPathCompletion(rawPath, knownPaths = []) {
  const normalizedRaw = String(rawPath).replace(/^\.\//, '').replace(/\\/g, '/');
  const suffix = `/${normalizedRaw}`;

  const matches = knownPaths.filter((knownPath) => knownPath === normalizedRaw || knownPath.endsWith(suffix));
  return matches.length === 1 ? matches[0] : null;
}

module.exports = { findPartialPathCompletion };
