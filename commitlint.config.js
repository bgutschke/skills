// Type vocabulary matches CLAUDE.md's Conventional Commits section exactly —
// @commitlint/config-conventional ships that same type list, so no override is needed.
// Its defaults for header length (100) and scope (unrestricted) don't match this repo's
// 72-character line limit and scope vocabulary, so those two are overridden below.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    // engineering/productivity: bucket scope (which skills bucket a commit touches).
    // deps/config: Renovate's own maintenance scope (what kind of dependency-tooling
    // change this is) — its config-migration PR hardcodes scope "config" and can't be
    // reconfigured (renovatebot/renovate#35164), so this vocabulary has to be accepted
    // as-is rather than mapped onto the bucket scopes. See CONTEXT.md.
    'scope-enum': [2, 'always', ['engineering', 'productivity', 'deps', 'config']],
  },
};
