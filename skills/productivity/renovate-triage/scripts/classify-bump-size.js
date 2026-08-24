const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)/;

function parseVersion(version) {
  const match = version.match(VERSION_PATTERN);
  if (!match) {
    throw new Error(`cannot parse version: "${version}"`);
  }
  const [, major, minor] = match;
  return { major: Number(major), minor: Number(minor) };
}

function classifyBumpSize(oldVersion, newVersion) {
  const previous = parseVersion(oldVersion);
  const next = parseVersion(newVersion);
  if (next.major !== previous.major) return 'major';
  if (next.minor !== previous.minor) return 'minor';
  return 'patch';
}

module.exports = { classifyBumpSize };
