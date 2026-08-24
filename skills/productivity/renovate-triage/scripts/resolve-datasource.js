const BUILT_IN_MANAGERS = [
  { datasource: 'npm', filePatterns: [/(^|\/)package\.json$/, /(^|\/)package-lock\.json$/, /(^|\/)yarn\.lock$/, /(^|\/)pnpm-lock\.yaml$/] },
  { datasource: 'docker', filePatterns: [/(^|\/)Dockerfile[^/]*$/, /(^|\/)docker-compose[^/]*\.ya?ml(\.j2)?$/] },
  { datasource: 'pypi', filePatterns: [/(^|\/)requirements[^/]*\.txt$/, /(^|\/)Pipfile$/, /(^|\/)pyproject\.toml$/] },
  { datasource: 'go', filePatterns: [/(^|\/)go\.mod$/, /(^|\/)go\.sum$/] },
  { datasource: 'github-actions', filePatterns: [/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/] },
  { datasource: 'ansible-galaxy', filePatterns: [/(^|\/)requirements\.ya?ml$/] },
];

function matchBuiltInManager(file) {
  const manager = BUILT_IN_MANAGERS.find((candidate) => candidate.filePatterns.some((pattern) => pattern.test(file)));
  return manager?.datasource;
}

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

function matchCustomManager(config, file) {
  const customManagers = Array.isArray(config.customManagers) ? config.customManagers : [];
  for (const manager of customManagers) {
    const patterns = Array.isArray(manager.managerFilePatterns) ? manager.managerFilePatterns : [];
    const matches = patterns.some((pattern) => toRegExp(pattern)?.test(file));
    if (matches && manager.datasourceTemplate) {
      return manager.datasourceTemplate;
    }
  }
  return undefined;
}

function resolveDatasource(renovateConfigText, changedFiles) {
  if (renovateConfigText === null) {
    return { status: 'detection-unavailable', datasources: {} };
  }

  let config;
  try {
    config = JSON.parse(renovateConfigText);
  } catch {
    return { status: 'detection-unavailable', datasources: {} };
  }

  const datasources = {};
  for (const file of changedFiles) {
    datasources[file] = matchCustomManager(config, file) ?? matchBuiltInManager(file) ?? 'unknown';
  }
  return { status: 'resolved', datasources };
}

module.exports = { resolveDatasource };
