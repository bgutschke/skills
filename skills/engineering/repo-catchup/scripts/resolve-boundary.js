// @ts-check

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RELATIVE_RE = /^(\d+)\s+(day|days|week|weeks|month|months)\s+ago$/;

/**
 * Resolves one --from/--to value to an absolute YYYY-MM-DD date. An
 * already-absolute date passes through unchanged. Otherwise, this function
 * tries a relative phrase, then falls back to `resolveGitRefDate` for a git
 * tag or branch name. The git lookup is injected, rather than run here
 * directly, so this function stays pure and testable with no real
 * repository.
 *
 * @param {string} flag
 * @param {string} raw
 * @param {string} today
 * @param {(ref: string) => string | null} resolveGitRefDate
 * @returns {string}
 */
function resolveBoundary(flag, raw, today, resolveGitRefDate) {
  if (DATE_RE.test(raw)) return raw;

  const relative = parseRelativePhrase(raw, today);
  if (relative !== null) return relative;

  const refDate = resolveGitRefDate(raw);
  if (refDate !== null) return refDate;

  throw new Error(
    `${flag} must be an absolute date (YYYY-MM-DD), a relative phrase (for example ` +
      `"yesterday" or "last week"), or an existing git tag/branch name, got "${raw}".`,
  );
}

/**
 * Parses a relative date phrase, such as "yesterday" or "3 weeks ago", into
 * an absolute YYYY-MM-DD date anchored to `today`. Returns null for a phrase
 * this grammar does not recognize, so the caller can try a git ref next.
 *
 * @param {string} phrase
 * @param {string} today
 * @returns {string | null}
 */
function parseRelativePhrase(phrase, today) {
  const normalized = phrase.trim().toLowerCase();

  const fixed = FIXED_PHRASES[normalized];
  if (fixed) return fixed(today);

  const match = normalized.match(RELATIVE_RE);
  if (!match) return null;

  const count = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith('day')) return shiftDateString(today, -count);
  if (unit.startsWith('week')) return shiftDateString(today, -count * 7);
  return shiftMonths(today, -count);
}

/** @type {Record<string, (today: string) => string>} */
const FIXED_PHRASES = {
  today: (today) => today,
  yesterday: (today) => shiftDateString(today, -1),
  'last week': (today) => shiftDateString(today, -7),
  'last month': (today) => shiftMonths(today, -1),
  'last year': (today) => shiftMonths(today, -12),
};

/**
 * Shifts a date by a whole number of calendar months, clamping the day of
 * month to the target month's own length. Without the clamp, a month-end
 * anchor (for example the 31st) overflows into the following month when the
 * target month is shorter, landing on the wrong month entirely.
 *
 * @param {string} dateString
 * @param {number} months
 * @returns {string}
 */
function shiftMonths(dateString, months) {
  const [year, month, day] = dateString.split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);
  return toDateString(new Date(Date.UTC(year, targetMonthIndex, clampedDay)));
}

/**
 * @param {string} dateString
 * @param {number} days
 * @returns {string}
 */
function shiftDateString(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  return toDateString(new Date(Date.UTC(year, month - 1, day + days)));
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

module.exports = { DATE_RE, resolveBoundary, parseRelativePhrase, toDateString, shiftDateString };
