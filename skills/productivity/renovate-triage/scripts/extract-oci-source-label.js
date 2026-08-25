function extractOciSourceLabel(labels) {
  const url = labels?.['org.opencontainers.image.source'] ?? labels?.['org.opencontainers.image.url'];
  const match = url ? /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/i.exec(url) : null;
  if (!match) return { status: 'none' };
  return { status: 'found', repo: `${match[1]}/${match[2].replace(/\.git$/, '')}` };
}

module.exports = { extractOciSourceLabel };
