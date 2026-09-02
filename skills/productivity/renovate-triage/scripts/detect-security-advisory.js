// @ts-check

const CVE_PATTERN = /\bCVE-\d{4}-\d+\b/i;
const GHSA_PATTERN = /\bGHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b/i;
const SECURITY_HEADING_PATTERN = /^#{1,6}\s*security\b/im;
const URGENCY_LANGUAGE_PATTERNS = [
  /\bvulnerabilit(?:y|ies)\b/i,
  /\bremote code execution\b/i,
  /\barbitrary code execution\b/i,
  /\bupdate urgency:\s*security\b/i,
  /\bexploit(?:able|ed)?\b/i,
  /\bdenial of service\b/i,
];

/**
 * @param {string} changelogText
 * @returns {{ found: boolean, signals: string[] }}
 */
function detectSecurityAdvisory(changelogText) {
  /** @type {string[]} */
  const signals = [];
  if (CVE_PATTERN.test(changelogText)) signals.push('cve');
  if (GHSA_PATTERN.test(changelogText)) signals.push('ghsa');
  if (SECURITY_HEADING_PATTERN.test(changelogText)) signals.push('security-heading');
  if (URGENCY_LANGUAGE_PATTERNS.some((pattern) => pattern.test(changelogText))) signals.push('urgency-language');
  return { found: signals.length > 0, signals };
}

module.exports = { detectSecurityAdvisory };
