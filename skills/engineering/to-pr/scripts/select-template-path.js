// @ts-check

/**
 * @typedef {{ github: string[], root: string[], docs: string[] }} FolderListings
 */

/**
 * @typedef {{ stdout: string } | { stderr: string }} ListingOutcome
 * @typedef {{ name: string, type: string }} ListingEntry
 * @typedef {{ github: ListingOutcome, root: ListingOutcome, docs: ListingOutcome }} ListingOutcomes
 * @typedef {{ template: string | null, glossaries: string[], templateFolder: boolean }} TemplateLookup
 */

const NOT_FOUND = /\(HTTP 404\)\s*$/;
const GLOSSARY_NAMES = ['CONTEXT.md', 'GLOSSARY.md'];
const TEMPLATE_NAMES = ['pull_request_template.md', 'pull_request_template.txt'];
const TEMPLATE_FOLDER_NAME = 'pull_request_template';

/**
 * Decides the template lookup from the raw result of one `gh api` contents call per folder.
 *
 * @param {ListingOutcomes} outcomes
 * @returns {TemplateLookup}
 */
function resolveTemplateLookup(outcomes) {
  const listings = {
    github: listEntries('.github/', outcomes.github, true),
    root: listEntries('root', outcomes.root, false),
    docs: listEntries('docs/', outcomes.docs, true),
  };
  const root = fileNames(listings.root);
  if (root.length === 0) throw new Error('root listing holds no files, so the lookup cannot be trusted');
  return {
    template: selectTemplatePath({ github: fileNames(listings.github), root, docs: fileNames(listings.docs) }),
    glossaries: GLOSSARY_NAMES.filter((name) => root.includes(name)),
    templateFolder: Object.values(listings).some((entries) => entries.some(isTemplateFolder)),
  };
}

/**
 * A 404 on the root means the repo or ref does not exist, never an empty folder.
 *
 * @param {string} folder label for the error message
 * @param {ListingOutcome} outcome
 * @param {boolean} missingIsEmpty whether a 404 means the folder is empty
 * @returns {ListingEntry[]}
 */
function listEntries(folder, outcome, missingIsEmpty) {
  if ('stdout' in outcome) return JSON.parse(outcome.stdout);
  if (missingIsEmpty && NOT_FOUND.test(outcome.stderr)) return [];
  throw new Error(`${folder} listing failed: ${outcome.stderr.trim()}`);
}

/**
 * @param {ListingEntry[]} entries
 * @returns {string[]}
 */
function fileNames(entries) {
  return entries.filter((entry) => entry.type === 'file').map((entry) => entry.name);
}

/**
 * @param {ListingEntry} entry
 * @returns {boolean}
 */
function isTemplateFolder(entry) {
  return entry.type === 'dir' && entry.name.toLowerCase() === TEMPLATE_FOLDER_NAME;
}

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

module.exports = { resolveTemplateLookup, selectTemplatePath };
