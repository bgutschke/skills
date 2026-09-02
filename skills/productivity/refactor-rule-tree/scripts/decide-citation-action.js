// A move that leaves one citation still pointing at the rule's old location is strictly
// worse than never proposing the move at all — the old file now points at nothing, the
// exact dead-pointer defect this whole pass exists to catch, except this time the pass
// itself caused it. So the decision is deliberately all-or-nothing: a single citation this
// pass may not edit blocks the entire move, never just that one citation.
function decideCitationAction({ citations = [] } = {}) {
  if (citations.length === 0) {
    return { verdict: 'move', citations, blockingCitations: [] };
  }

  const blockingCitations = citations.filter((citation) => !citation.editable);
  if (blockingCitations.length > 0) {
    return { verdict: 'blocked', citations, blockingCitations };
  }

  return { verdict: 'update', citations, blockingCitations: [] };
}

module.exports = { decideCitationAction };
