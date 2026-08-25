const { extractOciSourceLabel } = require('./extract-oci-source-label');

describe('extractOciSourceLabel', () => {
  it('resolves found from org.opencontainers.image.source', () => {
    const labels = { 'org.opencontainers.image.source': 'https://github.com/redis/redis' };
    const result = extractOciSourceLabel(labels);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });

  it('falls back to org.opencontainers.image.url when .source is absent', () => {
    const labels = { 'org.opencontainers.image.url': 'https://github.com/prometheus/node_exporter' };
    const result = extractOciSourceLabel(labels);
    expect(result).toEqual({ status: 'found', repo: 'prometheus/node_exporter' });
  });

  it('trims a trailing .git suffix', () => {
    const labels = { 'org.opencontainers.image.source': 'https://github.com/redis/redis.git' };
    const result = extractOciSourceLabel(labels);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });

  it('trims path segments beyond owner/repo', () => {
    const labels = { 'org.opencontainers.image.source': 'https://github.com/redis/redis/tree/main/docker' };
    const result = extractOciSourceLabel(labels);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });

  it('resolves none when neither label is present', () => {
    const result = extractOciSourceLabel({});
    expect(result).toEqual({ status: 'none' });
  });

  it('resolves none when the label points at a non-github.com host', () => {
    const labels = { 'org.opencontainers.image.source': 'https://gitlab.com/redis/redis' };
    const result = extractOciSourceLabel(labels);
    expect(result).toEqual({ status: 'none' });
  });

  it('resolves none when Labels itself is null', () => {
    const result = extractOciSourceLabel(null);
    expect(result).toEqual({ status: 'none' });
  });

  it('matches a github.com host regardless of casing', () => {
    const labels = { 'org.opencontainers.image.source': 'https://GitHub.com/redis/redis' };
    const result = extractOciSourceLabel(labels);
    expect(result).toEqual({ status: 'found', repo: 'redis/redis' });
  });
});
