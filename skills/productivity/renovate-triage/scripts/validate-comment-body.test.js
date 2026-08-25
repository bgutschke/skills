const { validateCommentBody, MARKER, VALID_VERDICTS } = require('./validate-comment-body');

const AGENT_BRIEF = '## Agent brief\n\n```text\nInspect these call sites.\n```';
const UNFENCED_AGENT_BRIEF = '## Agent brief\n\nInspect these call sites.';
const TIER_LABEL = { safe: 'SAFE', 'needs-review': 'NEEDS-REVIEW', blocked: 'BLOCKED' };

function bodyWithMarker(rest) {
  return `${MARKER}\n${rest}`;
}

function bodyWithOpportunities(sectionContent) {
  return bodyWithMarker(`Verdict: safe\n\n### Opportunities\n\n${sectionContent}\n`);
}

function bodyWithTierLine(label, rest = '') {
  return bodyWithMarker(`${label} — some reason${rest}`);
}

describe('validateCommentBody', () => {
  it('accepts a well-formed safe-verdict body with no Agent brief', () => {
    const result = validateCommentBody(bodyWithMarker('Verdict: safe'), 'safe');
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a well-formed blocked-verdict body that includes an Agent brief', () => {
    const result = validateCommentBody(bodyWithMarker(`Verdict: blocked\n\n${AGENT_BRIEF}`), 'blocked');
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a verdict outside the fixed enum', () => {
    const result = validateCommentBody(bodyWithMarker('Verdict: risky'), 'risky');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(VALID_VERDICTS.join(', ')))).toBe(true);
  });

  it('rejects a body missing the idempotency marker', () => {
    const result = validateCommentBody('Verdict: safe', 'safe');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('marker'))).toBe(true);
  });

  it('rejects a body containing the marker more than once', () => {
    const result = validateCommentBody(bodyWithMarker(`Verdict: safe\n${MARKER}`), 'safe');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('marker'))).toBe(true);
  });

  it('rejects a blocked verdict with no Agent brief section', () => {
    const result = validateCommentBody(bodyWithMarker('Verdict: blocked'), 'blocked');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Agent brief'))).toBe(true);
  });

  it('rejects a non-blocked verdict that includes an Agent brief section', () => {
    const result = validateCommentBody(bodyWithMarker(`Verdict: needs-review\n\n${AGENT_BRIEF}`), 'needs-review');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Agent brief'))).toBe(true);
  });

  it('reports every violated rule at once rather than stopping at the first', () => {
    const result = validateCommentBody('Verdict: risky', 'risky');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('rejects a body with an Opportunities heading followed by banned boilerplate', () => {
    const result = validateCommentBody(bodyWithOpportunities('No opportunities found.'), 'safe');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Opportunities'))).toBe(true);
  });

  it('rejects a body with an Opportunities heading followed by no content', () => {
    const result = validateCommentBody(bodyWithMarker('Verdict: safe\n\n### Opportunities\n'), 'safe');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Opportunities'))).toBe(true);
  });

  it('accepts a body with a populated Opportunities section', () => {
    const result = validateCommentBody(
      bodyWithOpportunities('- New capability: `fetchBatch()` replaces this repo’s manual pagination loop.'),
      'safe'
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a body with an Opportunities heading containing one ### subsection per dependency', () => {
    const result = validateCommentBody(
      bodyWithMarker(
        'Verdict: safe\n\n## Opportunities\n\n### widget-cli\n\nNew `--dry-run` flag.\n\n### widget-server\n\nDeprecates `.get()`.\n'
      ),
      'safe'
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a body with no Opportunities heading at all', () => {
    const result = validateCommentBody(bodyWithMarker('Verdict: safe'), 'safe');
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it.each(Object.entries(TIER_LABEL))('accepts a tier line whose label matches the %s verdict', (verdict, label) => {
    const body = verdict === 'blocked' ? bodyWithTierLine(label, `\n\n${AGENT_BRIEF}`) : bodyWithTierLine(label);
    const result = validateCommentBody(body, verdict);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a tier line whose label does not match the verdict', () => {
    const result = validateCommentBody(bodyWithTierLine(TIER_LABEL.safe), 'blocked');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('tier line'))).toBe(true);
  });

  it('accepts an Agent brief heading followed by a fenced ```text block', () => {
    const result = validateCommentBody(bodyWithMarker(`Verdict: blocked\n\n${AGENT_BRIEF}`), 'blocked');
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects an Agent brief heading followed by unfenced prose', () => {
    const result = validateCommentBody(bodyWithMarker(`Verdict: blocked\n\n${UNFENCED_AGENT_BRIEF}`), 'blocked');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fence'))).toBe(true);
  });

  it('reports both an old and a new violated check at once', () => {
    const result = validateCommentBody(bodyWithTierLine(TIER_LABEL.safe), 'risky');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(VALID_VERDICTS.join(', ')))).toBe(true);
    expect(result.errors.some((e) => e.includes('tier line'))).toBe(true);
  });
});
