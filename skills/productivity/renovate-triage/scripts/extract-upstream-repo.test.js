const { extractUpstreamRepo } = require('./extract-upstream-repo');

describe('extractUpstreamRepo', () => {
  it('resolves a single embedded release URL to found', () => {
    const content = 'FROM scratch\nADD https://github.com/redis/redis/releases/tag/8.10.1 /src\n';
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });

  it('resolves a single embedded tarball/archive URL to found', () => {
    const content = 'RUN curl -L https://github.com/redis/redis/archive/refs/tags/8.10.1.tar.gz -o redis.tar.gz\n';
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });

  it('resolves to none when no embedded GitHub URL is present', () => {
    const content = 'FROM debian:bookworm-slim\nRUN apt-get update && apt-get install -y build-essential\n';
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result).toEqual({ status: 'none' });
  });

  it('resolves to ambiguous when two embedded URLs name different repositories', () => {
    const content = [
      'https://github.com/redis/redis/releases/tag/8.10.1',
      'https://github.com/redis/redis-stack/releases/tag/8.10.1',
    ].join('\n');
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result.status).toBe('ambiguous');
    expect(result.candidates.sort()).toEqual(['redis/redis', 'redis/redis-stack']);
  });

  it('excludes an embedded URL that resolves back to the packaging repository itself', () => {
    const content = 'https://github.com/redis/docker-library-redis/tags\n';
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result).toEqual({ status: 'none' });
  });

  it('excludes a self-referencing URL while still finding a genuine upstream candidate', () => {
    const content = [
      'https://github.com/redis/docker-library-redis/tags',
      'https://github.com/redis/redis/releases/tag/8.10.1',
    ].join('\n');
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });

  it('deduplicates repeated references to the same upstream repository', () => {
    const content = [
      'https://github.com/redis/redis/releases/tag/8.10.0',
      'https://github.com/redis/redis/releases/tag/8.10.1',
      'https://github.com/redis/redis/archive/refs/tags/8.10.1.tar.gz',
    ].join('\n');
    const result = extractUpstreamRepo('redis/docker-library-redis', content);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });
});
