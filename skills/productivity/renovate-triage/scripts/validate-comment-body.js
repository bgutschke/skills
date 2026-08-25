const MARKER = '<!-- renovate-triage:verdict -->';
const VALID_VERDICTS = ['safe', 'needs-review', 'blocked'];
const AGENT_BRIEF_HEADING = 'Agent brief';
const OPPORTUNITIES_HEADING = 'Opportunities';
const HEADING_LINE_PATTERN = /^#{1,6}\s+.*$/gm;
const BANNED_EMPTY_OPPORTUNITY_PHRASES = ['no opportunities found', 'none found', 'no opportunities', 'nothing found'];
const TIER_LABEL = { safe: 'SAFE', 'needs-review': 'NEEDS-REVIEW', blocked: 'BLOCKED' };
const TIER_LINE_PATTERN = new RegExp(`^(${Object.values(TIER_LABEL).join('|')})\\s+—`, 'm');
const AGENT_BRIEF_FENCE_PATTERN = /^```text\n[\s\S]*\n```$/;

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

function headingLevel(headingText) {
  return headingText.match(/^#+/)[0].length;
}

function findSectionEnd(body, headings, i) {
  const level = headingLevel(headings[i].text);
  for (let j = i + 1; j < headings.length; j += 1) {
    if (headingLevel(headings[j].text) <= level) return headings[j].index;
  }
  return body.length;
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
    const content = body.slice(sectionStart, findSectionEnd(body, headings, i)).trim();
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

function validateTierLineLabel(body, verdict) {
  const match = body.match(TIER_LINE_PATTERN);
  if (!match) return [];

  const label = match[1];
  if (label !== TIER_LABEL[verdict]) {
    return [`tier line label "${label}" does not match the expected label for verdict "${verdict}"`];
  }
  return [];
}

function validateAgentBriefFence(body) {
  const errors = [];
  const headings = findHeadingLines(body);

  headings.forEach((heading, i) => {
    if (!heading.text.includes(AGENT_BRIEF_HEADING)) return;

    const sectionStart = heading.index + heading.text.length;
    const content = body.slice(sectionStart, findSectionEnd(body, headings, i)).trim();

    if (!AGENT_BRIEF_FENCE_PATTERN.test(content)) {
      errors.push('an Agent brief section must fence its body in a ```text block');
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
  errors.push(...validateTierLineLabel(body, verdict));
  errors.push(...validateAgentBriefFence(body));

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCommentBody, MARKER, VALID_VERDICTS };
