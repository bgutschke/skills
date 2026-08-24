const MARKER = '<!-- renovate-triage:verdict -->';
const VALID_VERDICTS = ['safe', 'needs-review', 'blocked'];
const AGENT_BRIEF_HEADING = 'Agent brief';
const OPPORTUNITIES_HEADING = 'Opportunities';
const HEADING_LINE_PATTERN = /^#{1,6}\s+.*$/gm;
const BANNED_EMPTY_OPPORTUNITY_PHRASES = ['no opportunities found', 'none found', 'no opportunities', 'nothing found'];

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function findHeadingLines(body) {
  const headings = [];
  HEADING_LINE_PATTERN.lastIndex = 0;
  let match;
  while ((match = HEADING_LINE_PATTERN.exec(body)) !== null) {
    headings.push({ index: match.index, text: match[0] });
  }
  return headings;
}

function normalizeForBannedPhraseMatch(text) {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/[.!]+$/g, '')
    .trim();
}

function validateOpportunitiesSections(body) {
  const errors = [];
  const headings = findHeadingLines(body);

  headings.forEach((heading, i) => {
    if (!heading.text.includes(OPPORTUNITIES_HEADING)) return;

    const sectionStart = heading.index + heading.text.length;
    const sectionEnd = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const content = body.slice(sectionStart, sectionEnd).trim();
    const label = heading.text.replace(/^#+\s*/, '').trim();

    if (!content) {
      errors.push(`Opportunities section "${label}" must not be empty — omit the section entirely instead`);
      return;
    }

    if (BANNED_EMPTY_OPPORTUNITY_PHRASES.includes(normalizeForBannedPhraseMatch(content))) {
      errors.push(`Opportunities section "${label}" must not use an empty-state placeholder — omit the section entirely instead`);
    }
  });

  return errors;
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

  errors.push(...validateOpportunitiesSections(body));

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCommentBody, MARKER, VALID_VERDICTS };
