const { validateCommentBody, MARKER, VALID_VERDICTS } = require('./validate-comment-body');

const AGENT_BRIEF = '## Agent brief\n\nInspect these call sites.';

function bodyWithMarker(rest) {
  return `${MARKER}\n${rest}`;
}

function bodyWithOpportunities(sectionContent) {
  return bodyWithMarker(`Verdict: safe\n\n### Opportunities\n\n${sectionContent}\n`);
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

  it('accepts a body with no Opportunities heading at all', () => {
    const result = validateCommentBody(bodyWithMarker('Verdict: safe'), 'safe');
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
