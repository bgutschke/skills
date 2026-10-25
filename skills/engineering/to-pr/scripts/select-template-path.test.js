const { selectTemplatePath, resolveTemplateLookup } = require('./select-template-path');

describe('selectTemplatePath', () => {
  it('finds the uppercase template in .github/', () => {
    expect(selectTemplatePath({ github: ['PULL_REQUEST_TEMPLATE.md', 'CODEOWNERS'], root: [], docs: [] })).toBe(
      '.github/PULL_REQUEST_TEMPLATE.md',
    );
  });

  it('finds the lowercase template in .github/', () => {
    expect(selectTemplatePath({ github: ['pull_request_template.md'], root: [], docs: [] })).toBe(
      '.github/pull_request_template.md',
    );
  });

  it('finds a mixed-case template and keeps its listed case', () => {
    expect(selectTemplatePath({ github: ['Pull_Request_Template.md'], root: [], docs: [] })).toBe(
      '.github/Pull_Request_Template.md',
    );
  });

  it('finds a .txt template', () => {
    expect(selectTemplatePath({ github: ['pull_request_template.txt'], root: [], docs: [] })).toBe(
      '.github/pull_request_template.txt',
    );
  });

  it('finds a template in the repo root when .github/ has none', () => {
    expect(selectTemplatePath({ github: ['CODEOWNERS'], root: ['README.md', 'PULL_REQUEST_TEMPLATE.md'], docs: [] })).toBe(
      'PULL_REQUEST_TEMPLATE.md',
    );
  });

  it('finds a template in docs/ when .github/ and the root have none', () => {
    expect(selectTemplatePath({ github: [], root: ['README.md'], docs: ['PULL_REQUEST_TEMPLATE.txt'] })).toBe(
      'docs/PULL_REQUEST_TEMPLATE.txt',
    );
  });

  it('prefers .github/ over the repo root', () => {
    expect(
      selectTemplatePath({ github: ['pull_request_template.md'], root: ['PULL_REQUEST_TEMPLATE.md'], docs: [] }),
    ).toBe('.github/pull_request_template.md');
  });

  it('prefers the repo root over docs/', () => {
    expect(
      selectTemplatePath({ github: [], root: ['pull_request_template.md'], docs: ['PULL_REQUEST_TEMPLATE.md'] }),
    ).toBe('pull_request_template.md');
  });

  it('prefers .md over .txt inside one folder', () => {
    expect(
      selectTemplatePath({ github: ['pull_request_template.txt', 'pull_request_template.md'], root: [], docs: [] }),
    ).toBe('.github/pull_request_template.md');
  });

  it('picks the first name in byte order when two case variants tie', () => {
    expect(
      selectTemplatePath({ github: ['pull_request_template.md', 'PULL_REQUEST_TEMPLATE.md'], root: [], docs: [] }),
    ).toBe('.github/PULL_REQUEST_TEMPLATE.md');
  });

  it.each(['pull_request_template.md.bak', 'my_pull_request_template.md', 'pull_request_template', 'pull_request_template.markdown'])(
    'ignores the near-miss name %s',
    (name) => {
      expect(selectTemplatePath({ github: [name], root: [name], docs: [name] })).toBeNull();
    },
  );

  it('returns null when every folder is empty', () => {
    expect(selectTemplatePath({ github: [], root: [], docs: [] })).toBeNull();
  });
});

/**
 * @param {...[string, string]} entries name and type pairs
 * @returns {{ stdout: string }}
 */
function listing(...entries) {
  return { stdout: JSON.stringify(entries.map(([name, type]) => ({ name, type }))) };
}

const NOT_FOUND = { stderr: 'gh: Not Found (HTTP 404)' };

describe('resolveTemplateLookup', () => {
  it('returns the template path found in the gh listings', () => {
    expect(
      resolveTemplateLookup({
        github: listing(['pull_request_template.md', 'file']),
        root: listing(['README.md', 'file']),
        docs: NOT_FOUND,
      }),
    ).toEqual({ template: '.github/pull_request_template.md', glossaries: [], templateFolder: false });
  });

  it('ignores an entry that is not a file', () => {
    expect(
      resolveTemplateLookup({
        github: listing(['pull_request_template.md', 'dir']),
        root: listing(['README.md', 'file']),
        docs: NOT_FOUND,
      }).template,
    ).toBeNull();
  });

  it('throws on an API error that is not a 404', () => {
    expect(() =>
      resolveTemplateLookup({
        github: { stderr: 'gh: API rate limit exceeded (HTTP 403)' },
        root: listing(['README.md', 'file']),
        docs: NOT_FOUND,
      }),
    ).toThrow('.github/ listing failed: gh: API rate limit exceeded (HTTP 403)');
  });

  it('throws when the root listing is a 404, because the repo or ref does not exist', () => {
    expect(() =>
      resolveTemplateLookup({ github: NOT_FOUND, root: NOT_FOUND, docs: NOT_FOUND }),
    ).toThrow('root listing failed: gh: Not Found (HTTP 404)');
  });

  it('throws when the root listing holds no files, because a real repo always has one', () => {
    expect(() =>
      resolveTemplateLookup({ github: NOT_FOUND, root: listing(['src', 'dir']), docs: NOT_FOUND }),
    ).toThrow('root listing holds no files');
  });

  it('lists the glossary files at the root and ignores one in another folder', () => {
    expect(
      resolveTemplateLookup({
        github: listing(['GLOSSARY.md', 'file']),
        root: listing(['README.md', 'file'], ['GLOSSARY.md', 'file'], ['CONTEXT.md', 'file']),
        docs: listing(['CONTEXT.md', 'file']),
      }).glossaries,
    ).toEqual(['CONTEXT.md', 'GLOSSARY.md']);
  });

  it.each(['github', 'root', 'docs'])('flags a PULL_REQUEST_TEMPLATE folder in the %s listing', (folder) => {
    const outcomes = { github: NOT_FOUND, root: listing(['README.md', 'file']), docs: NOT_FOUND };
    outcomes[folder] = listing(['README.md', 'file'], ['pull_request_template', 'dir']);
    expect(resolveTemplateLookup(outcomes).templateFolder).toBe(true);
  });

  it('does not flag a PULL_REQUEST_TEMPLATE entry that is a file', () => {
    expect(
      resolveTemplateLookup({
        github: NOT_FOUND,
        root: listing(['README.md', 'file'], ['PULL_REQUEST_TEMPLATE', 'file']),
        docs: NOT_FOUND,
      }).templateFolder,
    ).toBe(false);
  });
});
