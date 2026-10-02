// @ts-check

/**
 * @typedef {'+' | '-'} Marker
 * @typedef {{ folders: Map<string, FolderNode>, files: { name: string, marker: Marker }[] }} FolderNode
 */

const MAX_TREE_LINES = 40;

/**
 * Renders the added, deleted, renamed, and copied files of a diff as a fenced `diff`
 * block, nested by folder. Modified files and other statuses are left out.
 *
 * @param {string} nameStatus raw output of `git diff --name-status <base>...HEAD`
 * @returns {string | null} the fenced block, or null when nothing is structural or the
 *   tree is longer than MAX_TREE_LINES lines
 */
function renderFileTree(nameStatus) {
  const changes = nameStatus.split('\n').flatMap(toStructuralChanges);
  if (changes.length === 0) return null;
  /** @type {FolderNode} */
  const root = emptyFolder();
  for (const { path, marker } of changes) addPath(root, path, marker);
  const treeLines = renderFolder(root, 0);
  if (treeLines.length > MAX_TREE_LINES) return null;
  return ['```diff', ...treeLines, '```'].join('\n');
}

/**
 * @param {string} line
 * @returns {{ path: string, marker: Marker }[]}
 */
function toStructuralChanges(line) {
  const [status, path, target] = line.split('\t');
  const kind = status.charAt(0);
  if (kind === 'A') return [{ path, marker: '+' }];
  if (kind === 'D') return [{ path, marker: '-' }];
  if (kind === 'C') return [{ path: target, marker: '+' }];
  if (kind === 'R') return [{ path, marker: '-' }, { path: target, marker: '+' }];
  return [];
}

/**
 * @returns {FolderNode}
 */
function emptyFolder() {
  return { folders: new Map(), files: [] };
}

/**
 * @param {FolderNode} root
 * @param {string} path
 * @param {Marker} marker
 */
function addPath(root, path, marker) {
  const segments = path.split('/');
  const name = /** @type {string} */ (segments.pop());
  let folder = root;
  for (const segment of segments) {
    const child = folder.folders.get(segment) ?? emptyFolder();
    folder.folders.set(segment, child);
    folder = child;
  }
  folder.files.push({ name, marker });
}

/**
 * @param {FolderNode} folder
 * @param {number} depth
 * @returns {string[]}
 */
function renderFolder(folder, depth) {
  const indent = '  '.repeat(depth);
  const folderLines = [...folder.folders]
    .sort(([a], [b]) => byCodePoint(a, b))
    .flatMap(([name, child]) => [` ${indent}${name}/`, ...renderFolder(child, depth + 1)]);
  const fileLines = [...folder.files]
    .sort((a, b) => byCodePoint(a.name, b.name))
    .map(({ name, marker }) => `${marker}${indent}${name}`);
  return [...folderLines, ...fileLines];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function byCodePoint(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

module.exports = { renderFileTree };
