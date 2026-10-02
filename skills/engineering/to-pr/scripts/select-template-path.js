// @ts-check

/**
 * @typedef {{ github: string[], root: string[], docs: string[] }} FolderListings
 */

const TEMPLATE_NAMES = ['pull_request_template.md', 'pull_request_template.txt'];

/**
 * Picks the PR template path the way GitHub does: `.github/`, then the repo root, then
 * `docs/`, matching `pull_request_template.md` or `.txt` in any letter case.
 *
 * @param {FolderListings} listings file names (files only) in each folder
 * @returns {string | null} the chosen path, in the listed case, or null for no match
 */
function selectTemplatePath(listings) {
  const folders = [
    { prefix: '.github/', names: listings.github },
    { prefix: '', names: listings.root },
    { prefix: 'docs/', names: listings.docs },
  ];
  for (const { prefix, names } of folders) {
    const match = names.filter(isTemplateName).sort(byExtensionThenName)[0];
    if (match) return `${prefix}${match}`;
  }
  return null;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isTemplateName(name) {
  return TEMPLATE_NAMES.includes(name.toLowerCase());
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function byExtensionThenName(a, b) {
  const byExtension = TEMPLATE_NAMES.indexOf(a.toLowerCase()) - TEMPLATE_NAMES.indexOf(b.toLowerCase());
  if (byExtension !== 0) return byExtension;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

module.exports = { selectTemplatePath };
