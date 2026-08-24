const MARKER = '<!-- renovate-triage:verdict -->';
const VALID_VERDICTS = ['safe', 'needs-review', 'blocked'];
const AGENT_BRIEF_HEADING = 'Agent brief';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function validateCommentBody(body, verdict) {
  const errors = [];

  if (!VALID_VERDICTS.includes(verdict)) {
    errors.push(`verdict must be one of ${VALID_VERDICTS.join(', ')}, got "${verdict}"`);
  }

  const markerCount = countOccurrences(body, MARKER);
  if (markerCount !== 1) {
    errors.push(`body must contain the idempotency marker exactly once, found ${markerCount}`);
  }

  const hasAgentBrief = body.includes(AGENT_BRIEF_HEADING);
  if (verdict === 'blocked' && !hasAgentBrief) {
    errors.push('a blocked verdict requires an Agent brief section');
  }
  if (verdict !== 'blocked' && hasAgentBrief) {
    errors.push(`a ${verdict} verdict must not include an Agent brief section`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCommentBody, MARKER, VALID_VERDICTS };
