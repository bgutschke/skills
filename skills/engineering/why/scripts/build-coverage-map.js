// @ts-check

const MCP_TOOL_RE = /^mcp__(.+?)__/;
const AUTH_TOOL_RE = /^mcp__.+?__(?:authenticate|complete_authentication)$/;
const TOKEN_SEPARATOR_RE = /[^a-z0-9]+/;

const NO_TOOL_REASON = 'no tool for this category in the session';

const CATEGORIES = [
  { category: 'source-control', label: 'Source control', alwaysAvailable: true },
  { category: 'issue-tracker', label: 'Issue tracker', alwaysAvailable: false },
  { category: 'long-form-documents', label: 'Long-form documents', alwaysAvailable: false },
  { category: 'team-chat', label: 'Team chat', alwaysAvailable: false },
  { category: 'infrastructure-observability', label: 'Infrastructure observability', alwaysAvailable: false },
  { category: 'error-tracking', label: 'Error tracking', alwaysAvailable: false },
  { category: 'repository-documents', label: 'Repository documents', alwaysAvailable: true },
];

/**
 * @typedef {{ source: string, categories: string[] }} SourcePattern
 *
 * @typedef {{
 *   category: string,
 *   label: string,
 *   available: boolean,
 *   sources: string[],
 *   reason?: string,
 * }} CoverageRow
 *
 * @typedef {{ rows: CoverageRow[], unclassified: string[] }} CoverageMap
 */

/**
 * Turns the tool and skill names visible in a session into the coverage
 * map a `why` run reports from: one row per evidence category, in fixed
 * order, plus the MCP servers that match no category. Source control and
 * repository documents are always available. A server that shows only its
 * authentication tools does not make its category available.
 *
 * @param {string[]} names
 * @param {SourcePattern[]} patterns
 * @returns {CoverageMap}
 */
function buildCoverageMap(names, patterns) {
  const sources = unique(names.map(sourceName));
  const usable = new Set(names.filter((name) => !AUTH_TOOL_RE.test(name)).map(sourceName));
  const servers = unique(names.filter((name) => MCP_TOOL_RE.test(name)).map(sourceName));

  return {
    rows: CATEGORIES.map(({ category, label, alwaysAvailable }) => {
      const matching = sources.filter((source) => categoriesOf(source, patterns).includes(category));
      const backing = matching.filter((source) => usable.has(source));
      if (alwaysAvailable || backing.length > 0) return { category, label, available: true, sources: backing };
      return { category, label, available: false, sources: [], reason: unavailableReason(matching) };
    }),
    unclassified: servers.filter((server) => categoriesOf(server, patterns).length === 0),
  };
}

/**
 * @param {string[]} unauthenticated
 * @returns {string}
 */
function unavailableReason(unauthenticated) {
  if (unauthenticated.length === 0) return NO_TOOL_REASON;
  return `${unauthenticated.join(', ')} ${unauthenticated.length === 1 ? 'needs' : 'need'} authentication`;
}

/**
 * Names the source a tool or skill belongs to. An MCP tool belongs to its
 * server and a `plugin:skill` name to its plugin, so each counts once. Any
 * other skill or built-in tool is its own source.
 *
 * @param {string} name
 * @returns {string}
 */
function sourceName(name) {
  return name.match(MCP_TOOL_RE)?.[1] ?? name.split(':')[0];
}

/**
 * Matches a source against the pattern table by whole name tokens, so
 * `claude_ai_Box` matches `box` and `sandbox` does not.
 *
 * @param {string} source
 * @param {SourcePattern[]} patterns
 * @returns {string[]}
 */
function categoriesOf(source, patterns) {
  const tokens = source.toLowerCase().split(TOKEN_SEPARATOR_RE);
  return patterns.filter((pattern) => tokens.includes(pattern.source)).flatMap((pattern) => pattern.categories);
}

/**
 * @template T
 * @param {T[]} values
 * @returns {T[]}
 */
function unique(values) {
  return [...new Set(values)];
}

module.exports = { buildCoverageMap };
