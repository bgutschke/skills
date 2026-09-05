// @ts-check

/**
 * @typedef {{ owner: string, repo: string }} RemoteInfo
 *
 * @typedef {{
 *   number: number,
 *   title: string,
 *   merged_at: string | null,
 *   html_url: string,
 *   body?: string | null,
 * }} RawPullRequest
 */

/**
 * Parses a git remote URL into a GitHub owner/repo pair, recognizing both
 * the SSH and HTTPS forms git prints for a github.com remote. Returns null
 * for any other host, so the caller treats "not GitHub" and "no remote at
 * all" the same way.
 *
 * @param {string} remoteUrl
 * @returns {RemoteInfo | null}
 */
function parseGitHubRemote(remoteUrl) {
  const match = remoteUrl
    .trim()
    .match(/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Picks the pull request this report should credit for one commit, from the
 * list GitHub associates with that commit's hash. That list can include
 * pull requests still open or closed unmerged, so this keeps only the
 * merged ones, and prefers the most recently merged, since that is the pull
 * request whose merge actually brought the commit to the default branch.
 *
 * @param {RawPullRequest[]} pulls
 * @returns {import('./build-report').PullRequestInfo | null}
 */
function pickMergedPullRequest(pulls) {
  const merged = pulls.filter((pull) => pull.merged_at);
  if (merged.length === 0) return null;
  merged.sort((a, b) => (/** @type {string} */ (a.merged_at) < /** @type {string} */ (b.merged_at) ? 1 : -1));
  const best = merged[0];
  return { number: best.number, title: best.title, url: best.html_url, body: best.body ?? null };
}

/**
 * Adds each eligible commit's merged pull request, when GitHub enrichment is
 * available. A plain merge commit is never squashed behind a pull request of
 * its own, so this skips the lookup for one and leaves it unenriched. The
 * lookup itself is injected, so this stays testable with no real `gh` call.
 *
 * @param {import('./build-report').CommitRecord[]} commits
 * @param {import('./build-report').HostInfo | null} hostInfo
 * @param {(owner: string, repo: string, hash: string) => import('./build-report').PullRequestInfo | null} findMergedPullRequest
 * @returns {import('./build-report').CommitRecord[]}
 */
function enrichWithPullRequests(commits, hostInfo, findMergedPullRequest) {
  if (!hostInfo?.isGitHub || !hostInfo.owner || !hostInfo.repo) return commits;
  const { owner, repo } = hostInfo;
  return commits.map((commit) => {
    if (commit.isMerge) return commit;
    const pullRequest = findMergedPullRequest(owner, repo, commit.hash);
    return pullRequest ? { ...commit, pullRequest } : commit;
  });
}

module.exports = { parseGitHubRemote, pickMergedPullRequest, enrichWithPullRequests };
