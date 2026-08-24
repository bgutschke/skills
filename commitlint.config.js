// Type vocabulary matches CLAUDE.md's Conventional Commits section exactly —
// @commitlint/config-conventional ships that same type list, so no override is needed.
// Its defaults for header length (100) and scope (unrestricted) don't match this repo's
// 72-character line limit and scope vocabulary, so those two are overridden below.
const fs = require('fs');
const path = require('path');
const { buildScopeEnum } = require('./scripts/commit-scope-enum');

const SKILL_ROOTS = ['skills/engineering', 'skills/productivity', '.claude/skills'];

function listDirNames(absDir) {
  if (!fs.existsSync(absDir)) return [];
  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function listSkillNames() {
  return SKILL_ROOTS.flatMap((root) => listDirNames(path.join(__dirname, root)));
}

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    // Skill-name scope (each skills/**/<name> and .claude/skills/<name> directory) plus
    // engineering/productivity bucket scope, plus deps/config — Renovate's own maintenance
    // scope (its config-migration PR hardcodes scope "config" and can't be reconfigured,
    // renovatebot/renovate#35164, so it's accepted as-is). A function so commitlint
    // re-reads the directory listing on every call rather than once at config load — it
    // matters when one process lints a range of commits (CI's --from/--to), so a skill
    // added mid-range is still a valid scope for a later commit in that same run. See
    // CONTEXT.md.
    'scope-enum': () => [2, 'always', buildScopeEnum(listSkillNames())],
  },
};
