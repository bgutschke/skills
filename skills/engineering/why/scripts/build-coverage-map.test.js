// @ts-check
const { describe, expect, it } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { buildCoverageMap } = require('./build-coverage-map');

const SHIPPED_SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence-sources.json'), 'utf8'));

const SOURCES = [
  { source: 'atlassian', categories: ['issue-tracker', 'long-form-documents'] },
  { source: 'slack', categories: ['team-chat'] },
  { source: 'sentry', categories: ['error-tracking'] },
  { source: 'linear', categories: ['issue-tracker'] },
];

/**
 * @param {import('./build-coverage-map').CoverageMap} map
 * @param {string} category
 */
function rowFor(map, category) {
  return map.rows.find((row) => row.category === category);
}

describe('buildCoverageMap', () => {
  it('marks only source control and repository documents available when no MCP tool is present', () => {
    const map = buildCoverageMap(['Bash', 'Read', 'Agent'], SOURCES);

    expect(map.rows.filter((row) => row.available).map((row) => row.category)).toEqual([
      'source-control',
      'repository-documents',
    ]);
  });

  it('lists a server that backs two categories in both rows', () => {
    const map = buildCoverageMap(
      ['mcp__plugin_atlassian_atlassian__getJiraIssue', 'mcp__plugin_atlassian_atlassian__searchConfluence'],
      SOURCES,
    );

    expect(rowFor(map, 'issue-tracker')).toMatchObject({ available: true, sources: ['plugin_atlassian_atlassian'] });
    expect(rowFor(map, 'long-form-documents')).toMatchObject({
      available: true,
      sources: ['plugin_atlassian_atlassian'],
    });
  });

  it('lists a server that matches no pattern as unclassified, not as a category', () => {
    const map = buildCoverageMap(
      ['mcp__plugin_figma_figma__get_screenshot', 'mcp__plugin_figma_figma__get_metadata', 'figma:figma-use', 'Bash'],
      SOURCES,
    );

    expect(map.unclassified).toEqual(['plugin_figma_figma']);
    expect(map.rows.flatMap((row) => row.sources)).toEqual([]);
  });

  it('marks a category not available when its pattern row matches no tool', () => {
    const map = buildCoverageMap(['mcp__claude_ai_Slack__search_messages'], SOURCES);

    expect(rowFor(map, 'error-tracking')).toEqual({
      category: 'error-tracking',
      label: 'Error tracking',
      available: false,
      sources: [],
      reason: 'no tool for this category in the session',
    });
  });

  it('returns the rows in the fixed category order', () => {
    const map = buildCoverageMap(['mcp__sentry__search_issues', 'mcp__claude_ai_Atlassian__search'], SOURCES);

    expect(map.rows.map((row) => row.label)).toEqual([
      'Source control',
      'Issue tracker',
      'Long-form documents',
      'Team chat',
      'Infrastructure observability',
      'Error tracking',
      'Repository documents',
    ]);
  });

  it('marks a category not available when its only server still needs authentication', () => {
    const map = buildCoverageMap(
      ['mcp__claude_ai_Linear__authenticate', 'mcp__claude_ai_Linear__complete_authentication'],
      SOURCES,
    );

    expect(rowFor(map, 'issue-tracker')).toMatchObject({
      available: false,
      sources: [],
      reason: 'claude_ai_Linear needs authentication',
    });
  });

  it('keeps a category available through an authenticated server when another one still needs authentication', () => {
    const map = buildCoverageMap(
      ['mcp__claude_ai_Linear__authenticate', 'mcp__claude_ai_Atlassian__getJiraIssue'],
      SOURCES,
    );

    expect(rowFor(map, 'issue-tracker')).toMatchObject({ available: true, sources: ['claude_ai_Atlassian'] });
  });

  it('classifies common servers and skills with the shipped pattern table', () => {
    const map = buildCoverageMap(
      [
        'mcp__plugin_atlassian_atlassian__getJiraIssue',
        'mcp__plugin_datadog_mcp__search_datadog_logs',
        'mcp__plugin_sentry_sentry__search_issues',
        'mcp__claude_ai_Slack__slack_search_public',
        'mcp__plugin_figma_figma__get_metadata',
      ],
      SHIPPED_SOURCES,
    );

    expect(map.rows.map(({ category, sources }) => [category, sources])).toEqual([
      ['source-control', []],
      ['issue-tracker', ['plugin_atlassian_atlassian']],
      ['long-form-documents', ['plugin_atlassian_atlassian']],
      ['team-chat', ['claude_ai_Slack']],
      ['infrastructure-observability', ['plugin_datadog_mcp']],
      ['error-tracking', ['plugin_sentry_sentry']],
      ['repository-documents', []],
    ]);
    expect(map.unclassified).toEqual(['plugin_figma_figma']);
  });

  it('counts the skills of one plugin once, under the plugin name', () => {
    const map = buildCoverageMap(['sentry:sentry-debug-issue', 'sentry:sentry-get-started'], SOURCES);

    expect(rowFor(map, 'error-tracking')).toMatchObject({ available: true, sources: ['sentry'] });
  });
});
