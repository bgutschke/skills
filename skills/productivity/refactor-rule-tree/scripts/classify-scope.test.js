const { classifyScope, decideEditAuthority } = require('./classify-scope');

describe('classifyScope', () => {
  const configDir = '/home/user/.claude';
  const projectRoot = '/home/user/projects/example-app';

  it('classifies a path under the project root as project, even though the project also sits under the home directory', () => {
    expect(classifyScope({ path: `${projectRoot}/CLAUDE.md`, configDir, projectRoot })).toBe('project');
  });

  it('classifies a path under the personal config directory as personal when it is not also under a project root', () => {
    expect(classifyScope({ path: `${configDir}/CLAUDE.md`, configDir, projectRoot: null })).toBe('personal');
  });

  it('classifies the conventional default root — configDir/CLAUDE.md, no project root known — as personal', () => {
    expect(classifyScope({ path: `${configDir}/CLAUDE.md`, configDir, projectRoot: null })).toBe('personal');
  });

  it('classifies a path under neither root as external', () => {
    expect(classifyScope({ path: '/etc/some-other-file.md', configDir, projectRoot })).toBe('external');
  });

  it('classifies the config directory as personal even when it is itself a git-tracked project root, so a dotfiles-managed config directory never misclassifies its own personal rule file as project scope', () => {
    expect(classifyScope({ path: `${configDir}/CLAUDE.md`, configDir, projectRoot: configDir })).toBe('personal');
  });

  it('classifies a project nested inside the config directory as personal, matching the config directory taking precedence unconditionally', () => {
    const nestedProjectRoot = `${configDir}/vendored-repo`;
    expect(classifyScope({ path: `${nestedProjectRoot}/CLAUDE.md`, configDir, projectRoot: nestedProjectRoot })).toBe('personal');
  });

  it('does not match a directory that merely shares a name prefix with the config directory', () => {
    expect(classifyScope({ path: '/home/user/.claude-other/CLAUDE.md', configDir, projectRoot: null })).toBe('external');
  });

  it('classifies the config directory root file itself, not just files beneath it', () => {
    expect(classifyScope({ path: configDir, configDir, projectRoot: null })).toBe('personal');
  });
});

describe('decideEditAuthority', () => {
  it('is editable with no scope crossing when a candidate shares the root personal scope — the default-run case', () => {
    expect(decideEditAuthority({ rootScope: 'personal', candidateScope: 'personal' })).toEqual({
      editable: true,
      scopeCrossing: false,
    });
  });

  it('is editable with no scope crossing when a candidate shares the root project scope', () => {
    expect(decideEditAuthority({ rootScope: 'project', candidateScope: 'project' })).toEqual({
      editable: true,
      scopeCrossing: false,
    });
  });

  it('reports a scope crossing, not editable, when a personal-rooted pass reaches a project file', () => {
    expect(decideEditAuthority({ rootScope: 'personal', candidateScope: 'project' })).toEqual({
      editable: false,
      scopeCrossing: true,
    });
  });

  it('reports a scope crossing, not editable, when a project-rooted pass reaches a personal file — the other crossing direction', () => {
    expect(decideEditAuthority({ rootScope: 'project', candidateScope: 'personal' })).toEqual({
      editable: false,
      scopeCrossing: true,
    });
  });

  it('treats an unclassifiable candidate as a scope crossing rather than assuming it is in scope', () => {
    expect(decideEditAuthority({ rootScope: 'personal', candidateScope: 'external' })).toEqual({
      editable: false,
      scopeCrossing: true,
    });
  });
});
