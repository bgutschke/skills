// @ts-check

// Every rule read out of the source file must appear in the plan exactly once, carrying
// one of the four placement verdicts. A partial run of a restructuring — unlike a partial
// run of an ordinary edit — can delete a rule from the file it used to live in before it is
// ever written to where it was moving to, so this check has to catch both a rule counted
// twice (about to be duplicated) and a rule counted zero times (about to be dropped) before
// either one reaches disk.
const VALID_VERDICTS = new Set(['stay', 'move', 'skill', 'delete']);

/** @typedef {{ ruleId: string, verdict: string }} PlanEntry */

/**
 * @param {{ ruleIds?: string[], entries?: PlanEntry[] }} [params]
 * @returns {{ ok: boolean, duplicates: string[], missing: string[], unknown: string[], invalidVerdict: string[] }}
 */
function checkPlanInvariant({ ruleIds = [], entries = [] } = {}) {
  /** @type {Map<string, number>} */
  const countByRuleId = new Map();
  /** @type {string[]} */
  const invalidVerdict = [];
  for (const entry of entries) {
    countByRuleId.set(entry.ruleId, (countByRuleId.get(entry.ruleId) ?? 0) + 1);
    if (!VALID_VERDICTS.has(entry.verdict)) invalidVerdict.push(entry.ruleId);
  }

  const knownRuleIds = new Set(ruleIds);
  const duplicates = [...countByRuleId.entries()]
    .filter(([, count]) => count > 1)
    .map(([ruleId]) => ruleId);
  // An entry naming a ruleId absent from the source is exactly as dangerous as a missing
  // one: left unchecked, it would let a rule silently drop out while an unrelated entry
  // pads the count back to what a naive length comparison expects.
  const unknown = [...countByRuleId.keys()].filter((ruleId) => !knownRuleIds.has(ruleId));
  const missing = ruleIds.filter((ruleId) => !countByRuleId.has(ruleId));

  return {
    ok: duplicates.length === 0 && missing.length === 0 && unknown.length === 0 && invalidVerdict.length === 0,
    duplicates,
    missing,
    unknown,
    invalidVerdict,
  };
}

module.exports = { checkPlanInvariant, VALID_VERDICTS };
