const { decideCitationAction } = require('./decide-citation-action');

describe('decideCitationAction', () => {
  it('moves freely when no inbound citation was discovered at all', () => {
    expect(decideCitationAction({ citations: [] })).toEqual({
      verdict: 'move',
      citations: [],
      blockingCitations: [],
    });
  });

  it('defaults to no citations when none are given', () => {
    expect(decideCitationAction({})).toEqual({
      verdict: 'move',
      citations: [],
      blockingCitations: [],
    });
  });

  it('updates a single citation in the same change when it sits in a file this pass may edit', () => {
    const citations = [{ citingPath: 'docs/conventions-crossrefs.md', editable: true }];
    expect(decideCitationAction({ citations })).toEqual({
      verdict: 'update',
      citations,
      blockingCitations: [],
    });
  });

  it('updates every citation when all of several are editable', () => {
    const citations = [
      { citingPath: 'ROUTING.md', editable: true },
      { citingPath: 'docs/conventions-crossrefs.md', editable: true },
    ];
    expect(decideCitationAction({ citations })).toEqual({
      verdict: 'update',
      citations,
      blockingCitations: [],
    });
  });

  it('blocks the whole move when one citation among several sits in a file this pass may not edit', () => {
    const editable = { citingPath: 'ROUTING.md', editable: true };
    const notEditable = { citingPath: '~/work/some-project/CLAUDE.md', editable: false };
    expect(decideCitationAction({ citations: [editable, notEditable] })).toEqual({
      verdict: 'blocked',
      citations: [editable, notEditable],
      blockingCitations: [notEditable],
    });
  });

  it('blocks the move and names every citation that is not editable, not just the first', () => {
    const first = { citingPath: '.claude/agents/reviewer.md', editable: false };
    const second = { citingPath: '~/work/some-project/CLAUDE.md', editable: false };
    expect(decideCitationAction({ citations: [first, second] })).toEqual({
      verdict: 'blocked',
      citations: [first, second],
      blockingCitations: [first, second],
    });
  });

  it('never reports a move as updatable just because it also has a blocking citation', () => {
    const result = decideCitationAction({
      citations: [
        { citingPath: 'ROUTING.md', editable: true },
        { citingPath: 'skills/other-skill/SKILL.md', editable: false },
      ],
    });
    expect(result.verdict).toBe('blocked');
  });
});
