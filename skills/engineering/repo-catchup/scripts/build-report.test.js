const { buildReport } = require('./build-report');

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

describe('buildReport', () => {
  it('drops a bot-authored commit', () => {
    const { rows, summary } = buildReport([commit({ authorName: 'dependabot[bot]' })], null, null);
    expect(rows).toHaveLength(0);
    expect(summary.droppedBotCommits).toBe(1);
  });

  it('drops a bot-authored commit with a trailing -bot name', () => {
    const { rows, summary } = buildReport([commit({ authorName: 'semantic-release-bot' })], null, null);
    expect(rows).toHaveLength(0);
    expect(summary.droppedBotCommits).toBe(1);
  });

  it('drops a plain merge commit', () => {
    const { rows, summary } = buildReport([commit({ isMerge: true })], null, null);
    expect(rows).toHaveLength(0);
    expect(summary.droppedMergeCommits).toBe(1);
  });

  it('counts a bot-authored merge commit as a bot drop only, never both', () => {
    const { summary } = buildReport([commit({ authorName: 'github-actions[bot]', isMerge: true })], null, null);
    expect(summary.droppedBotCommits).toBe(1);
    expect(summary.droppedMergeCommits).toBe(0);
  });

  it('attributes a commit matching one CODEOWNERS team to that team', () => {
    const codeowners = '/src/ @team-frontend\n';
    const { rows } = buildReport([commit({ files: ['src/index.js'] })], codeowners, null);
    expect(rows[0].owner).toBe('@team-frontend');
  });

  it('attributes a commit split across two teams to the team owning the majority of files', () => {
    const codeowners = ['/src/ @team-frontend', '/api/ @team-backend'].join('\n');
    const record = commit({ files: ['src/a.js', 'src/b.js', 'api/handler.js'] });
    const { rows } = buildReport([record], codeowners, null);
    expect(rows[0].owner).toBe('@team-frontend');
  });

  it('falls back to the author when no CODEOWNERS rule matches the commit', () => {
    const codeowners = '/api/ @team-backend\n';
    const { rows } = buildReport([commit({ files: ['src/index.js'] })], codeowners, null);
    expect(rows[0].owner).toBe('Ada Lovelace');
  });

  it('breaks a tie between two equally-matched teams deterministically, by first touched file', () => {
    const codeowners = ['/src/ @team-frontend', '/api/ @team-backend'].join('\n');
    const record = commit({ files: ['api/handler.js', 'src/a.js'] });
    const { rows } = buildReport([record], codeowners, null);
    expect(rows[0].owner).toBe('@team-backend');
  });

  it('gives a CODEOWNERS rule priority over an earlier rule matching the same file', () => {
    const codeowners = ['/src/ @team-frontend', '/src/legacy/ @team-legacy'].join('\n');
    const { rows } = buildReport([commit({ files: ['src/legacy/old.js'] })], codeowners, null);
    expect(rows[0].owner).toBe('@team-legacy');
  });

  it('matches an unanchored wildcard CODEOWNERS pattern at any depth', () => {
    const codeowners = '*.md @team-docs\n';
    const { rows } = buildReport([commit({ files: ['docs/deep/guide.md'] })], codeowners, null);
    expect(rows[0].owner).toBe('@team-docs');
  });

  it('falls back to the author for every commit when the repository has no CODEOWNERS file', () => {
    const { rows } = buildReport([commit(), commit({ hash: 'def456' })], null, null);
    expect(rows.every((row) => row.owner === 'Ada Lovelace')).toBe(true);
  });

  it('collapses a squash-merged pull request and its commits into one row', () => {
    const pullRequest = { number: 42, url: 'https://github.com/acme/widgets/pull/42' };
    const commits = [
      commit({ hash: 'hash1', pullRequest, message: 'wip' }),
      commit({ hash: 'hash2', pullRequest, message: 'fix review comments' }),
    ];
    const { rows } = buildReport(commits, null, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].hashes).toEqual(['hash1', 'hash2']);
  });

  it('attributes a squashed pull request with no CODEOWNERS match to its first commit\'s author', () => {
    const pullRequest = { number: 42, url: 'https://github.com/acme/widgets/pull/42' };
    const commits = [
      commit({ hash: 'hash1', authorName: 'Ada Lovelace', pullRequest }),
      commit({ hash: 'hash2', authorName: 'Grace Hopper', pullRequest }),
    ];
    const { rows } = buildReport(commits, null, null);
    expect(rows[0].owner).toBe('Ada Lovelace');
  });

  it('links a row backed by a pull request to that pull request', () => {
    const pullRequest = { number: 42, url: 'https://github.com/acme/widgets/pull/42' };
    const { rows } = buildReport([commit({ pullRequest })], null, githubHost);
    expect(rows[0].ref).toEqual({ label: '#42', url: 'https://github.com/acme/widgets/pull/42' });
  });

  it('links a row with no pull request, on a GitHub remote, to the bare commit', () => {
    const { rows } = buildReport([commit({ hash: 'abcdef1234567890' })], null, githubHost);
    expect(rows[0].ref).toEqual({
      label: 'abcdef1',
      url: 'https://github.com/acme/widgets/commit/abcdef1234567890',
    });
  });

  it('shows a plain hash with no link on a non-GitHub remote', () => {
    const { rows } = buildReport([commit({ hash: 'abcdef1234567890' })], null, { isGitHub: false });
    expect(rows[0].ref).toEqual({ label: 'abcdef1', url: null });
  });

  it('shows a plain hash with no link when there is no remote at all', () => {
    const { rows } = buildReport([commit({ hash: 'abcdef1234567890' })], null, null);
    expect(rows[0].ref).toEqual({ label: 'abcdef1', url: null });
  });

  it('sorts the final rows by owner, then by date', () => {
    const commits = [
      commit({ hash: 'h1', authorName: 'Zoe Ziegler', date: '2026-01-02T00:00:00Z' }),
      commit({ hash: 'h2', authorName: 'Ada Lovelace', date: '2026-01-03T00:00:00Z' }),
      commit({ hash: 'h3', authorName: 'Ada Lovelace', date: '2026-01-01T00:00:00Z' }),
    ];
    const { rows } = buildReport(commits, null, null);
    expect(rows.map((row) => row.hashes[0])).toEqual(['h3', 'h2', 'h1']);
  });

  it('carries the merged pull request\'s body as the row\'s why-text', () => {
    const pullRequest = {
      number: 42,
      url: 'https://github.com/acme/widgets/pull/42',
      body: 'Users locked out of stale sessions had no way back in.',
    };
    const { rows } = buildReport([commit({ pullRequest, body: 'commit body, ignored' })], null, null);
    expect(rows[0].body).toBe('Users locked out of stale sessions had no way back in.');
  });

  it('falls back to the commit\'s own body when there is no pull request', () => {
    const { rows } = buildReport([commit({ body: 'Fixes a stale-session bug reported in #40.' })], null, null);
    expect(rows[0].body).toBe('Fixes a stale-session bug reported in #40.');
  });

  it('falls back to the commit\'s own body when the pull request has none', () => {
    const pullRequest = { number: 42, url: 'https://github.com/acme/widgets/pull/42', body: null };
    const { rows } = buildReport([commit({ pullRequest, body: 'the commit body' })], null, null);
    expect(rows[0].body).toBe('the commit body');
  });

  it('falls back to null when neither the pull request nor the commit has a body', () => {
    const { rows } = buildReport([commit({ body: '' })], null, null);
    expect(rows[0].body).toBeNull();
  });
});
