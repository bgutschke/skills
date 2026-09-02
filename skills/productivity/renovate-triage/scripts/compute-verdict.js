// @ts-check

/**
 * @typedef {'major' | 'minor' | 'patch' | 'indeterminate'} BumpSize
 * @typedef {'passing' | 'pending' | 'failing'} CiStatus
 * @typedef {'safe' | 'needs-review' | 'blocked'} Verdict
 */

/**
 * @param {{
 *   bumpSize: BumpSize,
 *   changelogFound: boolean,
 *   relevantBreakingChangeCallout: boolean,
 *   ciStatus: CiStatus,
 *   blastRadiusLarge: boolean,
 * }} params
 * @returns {{ verdict: Verdict, reason: string }}
 */
function computeVerdict({ bumpSize, changelogFound, relevantBreakingChangeCallout, ciStatus, blastRadiusLarge }) {
  if (relevantBreakingChangeCallout) {
    return { verdict: 'blocked', reason: 'hard-stop: relevant breaking-change callout' };
  }
  if (ciStatus === 'failing') {
    return { verdict: 'blocked', reason: 'hard-stop: failing CI check' };
  }
  if (bumpSize === 'major' && !changelogFound) {
    return { verdict: 'blocked', reason: 'hard-stop: major bump with no changelog or release notes found anywhere' };
  }

  /** @type {Verdict} */
  let baseline;
  /** @type {string} */
  let reason;
  if (bumpSize === 'indeterminate') {
    baseline = 'needs-review';
    reason = 'baseline: indeterminate bump size (non-semver version), defaults to needs-review';
  } else if (bumpSize === 'major') {
    baseline = 'needs-review';
    reason = 'baseline: major bump with changelog found, no relevant breaking-change callout';
  } else if (changelogFound) {
    baseline = 'safe';
    reason = 'baseline: patch/minor bump with changelog found';
  } else {
    baseline = 'needs-review';
    reason = 'baseline: patch/minor bump with no changelog found';
  }

  /** @type {string[]} */
  const escalations = [];
  if (blastRadiusLarge) escalations.push('blast radius > 10 files');
  if (ciStatus === 'pending') escalations.push('CI pending');

  if (escalations.length === 0) {
    return { verdict: baseline, reason };
  }

  const verdict = baseline === 'safe' ? 'needs-review' : baseline;
  return { verdict, reason: `${reason}, escalated: ${escalations.join(', ')}` };
}

module.exports = { computeVerdict };
