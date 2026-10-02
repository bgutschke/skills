const { selectTemplatePath } = require('./select-template-path');

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
