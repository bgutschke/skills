// A rule-tree node's class follows from what kind of thing it is, not its extension: a
// `.md` file reached only by mention is exactly as much prose as one reached by import —
// only the imported one is auto-loaded, and auto-load status alone decides restructurable
// versus verify-only. Extension only ever decides the resolve-only classes below, where the
// content itself, not its load status, is why this pass can't apply prose logic to it.
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.sh', '.bash', '.zsh',
  '.c', '.h', '.cpp', '.hpp',
]);

const CONFIGURATION_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.toml']);

// A memory file is model-written and self-correcting through its own mechanism, not
// hand-authored prose a placement decision applies to — so its index file, and anything
// sitting under a `memory/` directory wherever that directory is rooted, resolve-only.
const MEMORY_INDEX_FILENAME = 'MEMORY.md';
const MEMORY_PATH_SEGMENT = /(^|\/)memory\//i;

function classifyNode({ path: nodePath, isAutoLoaded }) {
  const reason = resolveOnlyReasonFor(nodePath);
  if (reason) {
    return { class: 'resolve-only', reason };
  }
  return { class: isAutoLoaded ? 'restructurable' : 'verify-only', reason: null };
}

// Resolve-only nodes are the walk's dead end: confirmed to exist and never opened for
// findings, so nothing reached only through one is itself walked onward.
function shouldWalkOnward(nodeClass) {
  return nodeClass !== 'resolve-only';
}

function resolveOnlyReasonFor(nodePath) {
  const basename = String(nodePath).split('/').pop();
  if (basename === 'SKILL.md') return 'skill-manifest';
  if (basename === MEMORY_INDEX_FILENAME) return 'memory-file';

  // Extension is checked before the broader `memory/`-directory heuristic below: a real
  // code or configuration file (e.g. `src/memory/cache.ts`, an app's own caching module)
  // is a more specific, more certain signal than a bare path segment, and must win the
  // reason it's reported with even though both land on the same resolve-only class.
  const extension = extensionOf(basename);
  if (CODE_EXTENSIONS.has(extension)) return 'code';
  if (CONFIGURATION_EXTENSIONS.has(extension)) return 'configuration';
  if (MEMORY_PATH_SEGMENT.test(nodePath)) return 'memory-file';
  return null;
}

function extensionOf(basename) {
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex <= 0 ? '' : basename.slice(dotIndex).toLowerCase();
}

module.exports = { classifyNode, shouldWalkOnward, CODE_EXTENSIONS, CONFIGURATION_EXTENSIONS };
