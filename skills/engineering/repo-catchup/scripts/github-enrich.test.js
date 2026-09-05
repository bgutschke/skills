const { parseGitHubRemote, pickMergedPullRequest, enrichWithPullRequests } = require('./github-enrich');

/** @param {Partial<import('./build-report').CommitRecord>} overrides */
function commit(overrides = {}) {
  return {
    hash: 'abc1234abc1234abc1234abc1234abc1234abcd',
    authorName: 'Ada Lovelace',
    date: '2026-01-01T10:00:00Z',
    message: 'add feature',
    body: '',
    isMerge: false,
    files: ['src/index.js'],
    ...overrides,
  };
}

const githubHost = { isGitHub: true, owner: 'acme', repo: 'widgets' };

describe('parseGitHubRemote', () => {
  it('parses an HTTPS github.com remote', () => {
    expect(parseGitHubRemote('https://github.com/acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    });
  });

  it('parses an HTTPS github.com remote with no .git suffix', () => {
    expect(parseGitHubRemote('https://github.com/acme/widgets')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    });
  });

  it('parses an SSH github.com remote', () => {
    expect(parseGitHubRemote('git@github.com:acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseGitHubRemote('  git@github.com:acme/widgets.git\n')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    });
  });

  it('returns null for a non-GitHub host', () => {
    expect(parseGitHubRemote('https://gitlab.com/acme/widgets.git')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseGitHubRemote('not a url')).toBeNull();
  });
});

describe('pickMergedPullRequest', () => {
  it('returns null when the list is empty', () => {
    expect(pickMergedPullRequest([])).toBeNull();
  });

  it('returns null when no pull request in the list is merged', () => {
    const pulls = [{ number: 1, title: 'wip', merged_at: null, html_url: 'https://github.com/acme/widgets/pull/1' }];
    expect(pickMergedPullRequest(pulls)).toBeNull();
  });

  it('picks the sole merged pull request', () => {
    const pulls = [
      {
        number: 42,
        title: 'add password reset flow',
        merged_at: '2026-01-03T09:00:00Z',
        html_url: 'https://github.com/acme/widgets/pull/42',
        body: 'Users locked out of stale sessions had no way back in.',
      },
    ];
    expect(pickMergedPullRequest(pulls)).toEqual({
      number: 42,
      title: 'add password reset flow',
      url: 'https://github.com/acme/widgets/pull/42',
      body: 'Users locked out of stale sessions had no way back in.',
    });
  });

  it('carries a null body when the pull request has none', () => {
    const pulls = [
      {
        number: 42,
        title: 'add password reset flow',
        merged_at: '2026-01-03T09:00:00Z',
        html_url: 'https://github.com/acme/widgets/pull/42',
        body: null,
      },
    ];
    expect(pickMergedPullRequest(pulls)?.body).toBeNull();
  });

  it('ignores unmerged pull requests mixed in with a merged one', () => {
    const pulls = [
      { number: 1, title: 'still open', merged_at: null, html_url: 'https://github.com/acme/widgets/pull/1' },
      {
        number: 2,
        title: 'shipped it',
        merged_at: '2026-01-03T09:00:00Z',
        html_url: 'https://github.com/acme/widgets/pull/2',
      },
    ];
    expect(pickMergedPullRequest(pulls)?.number).toBe(2);
  });

  it('prefers the most recently merged pull request when several are merged', () => {
    const pulls = [
      {
        number: 1,
        title: 'earlier',
        merged_at: '2026-01-01T09:00:00Z',
        html_url: 'https://github.com/acme/widgets/pull/1',
      },
      {
        number: 2,
        title: 'later',
        merged_at: '2026-01-03T09:00:00Z',
        html_url: 'https://github.com/acme/widgets/pull/2',
      },
    ];
    expect(pickMergedPullRequest(pulls)?.number).toBe(2);
  });
});

describe('enrichWithPullRequests', () => {
  it('leaves commits untouched when hostInfo is null', () => {
    const findMergedPullRequest = jest.fn();
    const commits = [commit()];
    expect(enrichWithPullRequests(commits, null, findMergedPullRequest)).toBe(commits);
    expect(findMergedPullRequest).not.toHaveBeenCalled();
  });

  it('leaves commits untouched when the host is not GitHub', () => {
    const findMergedPullRequest = jest.fn();
    const commits = [commit()];
    expect(enrichWithPullRequests(commits, { isGitHub: false }, findMergedPullRequest)).toBe(commits);
    expect(findMergedPullRequest).not.toHaveBeenCalled();
  });

  it('skips the lookup for a plain merge commit', () => {
    const findMergedPullRequest = jest.fn();
    const commits = [commit({ isMerge: true })];
    const [result] = enrichWithPullRequests(commits, githubHost, findMergedPullRequest);
    expect(result).toBe(commits[0]);
    expect(findMergedPullRequest).not.toHaveBeenCalled();
  });

  it('attaches the merged pull request a lookup finds', () => {
    const pullRequest = { number: 42, title: 'add password reset flow', url: 'https://github.com/acme/widgets/pull/42' };
    const findMergedPullRequest = jest.fn().mockReturnValue(pullRequest);
    const [result] = enrichWithPullRequests([commit({ hash: 'a1b2c3d' })], githubHost, findMergedPullRequest);
    expect(result.pullRequest).toBe(pullRequest);
    expect(findMergedPullRequest).toHaveBeenCalledWith('acme', 'widgets', 'a1b2c3d');
  });

  it('leaves a commit unenriched when the lookup finds no merged pull request', () => {
    const findMergedPullRequest = jest.fn().mockReturnValue(null);
    const commits = [commit()];
    const [result] = enrichWithPullRequests(commits, githubHost, findMergedPullRequest);
    expect(result).toBe(commits[0]);
  });
});
