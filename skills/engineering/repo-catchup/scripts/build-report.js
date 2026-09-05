// @ts-check

/**
 * @typedef {{
 *   number: number,
 *   title: string,
 *   url: string,
 *   body?: string | null,
 * }} PullRequestInfo
 *
 * @typedef {{
 *   hash: string,
 *   authorName: string,
 *   date: string,
 *   message: string,
 *   body: string,
 *   isMerge: boolean,
 *   files: string[],
 *   pullRequest?: PullRequestInfo,
 * }} CommitRecord
 *
 * @typedef {{
 *   isGitHub: boolean,
 *   owner?: string,
 *   repo?: string,
 * }} HostInfo
 *
 * @typedef {{ label: string, url: string | null }} Ref
 *
 * @typedef {{
 *   date: string,
 *   owner: string,
 *   ref: Ref,
 *   subjects: string[],
 *   hashes: string[],
 *   body: string | null,
 * }} ReportRow
 *
 * @typedef {{
 *   totalCommits: number,
 *   droppedBotCommits: number,
 *   droppedMergeCommits: number,
 *   rowCount: number,
 * }} ReportSummary
 *
 * @typedef {{ commits: CommitRecord[], pullRequest?: PullRequestInfo }} Unit
 *
 * @typedef {{ regex: RegExp, team: string }} CodeownersRule
 */

/**
 * Builds the final catch-up report from raw commit records.
 *
 * @param {CommitRecord[]} commits
 * @param {string | null} codeownersContent
 * @param {HostInfo | null} hostInfo
 * @returns {{ rows: ReportRow[], summary: ReportSummary }}
 */
function buildReport(commits, codeownersContent, hostInfo) {
  const { kept, droppedBotCommits, droppedMergeCommits } = dropBotsAndMerges(commits);
  const rules = codeownersContent ? parseCodeowners(codeownersContent) : null;
  const units = groupIntoUnits(kept);
  const rows = units.map((unit) => buildRow(unit, rules, hostInfo));
  rows.sort(compareRows);

  return {
    rows,
    summary: {
      totalCommits: commits.length,
      droppedBotCommits,
      droppedMergeCommits,
      rowCount: rows.length,
    },
  };
}

/**
 * Splits commits into the ones that stay and the ones this report drops, each
 * counted exactly once. A commit that is both bot-authored and a merge commit
 * counts only as a bot drop, so the two counts never overlap.
 *
 * @param {CommitRecord[]} commits
 * @returns {{ kept: CommitRecord[], droppedBotCommits: number, droppedMergeCommits: number }}
 */
function dropBotsAndMerges(commits) {
  /** @type {CommitRecord[]} */
  const kept = [];
  let droppedBotCommits = 0;
  let droppedMergeCommits = 0;

  for (const commit of commits) {
    if (isBotAuthor(commit.authorName)) {
      droppedBotCommits += 1;
    } else if (commit.isMerge) {
      droppedMergeCommits += 1;
    } else {
      kept.push(commit);
    }
  }

  return { kept, droppedBotCommits, droppedMergeCommits };
}

/**
 * @param {string} authorName
 * @returns {boolean}
 */
function isBotAuthor(authorName) {
  return /(\[bot\]|-bot)$/i.test(authorName.trim());
}

/**
 * @param {string} content
 * @returns {CodeownersRule[]}
 */
function parseCodeowners(content) {
  /** @type {CodeownersRule[]} */
  const rules = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    if (!pattern || owners.length === 0) continue;
    // A CODEOWNERS line can list several owners for one pattern; this report
    // attributes to a single team, so it takes the first as that team.
    rules.push({ regex: patternToRegex(pattern), team: owners[0] });
  }
  return rules;
}

/**
 * Converts one CODEOWNERS pattern to a regular expression, following the
 * subset of gitignore-style rules that CODEOWNERS documents: a leading slash
 * or a slash in the middle of the pattern anchors it to the repository root,
 * a trailing slash matches a whole directory, and a bare `*` stands for one
 * path segment.
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
function patternToRegex(pattern) {
  const isAnchored = pattern.startsWith('/') || pattern.slice(0, -1).includes('/');
  const isDirectory = pattern.endsWith('/');
  let body = pattern;
  if (body.startsWith('/')) body = body.slice(1);
  if (isDirectory) body = body.slice(0, -1);

  const escaped = body
    .split(/(\*|\?)/)
    .map((part) => (part === '*' ? '[^/]*' : part === '?' ? '[^/]' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('');
  const core = isDirectory ? `${escaped}/.*` : escaped;

  return new RegExp(isAnchored ? `^${core}$` : `(^|/)${core}$`);
}

/**
 * Groups filtered commits into report units: commits that share a pull request
 * collapse into one unit, every other commit stands alone.
 *
 * @param {CommitRecord[]} commits
 * @returns {Unit[]}
 */
