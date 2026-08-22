// Type vocabulary matches CLAUDE.md's Conventional Commits section exactly —
// @commitlint/config-conventional ships that same type list, so no override is needed.
// Its defaults for header length (100) and scope (unrestricted) don't match CLAUDE.md's
// 72-character line limit and engineering/productivity scope vocabulary, so those two
// are overridden explicitly below.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    'scope-enum': [2, 'always', ['engineering', 'productivity']],
  },
};
