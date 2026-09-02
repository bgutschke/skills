// @ts-check

/** @typedef {{ datasource: string, filePatterns: RegExp[] }} BuiltInManager */

/** @type {BuiltInManager[]} */
const BUILT_IN_MANAGERS = [
  { datasource: 'npm', filePatterns: [/(^|\/)package\.json$/, /(^|\/)package-lock\.json$/, /(^|\/)yarn\.lock$/, /(^|\/)pnpm-lock\.yaml$/] },
  { datasource: 'docker', filePatterns: [/(^|\/)Dockerfile[^/]*$/, /(^|\/)docker-compose[^/]*\.ya?ml(\.j2)?$/] },
  { datasource: 'pypi', filePatterns: [/(^|\/)requirements[^/]*\.txt$/, /(^|\/)Pipfile$/, /(^|\/)pyproject\.toml$/] },
  { datasource: 'go', filePatterns: [/(^|\/)go\.mod$/, /(^|\/)go\.sum$/] },
  { datasource: 'github-actions', filePatterns: [/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/] },
  { datasource: 'ansible-galaxy', filePatterns: [/(^|\/)requirements\.ya?ml$/] },
];

/**
 * @param {string} file
 * @returns {string | undefined}
 */
function matchBuiltInManager(file) {
  const manager = BUILT_IN_MANAGERS.find((candidate) => candidate.filePatterns.some((pattern) => pattern.test(file)));
  return manager?.datasource;
}

/**
 * @param {string} pattern
 * @returns {RegExp | null}
 */
function toRegExp(pattern) {
  const parsed = parseDelimitedPattern(pattern);
  try {
    return parsed ? new RegExp(parsed.source, parsed.flags) : new RegExp(pattern);
  } catch {
    return null;
  }
}

// Renovate writes regex-typed config fields (e.g. managerFilePatterns) wrapped as
// /source/flags to distinguish them from glob strings; new RegExp() doesn't strip
// that wrapper on its own.
/**
 * @param {string} pattern
 * @returns {{ source: string, flags: string } | null}
 */
function parseDelimitedPattern(pattern) {
  if (pattern.length < 2 || pattern[0] !== '/') {
    return null;
  }
  const lastSlash = pattern.lastIndexOf('/');
  if (lastSlash <= 0) {
    return null;
  }
  const flags = pattern.slice(lastSlash + 1);
  if (!/^[a-z]*$/i.test(flags)) {
    return null;
  }
  return { source: pattern.slice(1, lastSlash), flags };
}

/**
 * @param {any} config
 * @param {string} file
 * @returns {string | undefined}
 */
function matchCustomManager(config, file) {
  const customManagers = Array.isArray(config.customManagers) ? config.customManagers : [];
  for (const manager of customManagers) {
    const patterns = Array.isArray(manager.managerFilePatterns) ? manager.managerFilePatterns : [];
    const matches = patterns.some((/** @type {string} */ pattern) => toRegExp(pattern)?.test(file));
    if (matches && manager.datasourceTemplate) {
      return manager.datasourceTemplate;
    }
  }
  return undefined;
}

/**
 * @param {string | null} renovateConfigText
 * @param {string[]} changedFiles
 * @returns {{ status: 'detection-unavailable' | 'resolved', datasources: Record<string, string> }}
 */
function resolveDatasource(renovateConfigText, changedFiles) {
  if (renovateConfigText === null) {
    return { status: 'detection-unavailable', datasources: {} };
  }

  /** @type {any} */
  let config;
  try {
    config = JSON.parse(renovateConfigText);
  } catch {
    return { status: 'detection-unavailable', datasources: {} };
  }

  /** @type {Record<string, string>} */
  const datasources = {};
  for (const file of changedFiles) {
    datasources[file] = matchCustomManager(config, file) ?? matchBuiltInManager(file) ?? 'unknown';
  }
  return { status: 'resolved', datasources };
}

module.exports = { resolveDatasource };
