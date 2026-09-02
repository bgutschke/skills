// @ts-check

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)/;

/**
 * @param {string} version
 * @returns {{ major: number, minor: number } | null}
 */
function parseVersion(version) {
  const match = version.match(VERSION_PATTERN);
  if (!match) {
    return null;
  }
  const [, major, minor] = match;
  return { major: Number(major), minor: Number(minor) };
}

/**
 * @param {string} oldVersion
 * @param {string} newVersion
 * @returns {'major' | 'minor' | 'patch' | 'indeterminate'}
 */
function classifyBumpSize(oldVersion, newVersion) {
  const previous = parseVersion(oldVersion);
  const next = parseVersion(newVersion);
  if (!previous || !next) return 'indeterminate';
  if (next.major !== previous.major) return 'major';
  if (next.minor !== previous.minor) return 'minor';
  return 'patch';
}

module.exports = { classifyBumpSize };
