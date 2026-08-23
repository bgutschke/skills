# Release automation via semantic-release, gated by a required-PR ruleset on `main`

Before #10, `.claude-plugin/plugin.json`'s `version` field was hand-edited and nothing
kept it in sync with anything, there was no changelog, and `main` accepted direct pushes
with no automated correctness check before a change shipped. #10 replaced this with a
`release.yml` workflow that runs `semantic-release` after every successful `Validate` run
on `main`, deriving the version bump from the Conventional Commit types already required
by `CLAUDE.md` (`feat`/`fix`/`perf` are release-triggering; the rest are not — see that
file's commit-type table). A small, repo-owned script
(`scripts/sync-plugin-version-cli.js`, wrapping the pure function in
`scripts/sync-plugin-version.js`) writes the new version into
`.claude-plugin/plugin.json`, deliberately in place of a third-party single-purpose
plugin for a one-field sync this repo can own directly. `package.json` is `"private":
true` with `npmPublish: false` — this repo is never published to the npm registry, since
consumers install it via `npx skills@latest add bgutschke/skills`, not `npm install`; the
manifest exists purely for release bookkeeping. npm, not Bun, is this repo's package
manager.

`main` is protected by a GitHub ruleset requiring a pull request, with 0 required
approvals (a solo-maintained repo has no one else to rubber-stamp a review) and
`enforce_admins: false`, so the repo owner can still push directly in an emergency — a
personal GitHub account has no separate bypass-actor mechanism (classic
`bypass_pull_request_allowances` and Rulesets Integration bypass actors are both
org-only). That same constraint is why `release.yml` authenticates as the repo owner via
a `RELEASE_TOKEN` PAT rather than the default `GITHUB_TOKEN`: the workflow's own actor
(`github-actions[bot]`) isn't a repo collaborator and can't push past the ruleset, and the
workflow's `permissions: contents: read` makes sure nothing silently falls back to a
token that can't actually push.

## Consequences

- **`RELEASE_TOKEN` is a hard dependency, not an optional nicety.** If it expires or is
  revoked, the release job's `git push` step fails loudly rather than silently
  succeeding with reduced permissions — rotate it before it expires.
- **The version-sync function is the one piece of this pipeline actually unit-tested**
  (`scripts/sync-plugin-version.test.js`, plain Jest). Everything else — the
  `semantic-release` plugin chain, the two workflows, the ruleset — is verified
  operationally: `npx semantic-release --dry-run` and a real trial PR, not a test suite.
- **`release.yml` triggers on `workflow_run` of `Validate`, gated on `conclusion ==
  'success'`**, not directly on `push`. `Validate` also fires on every push to `main`
  (including the ruleset-permitted emergency direct push), so this is defense in depth on
  top of the ruleset, not a redundant check to simplify away.
- Only `feat`, `fix`, and `perf` commits cut a release. A change that should ship as part
  of the next release but is typed `chore`/`docs`/`build`/`ci` won't trigger one on its
  own — this is a common source of "why didn't this release" confusion, so check the
  commit type before assuming the pipeline is broken.
