const GITHUB_REPO_URL_PATTERN = /github\.com\/([\w.-]+)\/([\w.-]+)\/(?:releases|archive|tags)\b/g;

function extractUpstreamRepo(packagingRepo, content) {
  const candidates = new Set();
  GITHUB_REPO_URL_PATTERN.lastIndex = 0;
  let match;
  while ((match = GITHUB_REPO_URL_PATTERN.exec(content)) !== null) {
    const repo = `${match[1]}/${match[2]}`;
    if (repo.toLowerCase() !== packagingRepo.toLowerCase()) {
      candidates.add(repo);
    }
  }

  const found = [...candidates];
  if (found.length === 0) return { status: 'none' };
  if (found.length === 1) return { status: 'found', repo: found[0] };
  return { status: 'ambiguous', candidates: found };
}

module.exports = { extractUpstreamRepo };
