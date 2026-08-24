const { resolveDatasource } = require('./resolve-datasource');

describe('resolveDatasource', () => {
  it('reports detection-unavailable when no renovate.json was found', () => {
    const result = resolveDatasource(null, ['package.json']);
    expect(result).toEqual({ status: 'detection-unavailable', datasources: {} });
  });

  it('reports detection-unavailable when the config file is not valid JSON', () => {
    const result = resolveDatasource('{ not valid json', ['package.json']);
    expect(result).toEqual({ status: 'detection-unavailable', datasources: {} });
  });

  it("resolves npm's built-in manager default pattern", () => {
    const result = resolveDatasource('{}', ['package.json']);
    expect(result).toEqual({ status: 'resolved', datasources: { 'package.json': 'npm' } });
  });

  it("resolves ansible-galaxy's built-in manager default pattern", () => {
    const result = resolveDatasource('{}', ['requirements.yml']);
    expect(result).toEqual({ status: 'resolved', datasources: { 'requirements.yml': 'ansible-galaxy' } });
  });

  it('resolves a customManagers regex match to its datasourceTemplate', () => {
    const config = JSON.stringify({
      customManagers: [
        {
          managerFilePatterns: ['docker-compose\\.ya?ml$'],
          datasourceTemplate: 'docker',
        },
      ],
    });
    const result = resolveDatasource(config, ['docker-compose.yml']);
    expect(result).toEqual({ status: 'resolved', datasources: { 'docker-compose.yml': 'docker' } });
  });

  it('resolves to unknown when a file is reachable only through an unresolved extends preset', () => {
    const config = JSON.stringify({ extends: ['github>org/renovate-config'] });
    const result = resolveDatasource(config, ['charts/values.yaml']);
    expect(result).toEqual({ status: 'resolved', datasources: { 'charts/values.yaml': 'unknown' } });
  });

  it('skips a customManagers entry with an invalid regex pattern instead of throwing', () => {
    const config = JSON.stringify({
      customManagers: [{ managerFilePatterns: ['('], datasourceTemplate: 'docker' }],
    });
    const result = resolveDatasource(config, ['charts/image-tags.yaml']);
    expect(result).toEqual({ status: 'resolved', datasources: { 'charts/image-tags.yaml': 'unknown' } });
  });

  it('resolves a customManagers pattern written in the /source/flags delimited form', () => {
    const config = JSON.stringify({
      customManagers: [
        {
          managerFilePatterns: ['/roles/nextcloud/defaults/main\\.yml$/'],
          datasourceTemplate: 'docker',
        },
      ],
    });
    const result = resolveDatasource(config, ['roles/nextcloud/defaults/main.yml']);
    expect(result).toEqual({ status: 'resolved', datasources: { 'roles/nextcloud/defaults/main.yml': 'docker' } });
  });

  it('honors flags on a delimited customManagers pattern', () => {
    const config = JSON.stringify({
      customManagers: [{ managerFilePatterns: ['/DOCKERFILE$/i'], datasourceTemplate: 'docker' }],
    });
    const result = resolveDatasource(config, ['Dockerfile']);
    expect(result).toEqual({ status: 'resolved', datasources: { Dockerfile: 'docker' } });
  });

  it("resolves docker-compose's built-in manager default pattern for a Jinja template", () => {
    const result = resolveDatasource('{}', ['roles/nextcloud/templates/docker-compose.yml.j2']);
    expect(result).toEqual({
      status: 'resolved',
      datasources: { 'roles/nextcloud/templates/docker-compose.yml.j2': 'docker' },
    });
  });
});
