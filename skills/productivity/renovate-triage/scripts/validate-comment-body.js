// @ts-check

const MARKER = '<!-- renovate-triage:verdict -->';
const VALID_VERDICTS = ['safe', 'needs-review', 'blocked'];
const AGENT_BRIEF_HEADING = 'Agent brief';
const OPPORTUNITIES_HEADING = 'Opportunities';
const HEADING_LINE_PATTERN = /^#{1,6}\s+.*$/gm;
const BANNED_EMPTY_OPPORTUNITY_PHRASES = ['no opportunities found', 'none found', 'no opportunities', 'nothing found'];
/** @type {Record<string, string>} */
const TIER_LABEL = { safe: 'SAFE', 'needs-review': 'NEEDS-REVIEW', blocked: 'BLOCKED' };
const TIER_LINE_PATTERN = new RegExp(`^(${Object.values(TIER_LABEL).join('|')})\\s+—`, 'm');
const AGENT_BRIEF_FENCE_PATTERN = /^```text\n[\s\S]*\n```$/;

/**
 * @param {string} haystack
 * @param {string} needle
 * @returns {number}
 */
function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * @param {string} body
 * @returns {{ index: number, text: string }[]}
 */
function findHeadingLines(body) {
  /** @type {{ index: number, text: string }[]} */
  const headings = [];
  HEADING_LINE_PATTERN.lastIndex = 0;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = HEADING_LINE_PATTERN.exec(body)) !== null) {
    headings.push({ index: match.index, text: match[0] });
  }
  return headings;
}

/**
 * @param {string} headingText
 * @returns {number}
 */
function headingLevel(headingText) {
  const match = headingText.match(/^#+/);
  return /** @type {RegExpMatchArray} */ (match)[0].length;
}

/**
 * @param {string} body
 * @param {{ index: number, text: string }[]} headings
 * @param {number} i
 * @returns {number}
 */
function findSectionEnd(body, headings, i) {
  const level = headingLevel(headings[i].text);
  for (let j = i + 1; j < headings.length; j += 1) {
    if (headingLevel(headings[j].text) <= level) return headings[j].index;
  }
  return body.length;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeForBannedPhraseMatch(text) {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/[.!]+$/g, '')
    .trim();
}

/**
 * @param {string} body
 * @returns {string[]}
 */
function validateOpportunitiesSections(body) {
  /** @type {string[]} */
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

/**
 * @param {string} body
 * @param {string} verdict
 * @returns {string[]}
 */
function validateTierLineLabel(body, verdict) {
  const match = body.match(TIER_LINE_PATTERN);
  if (!match) return [];

  const label = match[1];
  if (label !== TIER_LABEL[verdict]) {
    return [`tier line label "${label}" does not match the expected label for verdict "${verdict}"`];
  }
  return [];
}

/**
 * @param {string} body
 * @returns {string[]}
 */
function validateAgentBriefFence(body) {
  /** @type {string[]} */
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

/**
 * @param {string} body
 * @param {string} verdict
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCommentBody(body, verdict) {
  /** @type {string[]} */
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
