// @ts-check

/**
 * @typedef {[number, string, unknown]} CommitlintRule
 * @typedef {{ rules?: Record<string, CommitlintRule | undefined> }} CommitlintConfig
 * @typedef {{ type: 'enum', values: string[] } | { type: 'free' }} ScopeRule
 * @typedef {'lower-case' | 'unspecified'} SubjectCase
 * @typedef {'commitlint' | 'doc' | 'git-log' | 'fallback'} ConventionSource
 * @typedef {{
 *   source: ConventionSource,
 *   typeEnum: string[],
 *   subjectCase: SubjectCase,
 *   headerMaxLength: number,
 *   scopeRule: ScopeRule,
 *   fallback: boolean,
 * }} ResolvedConvention
 */

// The bare Conventional Commits spec only formally defines feat/fix; this fuller list is
// Angular's convention, which @commitlint/config-conventional and semantic-release's
// angular preset both implement, so it's the closest thing to a de facto standard type
// list to fall back to when no repo-specific signal is found.
const FALLBACK_TYPE_ENUM = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'];

/** @type {ResolvedConvention} */
const FALLBACK_CONVENTION = {
  source: 'fallback',
  typeEnum: FALLBACK_TYPE_ENUM,
  subjectCase: 'lower-case',
  headerMaxLength: 72,
  scopeRule: { type: 'free' },
  fallback: true,
};

const NON_TYPE_CASE_NAMES = ['sentence-case', 'start-case', 'pascal-case', 'upper-case'];

/**
 * @param {CommitlintRule | undefined} rule
 * @returns {string[] | null}
 */
function readEnumRule(rule) {
  if (!Array.isArray(rule) || rule.length < 3) return null;
  const [level, , value] = rule;
  if (typeof level !== 'number' || level <= 0 || !Array.isArray(value) || value.length === 0) return null;
  return value;
}

/**
 * @param {CommitlintRule | undefined} rule
 * @returns {number | null}
 */
function readLengthRule(rule) {
  if (!Array.isArray(rule) || rule.length < 3) return null;
  const [level, , value] = rule;
  if (typeof level !== 'number' || level <= 0 || typeof value !== 'number') return null;
  return value;
}

/**
 * @param {CommitlintRule | undefined} rule
 * @returns {SubjectCase}
 */
function readSubjectCase(rule) {
  if (!Array.isArray(rule) || rule.length < 3) return FALLBACK_CONVENTION.subjectCase;
  const [level, applier, value] = rule;
  if (typeof level !== 'number' || level <= 0) return FALLBACK_CONVENTION.subjectCase;
  const names = Array.isArray(value) ? value : [value];
  if (applier === 'never' && NON_TYPE_CASE_NAMES.some((name) => names.includes(name))) return 'lower-case';
  if (applier === 'always' && names.includes('lower-case')) return 'lower-case';
  return FALLBACK_CONVENTION.subjectCase;
}

/**
 * @param {CommitlintRule | undefined} rule
 * @returns {ScopeRule}
 */
function readScopeRule(rule) {
  const values = readEnumRule(rule);
  return values ? { type: 'enum', values } : { type: 'free' };
}

/**
 * @param {CommitlintConfig | null} config
 * @returns {ResolvedConvention | null}
 */
function extractFromCommitlintConfig(config) {
  if (!config || typeof config !== 'object' || typeof config.rules !== 'object' || config.rules === null) return null;
  const typeEnum = readEnumRule(config.rules['type-enum']);
  if (!typeEnum) return null;
  return {
    source: 'commitlint',
    typeEnum,
    subjectCase: readSubjectCase(config.rules['subject-case']),
    headerMaxLength: readLengthRule(config.rules['header-max-length']) ?? FALLBACK_CONVENTION.headerMaxLength,
    scopeRule: readScopeRule(config.rules['scope-enum']),
    fallback: false,
  };
}

/**
 * A written doc mixes prose about many things with the one section that matters here, so
 * narrow to a heading whose text contains "commit" before pattern-matching — otherwise an
 * unrelated section's own backticked words could be mistaken for a type or scope enum. The
 * section runs until the next heading at the same or a shallower level, so nested
 * subsections (e.g. a "### Type" under "## Commit messages") stay included.
 * @param {string} docText
 * @returns {string}
 */
