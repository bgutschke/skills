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

  let baseline;
  let reason;
  if (bumpSize === 'major') {
    baseline = 'needs-review';
    reason = 'baseline: major bump with changelog found, no relevant breaking-change callout';
  } else if (changelogFound) {
    baseline = 'safe';
    reason = 'baseline: patch/minor bump with changelog found';
  } else {
    baseline = 'needs-review';
    reason = 'baseline: patch/minor bump with no changelog found';
  }

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
