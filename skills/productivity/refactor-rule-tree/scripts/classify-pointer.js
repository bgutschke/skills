// @ts-check

// A hand-rolled resolver that treated every ambiguous shape as a candidate for live/dead
// resolution produced seven false "dead" verdicts against zero true ones on a real
// repository — so anything not a well-formed, fully-qualified path is classified here,
// mechanically, before resolution ever runs, rather than left for a filesystem check to
// misjudge.
const GLOB_PATTERN = /[*?]|\[[^\]]*\]/;
const PLACEHOLDER_PATTERN = /<[^>]+>/;
const EXTENSION_ONLY_PATTERN = /^\.\w+$/;
const VARIABLE_PATTERN = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/;

// The only variables this pass knows how to expand deterministically (see
// generate-candidate-paths.js). Any other `$VAR`-looking token can't be substituted with
// confidence, so it stays unverifiable rather than being resolved against its literal,
// un-expanded text.
const KNOWN_HARNESS_VARIABLES = new Set(['CLAUDE_CONFIG_DIR', 'CLAUDE_PROJECT_DIR', 'HOME']);

// Filenames that recur, unqualified, across many directories in a rule tree — a bare
// mention of one names a family, not one specific file, so it can't be resolved without a
// directory to anchor it.
const FAMILY_FILENAMES = new Set(['CLAUDE.md', 'CLAUDE.local.md', 'SKILL.md', 'README.md', 'AGENTS.md']);

/** @typedef {'import' | 'mention'} PointerKind */
/** @typedef {'well-formed' | 'unverifiable'} Formedness */
/**
 * @typedef {{ kind: PointerKind, path: string, formedness: 'well-formed', reason: null }
 *   | { kind: PointerKind, path: string, formedness: 'unverifiable', reason: string }} PointerClassification
 */

/**
 * @param {string} raw
 * @returns {PointerClassification}
 */
function classifyPointer(raw) {
  const trimmed = String(raw).trim().replace(/^`+|`+$/g, '');
  const kind = trimmed.startsWith('@') ? 'import' : 'mention';
  const pointerPath = kind === 'import' ? trimmed.slice(1) : trimmed;

  if (GLOB_PATTERN.test(pointerPath)) {
    return unverifiable(kind, pointerPath, 'glob');
  }
  if (PLACEHOLDER_PATTERN.test(pointerPath)) {
    return unverifiable(kind, pointerPath, 'placeholder');
  }

  const variableMatch = pointerPath.match(VARIABLE_PATTERN);
  if (variableMatch && !KNOWN_HARNESS_VARIABLES.has(variableMatch[1])) {
    return unverifiable(kind, pointerPath, 'unexpanded-variable');
  }

  // Family-filename and extension-only mentions are only ambiguous in the absence of a
  // directory — the same name qualified with a path (e.g. `docs/CLAUDE.md`) names one file,
  // not a family.
  if (!pointerPath.includes('/')) {
    if (FAMILY_FILENAMES.has(pointerPath)) {
      return unverifiable(kind, pointerPath, 'bare-family-filename');
    }
    if (EXTENSION_ONLY_PATTERN.test(pointerPath)) {
      return unverifiable(kind, pointerPath, 'extension-only');
    }
  }

  // A path missing directory segments (a "partial path") still passes classification here —
  // it is syntactically indistinguishable from an ordinary well-formed relative path.
  // Whether it actually resolves, resolves via a completion, or resolves nowhere is a
  // question for resolution against real candidates, not for this mechanical, text-only pass.
  return { kind, path: pointerPath, formedness: 'well-formed', reason: null };
}

/**
 * @param {PointerKind} kind
 * @param {string} pointerPath
 * @param {string} reason
 * @returns {{ kind: PointerKind, path: string, formedness: 'unverifiable', reason: string }}
 */
function unverifiable(kind, pointerPath, reason) {
  return { kind, path: pointerPath, formedness: 'unverifiable', reason };
}

module.exports = { classifyPointer, FAMILY_FILENAMES, KNOWN_HARNESS_VARIABLES };