function groupIntoUnits(commits) {
  /** @type {Map<number, Unit>} */
  const unitsByPrNumber = new Map();
  /** @type {Unit[]} */
  const units = [];

  for (const commit of commits) {
    if (commit.pullRequest) {
      const existing = unitsByPrNumber.get(commit.pullRequest.number);
      if (existing) {
        existing.commits.push(commit);
        continue;
      }
      /** @type {Unit} */
      const unit = { commits: [commit], pullRequest: commit.pullRequest };
      unitsByPrNumber.set(commit.pullRequest.number, unit);
      units.push(unit);
    } else {
      units.push({ commits: [commit] });
    }
  }

  return units;
}

/**
 * @param {Unit} unit
 * @param {CodeownersRule[] | null} rules
 * @param {HostInfo | null} hostInfo
 * @returns {ReportRow}
 */
function buildRow(unit, rules, hostInfo) {
  const files = Array.from(new Set(unit.commits.flatMap((commit) => commit.files)));
  return {
    date: latestDate(unit),
    owner: attributeOwner(unit, files, rules),
    ref: buildRef(unit, hostInfo),
    subjects: unit.commits.map((commit) => commit.message),
    hashes: unit.commits.map((commit) => commit.hash),
    body: rowBody(unit),
  };
}

/**
 * Picks the "why" text for a row: the merged pull request's own body first,
 * since that is the text a reviewer wrote about the change as a whole, then
 * the first commit's own body, then none. An empty string from either source
 * carries no "why" text, so it falls through the same as a missing one.
 *
 * @param {Unit} unit
 * @returns {string | null}
 */
function rowBody(unit) {
  return unit.pullRequest?.body || unit.commits[0].body || null;
}

/**
 * @param {Unit} unit
 * @returns {string}
 */
function latestDate(unit) {
  return unit.commits.reduce((latest, commit) => (commit.date > latest ? commit.date : latest), unit.commits[0].date);
}

/**
 * Attributes a unit to the CODEOWNERS team owning the majority of its touched
 * files, falling back to the unit's first commit's author when no rule
 * matches any of them, or when several teams tie for the most files, this
 * report attributes to whichever of the tied teams owns the first touched
 * file, for a deterministic result.
 *
 * @param {Unit} unit
 * @param {string[]} files
 * @param {CodeownersRule[] | null} rules
 * @returns {string}
 */
function attributeOwner(unit, files, rules) {
  const fallback = unit.commits[0].authorName;
  if (!rules) return fallback;

  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {string[]} */
  const order = [];
  for (const file of files) {
    const team = matchTeam(rules, file);
    if (!team) continue;
    if (!counts.has(team)) order.push(team);
    counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  if (order.length === 0) return fallback;

  return order.reduce((winner, team) => ((counts.get(team) ?? 0) > (counts.get(winner) ?? 0) ? team : winner), order[0]);
}

/**
 * Finds the CODEOWNERS team for one file. CODEOWNERS gives later rules
 * priority over earlier ones, so the last matching rule wins.
 *
 * @param {CodeownersRule[]} rules
 * @param {string} file
 * @returns {string | undefined}
 */
function matchTeam(rules, file) {
  let team;
  for (const rule of rules) {
    if (rule.regex.test(file)) team = rule.team;
  }
  return team;
}

/**
 * @param {Unit} unit
 * @param {HostInfo | null} hostInfo
 * @returns {Ref}
 */
function buildRef(unit, hostInfo) {
  if (unit.pullRequest) {
    return { label: `#${unit.pullRequest.number}`, url: unit.pullRequest.url };
  }
  const hash = unit.commits[0].hash;
  const shortHash = hash.slice(0, 7);
  if (hostInfo?.isGitHub && hostInfo.owner && hostInfo.repo) {
    return { label: shortHash, url: `https://github.com/${hostInfo.owner}/${hostInfo.repo}/commit/${hash}` };
  }
  return { label: shortHash, url: null };
}

/**
 * @param {ReportRow} a
 * @param {ReportRow} b
 * @returns {number}
 */
function compareRows(a, b) {
  if (a.owner !== b.owner) return a.owner < b.owner ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return 0;
}

module.exports = { buildReport };