function isolateCommitSection(docText) {
  const headingMatch = docText.match(/^(#{1,6})[ \t]+.*commit.*$/im);
  if (!headingMatch || headingMatch.index === undefined) return docText;
  const level = headingMatch[1].length;
  const rest = docText.slice(headingMatch.index + headingMatch[0].length);
  const nextHeading = rest.match(new RegExp(`^#{1,${level}}[ \\t]+`, 'm'));
  return rest.slice(0, nextHeading?.index ?? rest.length);
}

/**
 * @param {string} section
 * @returns {string[]}
 */
function extractTypeEnumFromDoc(section) {
  const backtickTokens = [...section.matchAll(/`([a-z]+)`/g)].map((match) => match[1]);
  const found = backtickTokens.filter((token) => FALLBACK_TYPE_ENUM.includes(token));
  return [...new Set(found)];
}

/**
 * @param {string} section
 * @returns {number | null}
 */
function extractHeaderMaxLengthFromDoc(section) {
  const match = section.match(/(\d{2,3})\s*characters?/i);
  return match ? Number(match[1]) : null;
}

/**
 * @param {string} section
 * @returns {ScopeRule}
 */
function extractScopeRuleFromDoc(section) {
  const scopeHeading = section.match(/^#{1,6}[ \t]+.*scope.*$/im);
  if (!scopeHeading || scopeHeading.index === undefined) return { type: 'free' };
  const scopeSection = section.slice(scopeHeading.index, scopeHeading.index + 500);
  const tokens = [...scopeSection.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]).filter((token) => !FALLBACK_TYPE_ENUM.includes(token));
  return tokens.length > 0 ? { type: 'enum', values: [...new Set(tokens)] } : { type: 'free' };
}

/**
 * @param {string | null} docText
 * @returns {ResolvedConvention | null}
 */
function extractFromDoc(docText) {
  if (typeof docText !== 'string' || docText.trim() === '') return null;
  const section = isolateCommitSection(docText);
  const typeEnum = extractTypeEnumFromDoc(section);
  // A single backticked type-shaped word is too weak a signal on its own — plenty of docs
  // mention one type in passing without documenting an enum. Two or more in the same
  // section is what actually distinguishes a documented type list from incidental prose.
  if (typeEnum.length < 2) return null;
  return {
    source: 'doc',
    typeEnum,
    subjectCase: /lower[\s-]?case/i.test(section) ? 'lower-case' : FALLBACK_CONVENTION.subjectCase,
    headerMaxLength: extractHeaderMaxLengthFromDoc(section) ?? FALLBACK_CONVENTION.headerMaxLength,
    scopeRule: extractScopeRuleFromDoc(section),
    fallback: false,
  };
}

const CONVENTIONAL_SUBJECT = /^([a-z]+)(\([^)]+\))?!?:\s(.+)$/;

/**
 * @param {string[]} subjects
 * @returns {ResolvedConvention | null}
 */
function extractFromGitLog(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return null;
  const matches = subjects.map((subject) => (typeof subject === 'string' ? subject.match(CONVENTIONAL_SUBJECT) : null)).filter((match) => match !== null);
  // One conventional-shaped subject could be a coincidence (any word can precede a colon);
  // two independent occurrences is the minimum that suggests an actual habit rather than a
  // fluke.
  if (matches.length < 2) return null;
  const typeEnum = [...new Set(matches.map((match) => match[1]))].sort();
  const lowerCaseCount = matches.filter((match) => /^[a-z]/.test(match[3])).length;
  // 80% clears out the occasional exception (a proper noun, an acronym) without demanding
  // the unanimous compliance a small, noisy sample is unlikely to show.
  return {
    source: 'git-log',
    typeEnum,
    subjectCase: lowerCaseCount / matches.length >= 0.8 ? 'lower-case' : 'unspecified',
    headerMaxLength: FALLBACK_CONVENTION.headerMaxLength,
    scopeRule: { type: 'free' },
    fallback: false,
  };
}

/**
 * Resolves a repo's commit-message convention from up to three discovery signals, checked
 * in priority order — commitlint's resolved config, a written convention doc, a git-log
 * subject sample — falling back to the Fallback convention only when none yields a usable
 * signal. The whole resolution degrades to the next source together rather than merging
 * per field: a source that is present but malformed (e.g. commitlint installed but its
 * config carries no usable type-enum rule) is treated the same as an absent one.
 * @param {CommitlintConfig | null} commitlintConfig
 * @param {string | null} conventionDocText
 * @param {string[]} gitLogSubjects
 * @returns {ResolvedConvention}
 */
function resolveCommitConvention(commitlintConfig, conventionDocText, gitLogSubjects) {
  return (
    extractFromCommitlintConfig(commitlintConfig) ?? extractFromDoc(conventionDocText) ?? extractFromGitLog(gitLogSubjects) ?? { ...FALLBACK_CONVENTION }
  );
}

module.exports = { resolveCommitConvention, FALLBACK_CONVENTION };
